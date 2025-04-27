import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import stripe from '@/lib/stripe/server';

export async function POST(request: Request) {
  try {
    const { driverId, userId, amount, customerEmail } = await request.json();
    
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
    const amountInCents = Math.round(parseFloat(amount) * 100); // Converter para centavos
    
    // Calcular taxa da plataforma (10%)
    const applicationFee = Math.round(amountInCents * 0.1);
    
    // Criar pagamento com PIX
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'brl',
      payment_method_types: ['pix'],
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: driver.stripe_account_id,
      },
      metadata: {
        driverId,
        userId,
        amount: amountInCents.toString(),
      },
      receipt_email: customerEmail,
    });
    
    // Registrar o pagamento no banco de dados
    await supabase.from('pagamentos').insert({
      driver_id: driverId,
      user_id: userId,
      amount: amountInCents / 100, // Converter de centavos para reais
      total_amount: amountInCents / 100,
      stripe_payment_id: paymentIntent.id,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    
    // Obter os detalhes do PIX
    const pixDetails = paymentIntent.next_action?.pix_display_qr_code;
    
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      pixQrCode: pixDetails?.data,
      pixQrCodeImage: pixDetails?.image_url_png,
      expiresAt: pixDetails?.expires_at,
    });
  } catch (error) {
    console.error('Erro ao criar pagamento PIX:', error);
    return NextResponse.json(
      { error: 'Erro ao processar pagamento PIX' },
      { status: 500 }
    );
  }
}
