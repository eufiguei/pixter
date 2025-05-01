import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // Use auth helpers for server-side auth
import { cookies } from 'next/headers'; // Import cookies
import Stripe from 'stripe'; // Import Stripe namespace for types

// Initialize Stripe client here, assuming STRIPE_SECRET_KEY is set in environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16', // Use a recent stable API version
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
    // Add other types as needed (e.g., Apple Pay might show as 'card')
    default:
      return details.type;
  }
}

export async function GET(request: Request) {
  const cookieStore = cookies();
  // Correctly instantiate the client with the cookies function
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate'); // For Task 2.8
  const endDate = searchParams.get('endDate'); // For Task 2.8

  try {
    // 1. Verify authentication using the correctly instantiated client
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      // Log the specific error if available
      console.error('Authentication error in /api/motorista/payments:', sessionError?.message || 'No active session');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Get driver's Stripe Account ID from their profile using the same supabase client
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_connect_id') // Changed from stripe_account_id based on previous fixes
      .eq('id', userId)
      .eq('tipo', 'motorista') // Ensure it's a driver profile
      .single();

    if (profileError) {
        console.error('Error fetching driver profile:', profileError);
        return NextResponse.json({ error: 'Erro ao buscar perfil do motorista.' }, { status: 500 });
    }
    
    if (!profile?.stripe_connect_id) {
      console.warn(`Stripe Connect ID not found for driver ${userId}`);
      return NextResponse.json({ error: 'Conta Stripe não encontrada ou não conectada.' }, { status: 404 });
    }

    const stripeConnectAccountId = profile.stripe_connect_id;

    // 3. Fetch payments (PaymentIntents) from Stripe for the connected account
    const params: Stripe.PaymentIntentListParams = {
      limit: 100, // Adjust limit as needed
      expand: ['data.latest_charge'], // Expand charge object to get details
      // We will fetch PaymentIntents created *on* the connected account
    };

    // Add date filtering (Task 2.8)
    let createdFilter: Stripe.RangeQueryParam | undefined = undefined;
    if (startDate) {
      if (!createdFilter) createdFilter = {};
      createdFilter.gte = Math.floor(new Date(startDate).getTime() / 1000);
    }
    if (endDate) {
      // Add 1 day to endDate to include the whole day
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
      stripeAccount: stripeConnectAccountId, // Make the request AS the connected account
    });

    // 4. Format the payments data for the frontend
    const formattedPayments = paymentIntents.data
      .filter(pi => pi.status === 'succeeded' && pi.latest_charge) // Ensure payment succeeded and charge exists
      .map(pi => {
        const charge = pi.latest_charge as Stripe.Charge; // Type assertion
        return {
          id: pi.id,
          data: new Date(pi.created * 1000).toISOString(), // Use PI creation time
          valor: formatAmountForDisplay(pi.amount_received, pi.currency), // Amount received by connected account
          valor_original: formatAmountForDisplay(pi.amount, pi.currency), // Original amount before fees
          metodo: getPaymentMethodDetails(charge),
          // cliente: charge.billing_details?.name || charge.billing_details?.email || 'Cliente Anônimo',
          // Recibo link needs to be generated - placeholder for now (Task 3.4)
          recibo_id: charge.id, // Use charge ID for potential receipt lookup
          status: pi.status,
        };
      });

    return NextResponse.json({ payments: formattedPayments });

  } catch (error: any) {
    console.error('Error fetching Stripe payments for driver:', error);
    // Check for specific Stripe errors (e.g., invalid account)
    if (error.type === 'StripeInvalidRequestError' && error.message.includes('No such account')) {
        return NextResponse.json({ error: 'Conta Stripe inválida ou não encontrada.' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error.message || 'Erro interno ao buscar pagamentos do Stripe' },
      { status: 500 }
    );
  }
}

