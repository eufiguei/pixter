import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import stripe from '@/lib/stripe/server';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') || '';
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    console.error('Erro na assinatura do webhook:', err);
    return NextResponse.json(
      { error: 'Assinatura inválida' },
      { status: 400 }
    );
  }
  
  try {
    // Processar eventos
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'account.updated':
        await handleAccountUpdated(event.data.object);
        break;
      default:
        console.log(`Evento não tratado: ${event.type}`);
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 500 }
    );
  }
}

// Função para processar pagamentos bem-sucedidos
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    const { id, metadata, amount } = paymentIntent;
    const { driverId } = metadata;
    
    // Atualizar o status do pagamento
    await supabase.from('pagamentos').update({
      status: 'succeeded',
      updated_at: new Date().toISOString()
    }).eq('stripe_payment_id', id);
    
    // Registrar o pagamento no histórico
    await supabase.from('historico_pagamentos').insert({
      stripe_payment_id: id,
      motorista_id: driverId,
      valor: amount / 100, // Converte de centavos para reais
      status: 'succeeded',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao processar pagamento bem-sucedido:', error);
  }
}

// Função para processar atualizações de conta
async function handleAccountUpdated(account) {
  try {
    const { id, metadata, payouts_enabled } = account;
    const { driverId } = metadata;
    
    // Atualiza o status da conta do motorista
    if (driverId) {
      await supabase.from('drivers').update({
        stripe_account_status: account.details_submitted ? 'submitted' : 'pending',
        stripe_account_enabled: account.charges_enabled,
        stripe_account_verified: account.details_submitted,
        stripe_account_payouts_enabled: payouts_enabled,
        updated_at: new Date().toISOString()
      }).eq('id', driverId);
    }
  } catch (error) {
    console.error('Erro ao processar atualização de conta:', error);
  }
}
