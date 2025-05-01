import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2022-11-15',
});

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Initialize client here
    // Verificar autenticação
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileError || !profile) {
      console.error('Erro ao buscar perfil:', profileError);
      return NextResponse.json(
        { error: 'Perfil não encontrado' },
        { status: 404 }
      );
    }
    
    // Verificar se o usuário tem um customer_id no Stripe
    const customerId = profile.stripe_customer_id;
    
    if (!customerId) {
      return NextResponse.json({ paymentMethods: [] });
    }
    
    // Buscar métodos de pagamento do customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });
    
    // Formatar os dados para retornar apenas o necessário
    const formattedPaymentMethods = paymentMethods.data.map(method => ({
      id: method.id,
      card_brand: method.card?.brand,
      last4: method.card?.last4,
      exp_month: method.card?.exp_month,
      exp_year: method.card?.exp_year,
      is_default: method.id === profile.default_payment_method
    }));
    
    return NextResponse.json({ paymentMethods: formattedPaymentMethods });
  } catch (error: any) {
    console.error('Erro ao buscar métodos de pagamento:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar métodos de pagamento' },
      { status: 500 }
    );
  }
}
