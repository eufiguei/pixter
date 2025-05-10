// src/app/api/motorista/payments/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { supabaseServer } from "@/lib/supabase/client";

// Initialize Stripe client
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

// Default response for errors or empty state
const DEFAULT_RESPONSE = {
  balance: { 
    available: [{ amount: "R$ 0,00", currency: "brl" }], 
    pending: [{ amount: "R$ 0,00", currency: "brl" }] 
  },
  transactions: []
};

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
    const session = await getServerSession(authOptions) as {
      user?: {
        id: string;
        tipo?: string;
        email?: string;
      }
    } | null;
    
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
      
      // Attempt to fetch balance - with extra logging and error handling
      console.log("Attempting to fetch balance for account:", stripeAccountId);
      let bal;
      try {
        bal = await stripe.balance.retrieve(
          {},
          { stripeAccount: stripeAccountId }
        );
        console.log("Stripe balance retrieved successfully:", JSON.stringify(bal, null, 2));
      } catch (balanceError) {
        console.error("Error retrieving balance:", balanceError);
        throw balanceError; // Let the outer catch handle it
      }

      // Set up filters for transactions
      const listParams: Stripe.BalanceTransactionListParams = { 
        limit: 100,
        expand: ['data.source']
      };
      
      // Create date filters using the correct type syntax
      if (startDate || endDate) {
        const createdFilter: { gte?: number; lt?: number } = {};
        
        if (startDate) {
          createdFilter.gte = Math.floor(new Date(startDate).getTime() / 1000);
        }
        
        if (endDate) {
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1);
          createdFilter.lt = Math.floor(end.getTime() / 1000);
        }
        
        // Assign the properly typed object to listParams.created
        listParams.created = createdFilter;
      }
      
      // Log with explicit type casting for safer logging
      console.log('Date filter params:', { 
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        unixStartTime: typeof listParams.created === 'object' ? (listParams.created as any).gte : null,
        unixEndTime: typeof listParams.created === 'object' ? (listParams.created as any).lt : null
      });

      // Fetch transactions list with expanded details
      const txList = await stripe.balanceTransactions.list(
        {
          ...listParams,
          expand: ['data.source']
        },
        { stripeAccount: stripeAccountId }
      );
      console.log(`Retrieved ${txList.data.length} transactions`);
      
      // Log raw data for debugging
      if (txList.data.length > 0) {
        console.log('First transaction sample:', JSON.stringify(txList.data[0], null, 2));
      } else {
        console.log('No transactions found in the specified date range');
      }
      
      // Try to fetch both pending and succeeded transactions too
      let pendingTransactions: Stripe.Charge[] = [];
      let successfulCharges: Stripe.Charge[] = [];
      try {
        // Create a charge list params object that matches the Stripe API structure
        const baseChargeParams: any = {
          limit: 100,
          expand: ['data.balance_transaction']
        };
        
        // Only add the created filter if it exists
        if (listParams.created) {
          baseChargeParams.created = listParams.created;
        }
        
        // Fetch pending charges
        const pendingCharges = await stripe.charges.list(
          {
            ...baseChargeParams,
            status: 'pending'
          },
          { stripeAccount: stripeAccountId }
        );
        pendingTransactions = pendingCharges.data;
        console.log(`Retrieved ${pendingTransactions.length} pending charges`);
        
        // Fetch successful charges
        const successfulChargesResponse = await stripe.charges.list(
          {
            ...baseChargeParams,
            status: 'succeeded'
          },
          { stripeAccount: stripeAccountId }
        );
        successfulCharges = successfulChargesResponse.data;
        console.log(`Retrieved ${successfulCharges.length} succeeded charges`);
        
        // Log sample data if available
        if (pendingTransactions.length > 0 || successfulCharges.length > 0) {
          if (pendingTransactions.length > 0) {
            console.log('Sample pending charge:', JSON.stringify(pendingTransactions[0], null, 2));
          }
          if (successfulCharges.length > 0) {
            console.log('Sample succeeded charge:', JSON.stringify(successfulCharges[0], null, 2));
          }
        }
      } catch (pendingErr) {
        console.error('Error fetching pending transactions:', pendingErr);
      }

      // Format balance data with proper defaults
      console.log("Formatting balance data");
      
      // Format balance info for the frontend with enhanced error handling and logging
      const formattedBalance = {
        available: [] as { amount: string; currency: string }[],
        pending: [] as { amount: string; currency: string }[]
      };
      
      console.log("Raw balance data from Stripe:", JSON.stringify(bal, null, 2));
      
      // Format available balance with careful error checking
      if (bal && bal.available && Array.isArray(bal.available) && bal.available.length > 0) {
        console.log("Processing available balance:", bal.available);
        formattedBalance.available = bal.available.map(fund => {
          // Guard against malformed data
          if (typeof fund.amount !== 'number') {
            console.error("Invalid amount in available balance:", fund);
            return { amount: "R$ 0,00", currency: "brl" };
          }
          return {
            amount: formatAmount(fund.amount, fund.currency),
            currency: fund.currency
          };
        });
      } else {
        console.warn("No available balance found, using default");
        // Provide a default if no available balance
        formattedBalance.available = [{ amount: "R$ 0,00", currency: "brl" }];
      }
      
      // Format pending balance with careful error checking
      if (bal && bal.pending && Array.isArray(bal.pending) && bal.pending.length > 0) {
        console.log("Processing pending balance:", bal.pending);
        formattedBalance.pending = bal.pending.map(fund => {
          // Guard against malformed data
          if (typeof fund.amount !== 'number') {
            console.error("Invalid amount in pending balance:", fund);
            return { amount: "R$ 0,00", currency: "brl" };
          }
          return {
            amount: formatAmount(fund.amount, fund.currency),
            currency: fund.currency
          };
        });
      } else {
        console.warn("No pending balance found, using default");
        // Provide a default if no pending balance
        formattedBalance.pending = [{ amount: "R$ 0,00", currency: "brl" }];
      }
      
      // Log the formatted balance we're sending back
      console.log("Formatted balance data being returned:", JSON.stringify(formattedBalance, null, 2));

      // Process balance transactions
      const processedTransactions = await Promise.all(
        txList.data.map(async (t) => {
          const details = await getPaymentDetails(t, stripeAccountId);
          return {
            id: t.id,
            chargeId: details.chargeId,
            amount: formatAmount(t.amount, t.currency),
            currency: t.currency,
            description: t.description || "-",
            data: new Date(t.created * 1000).toISOString(), // Note: Using "data" as the field name to match frontend
            type: t.type,
            metodo: details.metodo,
            cliente: details.cliente,
            fee: t.fee ? formatAmount(t.fee, t.currency) : undefined,
            status: 'completed'
          };
        })
      );
      
      // Process pending transactions
      const pendingTxs = pendingTransactions.map(charge => ({
        id: charge.id,
        chargeId: charge.id,
        amount: formatAmount(charge.amount, charge.currency),
        currency: charge.currency,
        description: charge.description || "-",
        data: new Date(charge.created * 1000).toISOString(), // Note: Using "data" as the field name to match frontend
        type: "charge",
        metodo: charge.payment_method_details?.type || "card",
        cliente: charge.receipt_email || charge.billing_details?.email || "-",
        status: 'pending'
      }));
      
      // Process successful charges that might not be in the balance transactions
      const successfulTxs = successfulCharges.map(charge => ({
        id: charge.id,
        chargeId: charge.id,
        amount: formatAmount(charge.amount, charge.currency),
        currency: charge.currency,
        description: charge.description || "-",
        data: new Date(charge.created * 1000).toISOString(), // Note: Using "data" as the field name to match frontend
        type: "charge",
        metodo: charge.payment_method_details?.type || "card",
        cliente: charge.receipt_email || charge.billing_details?.email || "-",
        status: 'succeeded'
      }));
      
      // Combine all transactions, making sure to avoid duplicates
      // Create a Set of IDs to track which transactions we've already added
      const transactionIds = new Set<string>();
      const allTransactions = [];
      
      // First add balance transactions (most reliable source)
      for (const tx of processedTransactions) {
        transactionIds.add(tx.id);
        allTransactions.push(tx);
      }
      
      // Then add pending transactions if they're not already included
      for (const tx of pendingTxs) {
        if (!transactionIds.has(tx.id)) {
          transactionIds.add(tx.id);
          allTransactions.push(tx);
        }
      }
      
      // Finally add succeeded charges that weren't in balance transactions
      for (const tx of successfulTxs) {
        if (!transactionIds.has(tx.id)) {
          transactionIds.add(tx.id);
          allTransactions.push(tx);
        }
      }
      
      // Log stats about found transactions
      console.log(`Found ${processedTransactions.length} balance transactions, ${pendingTxs.length} pending charges, and ${successfulTxs.length} successful charges`);
      console.log(`After deduplication, total transactions: ${allTransactions.length}`);

      // Return everything, sorted by date (newest first)
      return NextResponse.json({
        balance: formattedBalance,
        transactions: allTransactions.sort((a, b) => {
          // Sort by date, newest first
          return new Date(b.data).getTime() - new Date(a.data).getTime();
        }),
        dateRange: {
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate ? new Date(endDate).toISOString() : null
        }
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
