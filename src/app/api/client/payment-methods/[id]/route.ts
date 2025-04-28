import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const paymentMethodId = params.id;
    
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
      return NextResponse.json(
        { error: 'Cliente não encontrado no Stripe' },
        { status: 404 }
      );
    }
    
    // Verificar se o método de pagamento pertence ao cliente
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    if (paymentMethod.customer !== customerId) {
      return NextResponse.json(
        { error: 'Método de pagamento não pertence a este cliente' },
        { status: 403 }
      );
    }
    
    // Desanexar o método de pagamento do cliente
    await stripe.paymentMethods.detach(paymentMethodId);
    
    return NextResponse.json({
      success: true,
      message: 'Método de pagamento removido com sucesso'
    });
  } catch (error: any) {
    console.error('Erro ao remover método de pagamento:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao remover método de pagamento' },
      { status: 500 }
    );
  }
}
