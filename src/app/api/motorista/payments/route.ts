// src/app/api/motorista/payments/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/client';
import Stripe from 'stripe';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

function formatAmountForDisplay(amount: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  }).format(amount / 100);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate   = searchParams.get('endDate');

  // 1. Authenticate via NextAuth
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  if (session.user.tipo !== 'motorista') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }
  const userId = session.user.id;

  // 2. Fetch the driver's stripe_account_id from your profiles table
  const { data: profile, error: profileError } = await supabaseServer
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', userId)
    .eq('tipo', 'motorista')
    .single();

  if (profileError || !profile?.stripe_account_id) {
    return NextResponse.json(
      { error: 'Perfil de motorista inválido ou sem Stripe conectado.' },
      { status: 404 }
    );
  }
  const stripeAccountId = profile.stripe_account_id;

  try {
    // 3. Retrieve current balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: stripeAccountId,
    });

    // 4. Optionally list transactions if date filters are provided
    let transactions: Stripe.BalanceTransaction[] = [];
    if (startDate || endDate) {
      const txParams: Stripe.BalanceTransactionListParams = {};
      const created: Stripe.RangeQueryParam = {};

      if (startDate) {
        created.gte = Math.floor(new Date(startDate).getTime() / 1000);
      }
      if (endDate) {
        const eod = new Date(endDate);
        eod.setDate(eod.getDate() + 1);
        created.lt = Math.floor(eod.getTime() / 1000);
      }
      txParams.created = created;

      const txList = await stripe.balanceTransactions.list(txParams, {
        stripeAccount: stripeAccountId,
        limit: 100,
      });
      transactions = txList.data;
    }

    // 5. Format response
    const formattedBalance = {
      available: balance.available.map((b) => ({
        amount: formatAmountForDisplay(b.amount, b.currency),
        currency: b.currency,
      })),
      pending: balance.pending.map((b) => ({
        amount: formatAmountForDisplay(b.amount, b.currency),
        currency: b.currency,
      })),
    };

    const formattedTransactions = transactions.map((tx) => ({
      id:         tx.id,
      amount:     formatAmountForDisplay(tx.amount, tx.currency),
      currency:   tx.currency,
      description: tx.description,
      created:    new Date(tx.created * 1000).toISOString(),
      type:       tx.type,
      fee:        tx.fee ? formatAmountForDisplay(tx.fee, tx.currency) : undefined,
    }));

    return NextResponse.json({
      balance:      formattedBalance,
      transactions: formattedTransactions,
    });
  } catch (err: any) {
    console.error('Error fetching Stripe balance/transactions:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno ao buscar informações de pagamento' },
      { status: 500 }
    );
  }
}
