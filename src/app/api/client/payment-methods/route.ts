import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2022-11-15', // Use a recent stable API version
});

export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // Check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return NextResponse.json({ error: 'Erro interno ao verificar sessão' }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch user profile using the route handler client
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, default_payment_method') // Select only needed fields
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);
      // Distinguish between not found and other errors
      if (profileError.code === 'PGRST116') { // PostgREST error code for 'relation does not exist or insufficient privilege'
        return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Erro ao buscar perfil do usuário' }, { status: 500 });
    }

    if (!profile) {
        return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }

    // Check if the user has a Stripe customer ID
    const customerId = profile.stripe_customer_id;

    if (!customerId) {
      // No Stripe customer ID means no saved payment methods
      return NextResponse.json({ paymentMethods: [] });
    }

    // Fetch payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    // Format the data to return only necessary fields
    const formattedPaymentMethods = paymentMethods.data.map(method => ({
      id: method.id,
      card_brand: method.card?.brand,
      last4: method.card?.last4,
      exp_month: method.card?.exp_month,
      exp_year: method.card?.exp_year,
      is_default: method.id === profile.default_payment_method, // Check against profile's default
    }));

    return NextResponse.json({ paymentMethods: formattedPaymentMethods });

  } catch (error: any) {
    console.error('Erro ao buscar métodos de pagamento:', error);
    // Check if it's a Stripe error
    if (error.type && error.type.startsWith('Stripe')) {
        return NextResponse.json({ error: `Erro do Stripe: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor ao buscar métodos de pagamento' },
      { status: 500 }
    );
  }
}

