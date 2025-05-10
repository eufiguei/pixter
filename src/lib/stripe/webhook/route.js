// /src/app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase/client';

// Desativa o bodyParser para receber o corpo da requisição como stream
export const config = {
  api: {
    bodyParser: false,
  },
};

// Função para ler o corpo da requisição como texto
async function readBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request.body);
    const signature = request.headers.get('stripe-signature');
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });
    
    // Verifica a assinatura do webhook
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }
    
    // Processa o evento
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
        
      case 'account.updated':
        await handleAccountUpdated(event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook:', error);
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 500 }
    );
  }
}

// Função para processar pagamentos bem-sucedidos
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    // Extrai informações do pagamento
    const { id, amount, metadata, payment_method_types } = paymentIntent;
    const { driverId } = metadata;
    
    // Registra o pagamento no banco de dados
    await supabase.from('pagamentos').insert({
      stripe_payment_id: id,
      motorista_id: driverId,
      valor: amount / 100, // Converte de centavos para reais
      metodo: payment_method_types[0],
      status: 'succeeded',
      created_at: new Date().toISOString()
    });
    
    // Processa a transferência para o motorista
    // Isso pode ser feito aqui ou em um job separado
    
  } catch (error) {
    console.error('Erro ao processar pagamento bem-sucedido:', error);
  }
}

// Função para processar atualizações de conta
async function handleAccountUpdated(account) {
  try {
    // Extrai informações da conta
    const { id, metadata, payouts_enabled } = account;
    const { driverId } = metadata;
    
    // Atualiza o status da conta do motorista
    if (driverId) {
      await supabase.from('profiles').update({
        stripe_account_id: id,
        stripe_payouts_enabled: payouts_enabled,
        updated_at: new Date().toISOString()
      }).eq('id', driverId);
    }
    
  } catch (error) {
    console.error('Erro ao processar atualização de conta:', error);
  }
}
