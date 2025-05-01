
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // Use auth helpers for server-side auth
import { cookies } from 'next/headers'; // Import cookies
import stripe from '@/lib/stripe/server'; // Import server-side Stripe instance
import { supabaseServer as supabase } from '@/lib/supabase/server';
import Stripe from 'stripe'; // Import Stripe namespace for types

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
  const supabaseAuth = createRouteHandlerClient({ cookies }); // Use auth helpers
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate'); // For Task 2.8
  const endDate = searchParams.get('endDate'); // For Task 2.8

  try {
    // 1. Verify authentication using getUser()
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.error("Authentication error (getUser):", userError);
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userId = user.id;

    // 2. Get driver's Stripe Account ID from their profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.stripe_account_id) {
      console.error('Error fetching profile or Stripe account ID:', profileError);
      return NextResponse.json({ error: 'Conta Stripe não encontrada ou não conectada.' }, { status: 404 });
    }

    const stripeAccountId = profile.stripe_account_id;

    // 3. Fetch payments (Charges or PaymentIntents) from Stripe for the connected account
    // We'll fetch Charges associated with transfers to the connected account.
    // Alternatively, list PaymentIntents with transfer_data.destination = stripeAccountId

    // Option A: List Balance Transactions (often reliable for payouts/fees)
    // const balanceTransactions = await stripe.balanceTransactions.list(
    //   { limit: 100 }, // Add date filters later
    //   { stripeAccount: stripeAccountId } // Perform request as the connected account
    // ); 
    // Filter for type 'charge' or 'payment', expand source object (Charge/PaymentIntent)

    // Option B: List Charges directly (might miss some scenarios depending on integration)
    // Need to know how charges are associated. Let's assume they are direct charges
    // or destination charges where we can filter. Listing transfers might be better.

    // Option C: List Payment Intents (Modern approach)
    const params: Stripe.PaymentIntentListParams = {
      limit: 100, // Adjust limit as needed
      expand: ['data.latest_charge'], // Expand charge object to get details
      // Filter by destination account (requires specific integration setup)
      // transfer_group: '...', // If using transfer_group
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
      stripeAccount: stripeAccountId, // Make the request AS the connected account
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
    console.error('Error fetching Stripe payments:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao buscar pagamentos do Stripe' },
      { status: 500 }
    );
  }
}

