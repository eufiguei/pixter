import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";

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
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      console.error('No session or user ID found.');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log("SESSION DATA:", session);

    // Validate 'tipo'
    if (session.user.tipo !== 'motorista') {
      console.warn(`Access denied for user ID ${session.user.id}, tipo: ${session.user.tipo}`);
      return NextResponse.json({ error: 'Acesso negado para este tipo de usuário.' }, { status: 403 });
    }

    const userId = session.user.id;

    // Fetch profile from Supabase
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', userId)
      .eq('tipo', 'motorista')
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        console.warn(`Driver profile not found for user ID: ${userId}`);
        return NextResponse.json({ error: 'Perfil de motorista não encontrado.' }, { status: 404 });
      }
      console.error('Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Erro ao buscar perfil.' }, { status: 500 });
    }

    if (!profile?.stripe_account_id) {
      console.warn(`No Stripe account linked for user ID: ${userId}`);
      return NextResponse.json({ error: 'Conta Stripe não vinculada.' }, { status: 404 });
    }

    const stripeAccountId = profile.stripe_account_id;

    // Prepare Stripe filters
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
    if (createdFilter) params.created = createdFilter;

    const paymentIntents = await stripe.paymentIntents.list(params, {
      stripeAccount: stripeAccountId,
    });

    const formattedPayments = paymentIntents.data
      .filter(pi => pi.status === 'succeeded' && pi.latest_charge)
      .map(pi => {
        const charge = pi.latest_charge as Stripe.Charge;
        return {
          id: pi.id,
          data: new Date(pi.created * 1000).toISOString(),
          valor: formatAmountForDisplay(pi.amount_received, pi.currency),
          valor_original: formatAmountForDisplay(pi.amount, pi.currency),
          metodo: getPaymentMethodDetails(charge),
          recibo_id: charge.id,
          status: pi.status,
        };
      });

    return NextResponse.json({ payments: formattedPayments });

  } catch (error: any) {
    console.error('Unhandled error:', error);
    if (error.type === 'StripeInvalidRequestError' && error.message.includes('No such account')) {
      return NextResponse.json({ error: 'Conta Stripe inválida.' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
}