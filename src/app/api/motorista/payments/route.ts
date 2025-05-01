import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/client'; // Use server-side Supabase client
import Stripe from 'stripe';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

function formatAmountForDisplay(amount: number, currency: string): string {
  const numberFormat = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
    currencyDisplay: 'symbol',
  });
  return numberFormat.format(amount / 100);
}

function getPaymentMethodDetails(charge: any): string {
  if (!charge?.payment_method_details) return 'Desconhecido';
  const details = charge.payment_method_details;
  switch (details.type) {
    case 'card':
      return `Cartão ${details.card?.brand} final ${details.card?.last4}`;
    case 'pix':
      return 'Pix';
    case 'boleto':
      return 'Boleto';
    default:
      return details.type;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      console.error('[motorista/payments] Authentication error: No active NextAuth session or user ID found.');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (session.user.tipo !== 'motorista') {
      console.warn(`[motorista/payments] User ${session.user.id} with type ${session.user.tipo} attempted to access driver payments.`);
      return NextResponse.json({ error: 'Acesso negado para este tipo de usuário.' }, { status: 403 });
    }

    const userId = session.user.id;
    console.log(`[motorista/payments] Attempting to fetch profile for userId: ${userId}`);

    // Use supabaseServer to avoid RLS blocking
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', userId)
      .eq('tipo', 'motorista')
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        console.warn(`[motorista/payments] Driver profile not found for user ID: ${userId}. Query returned 0 rows.`);
        return NextResponse.json({ error: 'Perfil de motorista não encontrado ou não configurado corretamente.' }, { status: 404 });
      }
      console.error('[motorista/payments] Error fetching driver profile:', profileError);
      return NextResponse.json({ error: 'Erro ao buscar perfil do motorista.' }, { status: 500 });
    }

    if (!profile?.stripe_account_id) {
      console.warn(`[motorista/payments] Stripe Account ID not found on profile for driver ${userId}`);
      return NextResponse.json({ error: 'Conta Stripe não encontrada ou não conectada ao perfil.' }, { status: 404 });
    }

    const stripeAccountId = profile.stripe_account_id;
    console.log(`[motorista/payments] Found Stripe Account ID: ${stripeAccountId} for user: ${userId}`);

    const params: Stripe.PaymentIntentListParams = {
      limit: 100,
      expand: ['data.latest_charge'],
    };

    let createdFilter: Stripe.RangeQueryParam | undefined = undefined;
    if (startDate) {
      if (!createdFilter) createdFilter = {};
      createdFilter.gte = Math.floor(new Date(startDate).getTime() / 1000);
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setDate(endOfDay.getDate() + 1);
      if (!createdFilter) createdFilter = {};
      createdFilter.lt = Math.floor(endOfDay.getTime() / 1000);
    }
    if (createdFilter) {
      params.created = createdFilter;
    }

    console.log(`[motorista/payments] Fetching Stripe PaymentIntents for account ${stripeAccountId} with params:`, JSON.stringify(params));
    const paymentIntents = await stripe.paymentIntents.list(params, {
      stripeAccount: stripeAccountId,
    });
    console.log(`[motorista/payments] Received ${paymentIntents.data.length} PaymentIntents from Stripe.`);

    const formattedPayments = paymentIntents.data
      .filter(pi => {
        const isSucceeded = pi.status === 'succeeded';
        const hasCharge = !!pi.latest_charge;
        if (!isSucceeded || !hasCharge) {
          console.log(`[motorista/payments] Filtering out PI ${pi.id}: status=${pi.status}, hasCharge=${hasCharge}`);
        }
        return isSucceeded && hasCharge;
      })
      .map(pi => {
        const charge = pi.latest_charge as Stripe.Charge;
        const clientName = charge.billing_details?.name || charge.customer ? `Customer ${charge.customer}` : '-';

        return {
          id: pi.id,
          data: new Date(pi.created * 1000).toISOString(),
          valor: formatAmountForDisplay(pi.amount_received, pi.currency),
          valor_original: formatAmountForDisplay(pi.amount, pi.currency),
          metodo: getPaymentMethodDetails(charge),
          recibo_id: charge.id,
          status: pi.status,
          cliente: clientName,
        };
      });

    console.log(`[motorista/payments] Returning ${formattedPayments.length} formatted payments.`);
    return NextResponse.json({ payments: formattedPayments });

  } catch (error: any) {
    console.error('[motorista/payments] Error in GET handler:', error);
    if (error.type === 'StripeInvalidRequestError' && error.message.includes('No such account')) {
      return NextResponse.json({ error: 'Conta Stripe inválida ou não encontrada.' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Erro interno ao buscar pagamentos do Stripe' }, { status: 500 });
  }
}