// src/app/api/motorista/payments/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { supabaseServer } from "@/lib/supabase/client";

// Pre-defined response for when Stripe is not available or configured
const DEFAULT_RESPONSE = {
  balance: { 
    available: [{ amount: "R$ 0,00", currency: "brl" }], 
    pending: [{ amount: "R$ 0,00", currency: "brl" }] 
  },
  transactions: []
};

// Initialize Stripe client - we'll try/catch this to handle missing env variables
let stripe: Stripe | null = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2022-11-15",
    });
  } else {
    console.error("STRIPE_SECRET_KEY environment variable not set");
  }
} catch (err) {
  console.error("Error initializing Stripe:", err);
}

// Format amount from cents to readable currency
function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).format(amount / 100);
}

// Helper to get payment details with improved error handling
async function getPaymentDetails(tx: Stripe.BalanceTransaction, stripeAccountId: string): Promise<{ metodo: string | null; cliente: string | null; chargeId: string | null }> {
  try {
    if (tx.type === "charge" || tx.type === "payment") {
      if (!stripe) throw new Error("Stripe not initialized");
      if (typeof tx.source === "string" && (tx.source.startsWith("ch_") || tx.source.startsWith("py_"))) {
        try {
          const charge = await stripe.charges.retrieve(tx.source, {
            stripeAccount: stripeAccountId,
          });
          const metodo = charge.payment_method_details?.type || "Desconhecido";
          const cliente = charge.receipt_email || charge.billing_details?.email || "Não informado";
          return { metodo, cliente, chargeId: charge.id };
        } catch (error) {
          console.error(`Error fetching charge ${tx.source}:`, error);
          // Fallback if charge retrieval fails
          return { metodo: tx.type, cliente: "Erro ao buscar", chargeId: null };
        }
      } else if (typeof tx.source === "object" && tx.source?.object === "charge") {
        // Handle cases where source is an expanded Charge object
        const charge = tx.source as Stripe.Charge;
        const metodo = charge.payment_method_details?.type || "Desconhecido";
        const cliente = charge.receipt_email || charge.billing_details?.email || "Não informado";
        return { metodo, cliente, chargeId: charge.id };
      }
    }
  } catch (err) {
    console.error("Error in getPaymentDetails:", err);
  }
  // Default response
  return { metodo: tx.type || "payment", cliente: "N/A", chargeId: null };
}

export async function GET(request: Request) {
  try {
    // Guard against missing Stripe initialization
    if (!stripe) {
      console.error("Stripe not initialized, returning default response");
      return NextResponse.json({
        ...DEFAULT_RESPONSE,
        error: "Stripe API not configured"
      });
    }

    // Get the authenticated user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.tipo !== "motorista") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get the user profile from Supabase
    const { data: profile, error: profileError } = await supabaseServer
      .from("profiles")
      .select("stripe_account_id, nome, email, celular")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json(DEFAULT_RESPONSE);
    }

    // If there's no Stripe account connected
    if (!profile?.stripe_account_id) {
      return NextResponse.json({
        ...DEFAULT_RESPONSE,
        needsConnection: true,
        message: "Conta Stripe não configurada"
      });
    }

    const stripeAccountId = profile.stripe_account_id;
    console.log("Fetching data for Stripe account:", stripeAccountId);
    
    // Parse query parameters for date filtering
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    try {
      // First check if the account is valid
      try {
        const account = await stripe.accounts.retrieve(stripeAccountId);
        console.log("Retrieved Stripe account:", account.id);
      } catch (accountError: any) {
        console.error("Error retrieving Stripe account:", accountError?.message || accountError);
        if (accountError?.statusCode === 404) {
          return NextResponse.json({
            ...DEFAULT_RESPONSE,
            needsConnection: true,
            message: "Conta Stripe inválida"
          });
        }
        throw accountError; // Let the outer catch block handle it
      }
      
      // Attempt to fetch balance
      const bal = await stripe.balance.retrieve(
        {},
        { stripeAccount: stripeAccountId }
      );
      console.log("Stripe balance retrieved successfully");

      // Set up filters for transactions
      const listParams: Stripe.BalanceTransactionListParams = { limit: 100 };
      if (startDate || endDate) {
        listParams.created = {};
        if (startDate) {
          listParams.created.gte = Math.floor(
            new Date(startDate).getTime() / 1000
          );
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1);
          listParams.created.lt = Math.floor(end.getTime() / 1000);
        }
      }

      // Fetch transactions list
      const txList = await stripe.balanceTransactions.list(
        listParams,
        { stripeAccount: stripeAccountId }
      );
      console.log(`Retrieved ${txList.data.length} transactions`);

      // Format balance data
      const available = bal.available.map((b) => ({
        amount: formatAmount(b.amount, b.currency),
        currency: b.currency,
      }));
      const pending = bal.pending.map((b) => ({
        amount: formatAmount(b.amount, b.currency),
        currency: b.currency,
      }));

      // Process transactions
      const transactions = await Promise.all(
        txList.data.map(async (t) => {
          const details = await getPaymentDetails(t, stripeAccountId);
          return {
            id: t.id,
            chargeId: details.chargeId,
            amount: formatAmount(t.amount, t.currency),
            currency: t.currency,
            description: t.description || "-",
            created: new Date(t.created * 1000).toISOString(),
            type: t.type,
            metodo: details.metodo,
            cliente: details.cliente,
            fee: t.fee ? formatAmount(t.fee, t.currency) : undefined,
          };
        })
      );

      return NextResponse.json({
        balance: { available, pending },
        transactions,
      });
    } catch (stripeError: any) {
      console.error("Stripe API error:", stripeError?.message || stripeError);
      
      // Instead of failing with 500, return valid response structure
      return NextResponse.json({
        balance: {
          available: [{ amount: formatAmount(0, "brl"), currency: "brl" }],
          pending: [{ amount: formatAmount(0, "brl"), currency: "brl" }]
        },
        transactions: [],
        error: "Erro ao consultar dados do Stripe",
        errorDetails: stripeError?.message
      });
    }
  } catch (error: any) {
    console.error("Payments API general error:", error?.message || error);
    // Always return a valid response even on error
    return NextResponse.json(DEFAULT_RESPONSE);
  }
}

