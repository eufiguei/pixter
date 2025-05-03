// src/app/api/motorista/payments/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { supabaseServer } from "@/lib/supabase/client";

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
  // 1) Authenticate
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (session.user.tipo !== "motorista") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // 2) Look up their connected Stripe account ID
  const userId = session.user.id;
  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", userId)
    .eq("tipo", "motorista")
    .single();

  if (profileError) {
    return NextResponse.json(
      { error: "Erro ao buscar perfil do motorista." },
      { status: 500 }
    );
  }
  const stripeAccountId = profile?.stripe_account_id;
  if (!stripeAccountId) {
    return NextResponse.json(
      { error: "Conta Stripe não configurada." },
      { status: 404 }
    );
  }

  try {
    // 3) Retrieve balances
    const bal = await stripe.balance.retrieve(
      {},
      { stripeAccount: stripeAccountId }
    );

    // 4) Retrieve last 100 balance transactions
    const txList = await stripe.balanceTransactions.list(
      { limit: 100 },
      { stripeAccount: stripeAccountId }
    );

    // 5) Format balance entries
    const available = bal.available.map((b) => ({
      amount: formatAmount(b.amount, b.currency),
      currency: b.currency,
    }));
    const pending = bal.pending.map((b) => ({
      amount: formatAmount(b.amount, b.currency),
      currency: b.currency,
    }));

    // 6) Format transactions
    const transactions = txList.data.map((t) => ({
      id: t.id,
      amount: formatAmount(t.amount, t.currency),
      currency: t.currency,
      description: t.description || null,
      created: new Date(t.created * 1000).toISOString(),
      type: t.type,
      fee: typeof t.fee === "number" ? formatAmount(t.fee, t.currency) : null,
    }));

    // 7) Return
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
