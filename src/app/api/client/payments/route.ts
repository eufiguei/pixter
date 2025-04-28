import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export async function GET(request: Request) {
  try {
    // Verificar autenticação
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Buscar pagamentos do usuário
    const { data: payments, error } = await supabase
      .from('pagamentos')
      .select(`
        id,
        amount,
        tip_amount,
        total_amount,
        payment_method,
        status,
        created_at,
        profiles:driver_id (nome)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar pagamentos:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar pagamentos' },
        { status: 500 }
      );
    }
    
    // Formatar os dados para retornar
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      tip_amount: payment.tip_amount || 0,
      total_amount: payment.total_amount,
      payment_method: payment.payment_method,
      status: payment.status,
      created_at: payment.created_at,
      driver_name: payment.profiles?.nome || 'Motorista'
    }));
    
    return NextResponse.json({ payments: formattedPayments });
  } catch (error: any) {
    console.error('Erro ao buscar pagamentos:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar pagamentos' },
      { status: 500 }
    );
  }
}
