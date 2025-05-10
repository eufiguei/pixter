import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2022-11-15', // Use a recent stable API version
});

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const paymentMethodId = params.id;
    if (!paymentMethodId) {
      return NextResponse.json({ error: 'ID do método de pagamento é obrigatório' }, { status: 400 });
    }

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

    // Fetch user profile to get Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id') // Only need the customer ID
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);
      if (profileError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Erro ao buscar perfil do usuário' }, { status: 500 });
    }

    if (!profile) {
        return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }

    const customerId = profile.stripe_customer_id;

    if (!customerId) {
      // If the user doesn't have a customer ID, they shouldn't have payment methods to delete
      return NextResponse.json(
        { error: 'Cliente Stripe não encontrado para este usuário' },
        { status: 404 }
      );
    }

    // Retrieve the payment method from Stripe to verify ownership
    let paymentMethod: Stripe.PaymentMethod;
    try {
        paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (retrieveError: any) {
        console.error('Stripe retrieve error:', retrieveError);
        // Handle cases where the payment method ID might be invalid or already deleted
        if (retrieveError.code === 'resource_missing') {
            return NextResponse.json({ error: 'Método de pagamento não encontrado no Stripe' }, { status: 404 });
        }
        return NextResponse.json({ error: `Erro ao buscar método de pagamento no Stripe: ${retrieveError.message}` }, { status: 500 });
    }

    // Verify the payment method belongs to the customer
    if (paymentMethod.customer !== customerId) {
      console.warn(`User ${userId} attempted to delete payment method ${paymentMethodId} not belonging to their Stripe customer ${customerId}`);
      return NextResponse.json(
        { error: 'Método de pagamento não pertence a este cliente' },
        { status: 403 } // Forbidden
      );
    }

    // Detach the payment method from the customer
    await stripe.paymentMethods.detach(paymentMethodId);

    // Optional: Check if the detached payment method was the default and clear it in the profile
    const { data: currentProfile, error: fetchDefaultError } = await supabase
        .from('profiles')
        .select('default_payment_method')
        .eq('id', userId)
        .single();

    if (!fetchDefaultError && currentProfile?.default_payment_method === paymentMethodId) {
        const { error: updateDefaultError } = await supabase
            .from('profiles')
            .update({ default_payment_method: null })
            .eq('id', userId);
        if (updateDefaultError) {
            console.error('Failed to clear default payment method after detaching:', updateDefaultError);
            // Don't fail the request, but log the error
        }
    }

    return NextResponse.json({
      success: true,
      message: 'Método de pagamento removido com sucesso'
    });

  } catch (error: any) {
    console.error('Erro ao remover método de pagamento:', error);
    if (error.type && error.type.startsWith('Stripe')) {
        return NextResponse.json({ error: `Erro do Stripe: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor ao remover método de pagamento' },
      { status: 500 }
    );
  }
}

