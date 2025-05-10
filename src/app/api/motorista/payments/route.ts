// src/app/api/motorista/payments/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { supabaseServer } from "@/lib/supabase/client";

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).format(amount / 100);
}

// Helper to get payment details
async function getPaymentDetails(tx: Stripe.BalanceTransaction, stripeAccountId: string): Promise<{ metodo: string | null; cliente: string | null; chargeId: string | null }> {
  if (tx.type === "charge" || tx.type === "payment") {
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
        // Fallback or default values if charge retrieval fails
        return { metodo: tx.type, cliente: "Erro ao buscar", chargeId: null };
      }
    } else if (typeof tx.source === "object" && tx.source?.object === "charge") {
       // Handle cases where source is an expanded Charge object (less common for balance transactions list)
       const charge = tx.source as Stripe.Charge;
       const metodo = charge.payment_method_details?.type || "Desconhecido";
       const cliente = charge.receipt_email || charge.billing_details?.email || "Não informado";
       return { metodo, cliente, chargeId: charge.id };
    }
  }
  // Default for non-charge transactions or if source is not a charge ID
  return { metodo: tx.type, cliente: "N/A", chargeId: null };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.tipo !== "motorista") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", userId)
    .eq("tipo", "motorista")
    .single();

  if (profileError) {
    return NextResponse.json(
      { error: "Erro ao buscar perfil." },
      { status: 500 }
    );
  }
  
  // If no Stripe account is connected, return an empty data set with a needsConnection flag
  // This is better than returning an error status
  if (!profile?.stripe_account_id) {
    return NextResponse.json({
      needsConnection: true,
      balance: { available: 0, pending: 0, currency: "brl" },
      transactions: [],
      message: "Conta Stripe não configurada"
    });
  }
  const stripeAccountId = profile.stripe_account_id;

  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  try {
    const bal = await stripe.balance.retrieve(
      {},
      { stripeAccount: stripeAccountId }
    );

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

    const txList = await stripe.balanceTransactions.list(
      listParams,
      { stripeAccount: stripeAccountId }
    );

    const available = bal.available.map((b) => ({
      amount: formatAmount(b.amount, b.currency),
      currency: b.currency,
    }));
    const pending = bal.pending.map((b) => ({
      amount: formatAmount(b.amount, b.currency),
      currency: b.currency,
    }));

    // Process transactions in parallel to fetch charge details
    const transactionsPromises = txList.data.map(async (t) => {
      const details = await getPaymentDetails(t, stripeAccountId);
      return {
        id: t.id, // Keep balance transaction ID for keying if needed
        chargeId: details.chargeId, // Add charge ID for receipt link
        amount: formatAmount(t.amount, t.currency),
        currency: t.currency,
        description: t.description || "-",
        data: new Date(t.created * 1000).toISOString(),
        type: t.type, // Keep original type if needed
        metodo: details.metodo, // Use fetched payment method
        cliente: details.cliente, // Use fetched client email
        fee: typeof t.fee === "number" ? formatAmount(t.fee, t.currency) : undefined,
      };
    });

    const transactions = await Promise.all(transactionsPromises);

    return NextResponse.json({
      balance: { available, pending },
      transactions,
    });
  } catch (err: any) {
    console.error("Stripe balance error:", err);
    return NextResponse.json(
      { error: "Erro ao recuperar saldo/transações." },
      { status: 500 }
    );
  }
}

