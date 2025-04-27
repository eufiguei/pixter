// /src/app/api/stripe/create-payment/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export async function POST(request: Request) {
  try {
    const { driverId, userId, amount, tipAmount = 0 } = await request.json();
    
    // Buscar dados do motorista
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();
      
    if (driverError || !driver) {
      return NextResponse.json(
        { error: 'Motorista não encontrado' },
        { status: 404 }
      );
    }
    
    if (!driver.stripe_account_id) {
      return NextResponse.json(
        { error: 'Motorista não possui conta Stripe' },
        { status: 400 }
      );
    }
    
    // Calcular valores
    const baseAmount = Math.round(parseFloat(amount) * 100); // Converter para centavos
    const tipAmountCents = Math.round(parseFloat(tipAmount) * 100);
    const totalAmount = baseAmount + tipAmountCents;
    
    // Calcular taxa da plataforma (10%)
    const applicationFee = Math.round(baseAmount * 0.1);
    
    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: 'Corrida Pixter',
              description: `Pagamento para motorista ${driver.name}`,
            },
            unit_amount: baseAmount,
          },
          quantity: 1,
        },
        tipAmountCents > 0 ? {
          price_data: {
            currency: 'brl',
            product_data: {
              name: 'Gorjeta',
              description: 'Gorjeta para o motorista',
            },
            unit_amount: tipAmountCents,
          },
          quantity: 1,
        } : undefined,
      ].filter(Boolean),
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_URL}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/pagamento/cancelado`,
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: driver.stripe_account_id,
        },
        metadata: {
          driverId,
          userId,
          baseAmount: baseAmount.toString(),
          tipAmount: tipAmountCents.toString(),
          totalAmount: totalAmount.toString(),
        },
      },
    });
    
    // Registrar o pagamento no banco de dados
    await supabase.from('pagamentos').insert({
      driver_id: driverId,
      user_id: userId,
      amount: baseAmount / 100, // Converter de centavos para reais
      tip_amount: tipAmountCents / 100,
      total_amount: totalAmount / 100,
      stripe_payment_id: session.id,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao processar pagamento' },
      { status: 500 }
    );
  }
}
