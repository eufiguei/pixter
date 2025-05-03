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

export async function GET(request: Request) {
  // 1) Authenticate user via NextAuth
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (session.user.tipo !== "motorista") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // 2) Lookup connected Stripe account for this driver
  const userId = session.user.id;
  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", userId)
    .eq("tipo", "motorista")
    .single();

  if (profileError || !profile?.stripe_account_id) {
    return NextResponse.json(
      { error: "Conta Stripe não configurada." },
      { status: 404 }
    );
  }
  const stripeAccountId = profile.stripe_account_id;

  // 3) Parse optional date filters
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  try {
    // 4) Retrieve balance for connected account
    const bal = await stripe.balance.retrieve(
      {},
      { stripeAccount: stripeAccountId }
    );

    // 5) Build parameters for listing balance transactions
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

    // 6) Retrieve the transactions list
    const txList = await stripe.balanceTransactions.list(
      listParams,
      { stripeAccount: stripeAccountId }
    );

    // 7) Format balance buckets
    const available = bal.available.map((b) => ({
      amount: formatAmount(b.amount, b.currency),
      currency: b.currency,
    }));
    const pending = bal.pending.map((b) => ({
      amount: formatAmount(b.amount, b.currency),
      currency: b.currency,
    }));

    // 8) Format each transaction record
    const transactions = txList.data.map((t) => ({
      id: t.id,
      amount: formatAmount(t.amount, t.currency),
      currency: t.currency,
      description: t.description || "-",
      created: new Date(t.created * 1000).toISOString(),
      type: t.type,
      fee: typeof t.fee === "number" ? formatAmount(t.fee, t.currency) : undefined,
    }));

    // 9) Return shape matching the dashboard expectations
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
