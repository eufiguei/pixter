import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { getServerSession } from "next-auth/next"; // Import getServerSession
import { authOptions } from "@/lib/auth/options"; // Import your NextAuth options

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

// Helper function to format amount (cents to BRL string)
function formatAmountForDisplay(amount: number, currency: string): string {
  const numberFormat = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
    currencyDisplay: 'symbol',
  });
  return numberFormat.format(amount / 100);
}

// Helper function to get payment method details
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
  // Instantiate Supabase client for DB access
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    // 1. Verify authentication using NextAuth session
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      console.error('Authentication error in /api/motorista/payments: No active NextAuth session or user ID found.');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Check if user type is motorista (optional but good practice)
    if (session.user.tipo !== 'motorista') {
        console.warn(`User ${session.user.id} with type ${session.user.tipo} attempted to access driver payments.`);
        return NextResponse.json({ error: 'Acesso negado para este tipo de usuário.' }, { status: 403 });
    }

    const userId = session.user.id;

    // 2. Get driver's Stripe Account ID from their profile using Supabase client
    // Use 'stripe_account_id' as the column name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_account_id') // Corrected column name
      .eq('id', userId)
      .eq('tipo', 'motorista') // Redundant check, but safe
      .single();

    if (profileError) {
        console.error('Error fetching driver profile:', profileError);
        return NextResponse.json({ error: 'Erro ao buscar perfil do motorista.' }, { status: 500 });
    }

    if (!profile?.stripe_account_id) { // Corrected property name
      console.warn(`Stripe Account ID not found for driver ${userId}`);
      return NextResponse.json({ error: 'Conta Stripe não encontrada ou não conectada.' }, { status: 404 });
    }

    const stripeAccountId = profile.stripe_account_id; // Corrected variable name

    // 3. Fetch payments (PaymentIntents) from Stripe for the connected account
    const params: Stripe.PaymentIntentListParams = {
      limit: 100,
      expand: ['data.latest_charge'],
    };

    // Add date filtering
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

    // Fetch Payment Intents made ON the connected account
    const paymentIntents = await stripe.paymentIntents.list(params, {
      stripeAccount: stripeAccountId, // Use the correct variable
    });

    // 4. Format the payments data
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
    console.error('Error fetching Stripe payments for driver:', error);
    if (error.type === 'StripeInvalidRequestError' && error.message.includes('No such account')) {
        return NextResponse.json({ error: 'Conta Stripe inválida ou não encontrada.' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error.message || 'Erro interno ao buscar pagamentos do Stripe' },
      { status: 500 }
    );
  }
}

