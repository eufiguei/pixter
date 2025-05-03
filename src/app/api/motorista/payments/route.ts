// src/app/api/motorista/payments/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/client';
import Stripe from 'stripe';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

function formatAmountForDisplay(amount: number, currency: string): string {
  const nf = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  });
  return nf.format(amount / 100);
}

export async function GET(request: Request) {
  try {
    // 1) Authenticate via NextAuth
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      console.error('[motorista/payments] No session or user.id');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (session.user.tipo !== 'motorista') {
      console.warn(`[motorista/payments] Wrong user tipo: ${session.user.tipo}`);
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    const userId = session.user.id;

    // 2) Look up the driver’s Stripe account ID in your RLS-protected table
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', userId)
      .eq('tipo', 'motorista')
      .single();
    if (profileError || !profile?.stripe_account_id) {
      console.error('[motorista/payments] Missing Stripe account:', profileError);
      return NextResponse.json(
        { error: 'Conta Stripe não encontrada ou não conectada.' },
        { status: 404 }
      );
    }
    const stripeAccountId = profile.stripe_account_id;

    // 3) Retrieve the connected account’s balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: stripeAccountId,
    });

    // Sum up all “available” amounts (usually just one entry)
    const availableAmount = balance.available.reduce((sum, bucket) => sum + bucket.amount, 0);
    const currency = balance.available[0]?.currency || balance.currency || 'brl';
    const formatted = formatAmountForDisplay(availableAmount, currency);

    // 4) Return it!
    return NextResponse.json({
      balance: formatted,
      raw: {
        available: balance.available,
        pending: balance.pending,
      },
    });
  } catch (err: any) {
    console.error('[motorista/payments] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno ao buscar saldo' },
      { status: 500 }
    );
  }
}
