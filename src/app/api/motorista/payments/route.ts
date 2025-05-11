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
  transactions: [],
  error: "Dados não disponíveis ou erro na configuração."
};

// Initialize Stripe client
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2022-11-15",
    typescript: true,
  });
} else {
  console.error("CRITICAL: STRIPE_SECRET_KEY environment variable not set.");
}

// Format amount from cents to readable currency
function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).format(amount / 100);
}

async function getPaymentDetails(tx: Stripe.BalanceTransaction, stripeAccountId: string): Promise<{ metodo: string | null; cliente: string | null; chargeId: string | null; receipt_url: string | null }> {
  let metodo: string | null = tx.type || "payment";
  let cliente: string | null = "N/A";
  let chargeId: string | null = null;
  let receipt_url: string | null = null;

  try {
    if (!stripe) throw new Error("Stripe not initialized in getPaymentDetails");

    if (tx.source && typeof tx.source === "string" && (tx.source.startsWith("ch_") || tx.source.startsWith("py_"))) {
      console.log(`[PaymentsAPI] Fetching charge details for source: ${tx.source} on account ${stripeAccountId}`);
      const charge = await stripe.charges.retrieve(tx.source, {
        expand: ["customer", "invoice"],
      }, { stripeAccount: stripeAccountId });
      
      chargeId = charge.id;
      metodo = charge.payment_method_details?.type || "Desconhecido";
      cliente = charge.billing_details?.email || charge.receipt_email || (charge.customer as Stripe.Customer)?.email || "Não informado";
      receipt_url = charge.receipt_url;
      console.log(`[PaymentsAPI] Charge details for ${tx.source}: metodo=${metodo}, cliente=${cliente}, receipt_url=${receipt_url}`);
    } else if (tx.source && typeof tx.source === "object" && tx.source.object === "charge") {
      const charge = tx.source as Stripe.Charge;
      chargeId = charge.id;
      metodo = charge.payment_method_details?.type || "Desconhecido";
      cliente = charge.billing_details?.email || charge.receipt_email || "Não informado";
      receipt_url = charge.receipt_url;
      console.log(`[PaymentsAPI] Expanded charge details: metodo=${metodo}, cliente=${cliente}, receipt_url=${receipt_url}`);
    }
  } catch (err: any) {
    console.error(`[PaymentsAPI] Error in getPaymentDetails for source ${tx.source} on account ${stripeAccountId}:`, err.message);
    metodo = tx.type || "payment_error";
    cliente = "Erro ao buscar detalhes";
  }
  return { metodo, cliente, chargeId, receipt_url };
}

export async function GET(request: Request) {
  console.log("[PaymentsAPI] Received GET request for motorista payments.");

  if (!stripe) {
    console.error("[PaymentsAPI] Stripe not initialized. STRIPE_SECRET_KEY might be missing.");
    return NextResponse.json({ ...DEFAULT_RESPONSE, error: "Configuração do Stripe ausente no servidor." }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.tipo !== "motorista") {
    console.warn("[PaymentsAPI] Unauthorized access attempt.");
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = session.user.id;
  console.log(`[PaymentsAPI] Authenticated user ID: ${userId}`);

  let profile;
  try {
    const { data, error } = await supabaseServer
      .from("profiles")
      .select("stripe_account_id, nome") // Only select what's needed
      .eq("id", userId)
      .single();
    if (error) throw error;
    profile = data;
  } catch (dbError: any) {
    console.error(`[PaymentsAPI] Error fetching profile for user ${userId} from Supabase:`, dbError.message);
    return NextResponse.json({ ...DEFAULT_RESPONSE, error: "Erro ao buscar perfil do usuário." }, { status: 500 });
  }

  if (!profile) {
    console.warn(`[PaymentsAPI] Profile not found for user ${userId}.`);
    return NextResponse.json({ ...DEFAULT_RESPONSE, error: "Perfil do usuário não encontrado." }, { status: 404 });
  }

  const stripeAccountId = profile.stripe_account_id;
  if (!stripeAccountId) {
    console.warn(`[PaymentsAPI] User ${userId} (Nome: ${profile.nome}) does not have a Stripe Account ID configured in Supabase.`);
    return NextResponse.json({
      ...DEFAULT_RESPONSE,
      needsConnection: true,
      message: "Conta Stripe não configurada. Por favor, conecte sua conta Stripe."
    });
  }
  console.log(`[PaymentsAPI] Stripe Account ID for user ${userId} (Nome: ${profile.nome}): ${stripeAccountId}`);

  const url = new URL(request.url);
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");
  console.log(`[PaymentsAPI] Date params: startDate=${startDateParam}, endDate=${endDateParam}`);

  try {
    console.log(`[PaymentsAPI] Verifying Stripe account: ${stripeAccountId}`);
    const account = await stripe.accounts.retrieve(stripeAccountId);
    console.log(`[PaymentsAPI] Stripe account ${stripeAccountId} verified. Charges enabled: ${account.charges_enabled}, Payouts enabled: ${account.payouts_enabled}`);
    if (!account.charges_enabled) {
        console.warn(`[PaymentsAPI] Stripe account ${stripeAccountId} does not have charges enabled.`);
        // It might still be useful to show balance if payouts are enabled or for other reasons
    }

    console.log(`[PaymentsAPI] Fetching balance for Stripe account: ${stripeAccountId}`);
    const balance = await stripe.balance.retrieve({ stripeAccount: stripeAccountId });
    console.log(`[PaymentsAPI] Raw Stripe Balance for ${stripeAccountId}:`, JSON.stringify(balance, null, 2));

    const listParams: Stripe.BalanceTransactionListParams = { limit: 100, expand: ["data.source"] };
    if (startDateParam || endDateParam) {
      const createdFilter: Stripe.RangeQueryParam = {};
      if (startDateParam) createdFilter.gte = Math.floor(new Date(startDateParam).getTime() / 1000);
      if (endDateParam) {
        const end = new Date(endDateParam);
        end.setDate(end.getDate() + 1); // Include the whole end day
        createdFilter.lt = Math.floor(end.getTime() / 1000);
      }
      listParams.created = createdFilter;
      console.log(`[PaymentsAPI] Date filter for transactions: ${JSON.stringify(createdFilter)}`);
    }

    console.log(`[PaymentsAPI] Fetching completed balance transactions for ${stripeAccountId} with params: ${JSON.stringify(listParams)}`);
    const completedTransactions = await stripe.balanceTransactions.list(listParams, { stripeAccount: stripeAccountId });
    console.log(`[PaymentsAPI] Raw completed transactions for ${stripeAccountId} (${completedTransactions.data.length} found):`, JSON.stringify(completedTransactions.data.slice(0,3), null, 2)); // Log first 3

    console.log(`[PaymentsAPI] Fetching pending charges for ${stripeAccountId}`);
    const pendingChargesParams: Stripe.ChargeListParams = { limit: 100, status: "pending", expand:["data.balance_transaction", "data.customer"] };
    if(listParams.created) pendingChargesParams.created = listParams.created;
    const pendingStripeCharges = await stripe.charges.list(pendingChargesParams, { stripeAccount: stripeAccountId });
    console.log(`[PaymentsAPI] Raw pending charges for ${stripeAccountId} (${pendingStripeCharges.data.length} found):`, JSON.stringify(pendingStripeCharges.data.slice(0,3), null, 2)); // Log first 3

    const formattedAvailable = balance.available.map(b => ({ amount: formatAmount(b.amount, b.currency), currency: b.currency.toUpperCase() }));
    const formattedPending = balance.pending.map(b => ({ amount: formatAmount(b.amount, b.currency), currency: b.currency.toUpperCase() }));
    
    console.log("[PaymentsAPI] Formatted balance:", { available: formattedAvailable, pending: formattedPending });

    const processedCompletedTxs = await Promise.all(
      completedTransactions.data.map(async (tx) => {
        const details = await getPaymentDetails(tx, stripeAccountId);
        return {
          id: tx.id,
          chargeId: details.chargeId,
          amount: formatAmount(tx.amount, tx.currency),
          currency: tx.currency.toUpperCase(),
          description: tx.description || "-",
          created: new Date(tx.created * 1000).toISOString(),
          type: tx.type,
          metodo: details.metodo,
          cliente: details.cliente,
          fee: tx.fee ? formatAmount(tx.fee, tx.currency) : "R$ 0,00",
          status: "completed",
          receipt_url: details.receipt_url
        };
      })
    );

    const processedPendingTxs = pendingStripeCharges.data.map(charge => ({
      id: charge.id,
      chargeId: charge.id,
      amount: formatAmount(charge.amount, charge.currency),
      currency: charge.currency.toUpperCase(),
      description: charge.description || "Pagamento pendente",
      created: new Date(charge.created * 1000).toISOString(),
      type: "charge", // Pending items are charges
      metodo: charge.payment_method_details?.type || charge.payment_method_types?.[0] || "card",
      cliente: charge.billing_details?.email || charge.receipt_email || (charge.customer as Stripe.Customer)?.email || "Não informado",
      fee: charge.application_fee_amount ? formatAmount(charge.application_fee_amount, charge.currency) : "R$ 0,00",
      status: "pending",
      receipt_url: charge.receipt_url
    }));
    
    const allTransactions = [...processedCompletedTxs, ...processedPendingTxs].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    console.log(`[PaymentsAPI] Total combined transactions: ${allTransactions.length}`);

    return NextResponse.json({
      balance: { available: formattedAvailable, pending: formattedPending },
      transactions: allTransactions,
      dateRange: { start: startDateParam, end: endDateParam },
      stripeAccountStatus: { charges_enabled: account.charges_enabled, payouts_enabled: account.payouts_enabled, details_submitted: account.details_submitted }
    });

  } catch (stripeError: any) {
    console.error(`[PaymentsAPI] Stripe API error for account ${stripeAccountId}:`, stripeError.message, stripeError.stack);
    return NextResponse.json({
      ...DEFAULT_RESPONSE,
      error: "Erro ao comunicar com o Stripe. Verifique os logs do servidor.",
      errorDetails: stripeError.message
    }, { status: 500 });
  }
}
