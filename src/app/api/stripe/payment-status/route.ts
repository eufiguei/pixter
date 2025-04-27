import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import stripe from '@/lib/stripe/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'ID da sessão não fornecido' },
        { status: 400 }
      );
    }
    
    // Verificar status da sessão no Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Verificar status do pagamento no banco de dados
    const { data: payment, error: paymentError } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('stripe_payment_id', sessionId)
      .single();
    
    if (paymentError) {
      console.error('Erro ao buscar pagamento:', paymentError);
    }
    
    // Atualizar status do pagamento se necessário
    if (payment && payment.status !== session.payment_status) {
      await supabase
        .from('pagamentos')
        .update({
          status: session.payment_status,
          updated_at: new Date().toISOString()
        })
        .eq('stripe_payment_id', sessionId);
    }
    
    return NextResponse.json({
      paymentStatus: session.payment_status,
      paymentIntent: session.payment_intent,
      customer: session.customer,
      amount: session.amount_total ? session.amount_total / 100 : null,
    });
  } catch (error) {
    console.error('Erro ao verificar status do pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar status do pagamento' },
      { status: 500 }
    );
  }
}
