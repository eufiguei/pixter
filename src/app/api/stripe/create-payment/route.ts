import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/client'; // Use admin client for secure data access
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16', // Use a recent stable API version
});

const MIN_AMOUNT_BRL = 1.00; // Minimum payment amount in BRL
const PLATFORM_FEE_PERCENTAGE = 0.1; // 10% platform fee

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore }); // For auth check

  try {
    // 1. Check Authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('Authentication error:', sessionError);
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Parse Request Body
    let driverId: string, amount: number, tipAmount: number | undefined;
    try {
      const body = await request.json();
      driverId = body.driverId;
      amount = parseFloat(body.amount);
      tipAmount = body.tipAmount ? parseFloat(body.tipAmount) : 0;
    } catch (e) {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    // 3. Validate Input
    if (!driverId || isNaN(amount) || amount < MIN_AMOUNT_BRL || (tipAmount !== undefined && (isNaN(tipAmount) || tipAmount < 0))) {
      return NextResponse.json(
        { error: `Dados inválidos. Certifique-se que o valor é pelo menos R$${MIN_AMOUNT_BRL.toFixed(2)} e a gorjeta (opcional) é um valor positivo.` },
        { status: 400 }
      );
    }

    // 4. Fetch Driver Profile (using Admin client for security)
    const { data: driverProfile, error: driverError } = await supabaseAdmin
      .from('profiles') // Assuming drivers are in 'profiles' table
      .select('nome, stripe_connect_id') // Select necessary fields
      .eq('id', driverId)
      .eq('tipo', 'motorista')
      .single();

    if (driverError || !driverProfile) {
      console.error('Driver fetch error:', driverError);
      return NextResponse.json({ error: 'Motorista não encontrado' }, { status: 404 });
    }

    const stripeConnectAccountId = driverProfile.stripe_connect_id;
    if (!stripeConnectAccountId) {
      return NextResponse.json(
        { error: 'Motorista não está habilitado para receber pagamentos online.' },
        { status: 400 }
      );
    }

    // 5. Calculate Amounts in Cents
    const baseAmountCents = Math.round(amount * 100);
    const tipAmountCents = Math.round((tipAmount || 0) * 100);
    const totalAmountCents = baseAmountCents + tipAmountCents;
    const applicationFeeCents = Math.round(baseAmountCents * PLATFORM_FEE_PERCENTAGE);

    // 6. Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: 'Pagamento para Motorista',
              description: `Pixter - ${driverProfile.nome || 'Motorista'}`,
              // images: ['your_logo_url'] // Optional: Add your logo
            },
            unit_amount: totalAmountCents, // Charge the total amount as one item
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pagamento/cancelado?driver_id=${driverId}`, // Pass driverId back if needed
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        transfer_data: {
          destination: stripeConnectAccountId,
        },
        metadata: {
          pixter_driver_id: driverId,
          pixter_user_id: userId,
          pixter_base_amount_cents: baseAmountCents.toString(),
          pixter_tip_amount_cents: tipAmountCents.toString(),
          pixter_total_amount_cents: totalAmountCents.toString(),
          pixter_fee_amount_cents: applicationFeeCents.toString(),
        },
      },
      // Optionally prefill customer email if available
      // customer_email: session.user.email,
      metadata: { // Metadata for the Checkout Session itself
          pixter_driver_id: driverId,
          pixter_user_id: userId,
      }
    });

    if (!checkoutSession.url) {
        throw new Error('Falha ao criar URL de checkout do Stripe.');
    }

    // 7. Record Initial Payment Attempt in Database (using Admin client)
    // Status is 'pending' until webhook confirms success/failure
    const { error: insertError } = await supabaseAdmin
      .from('pagamentos') // Ensure table name is correct
      .insert({
        id: checkoutSession.id, // Use Checkout Session ID as primary key for simplicity?
        driver_id: driverId,
        user_id: userId,
        amount: baseAmountCents, // Store in cents
        tip_amount: tipAmountCents,
        total_amount: totalAmountCents,
        application_fee: applicationFeeCents,
        stripe_payment_intent_id: typeof checkoutSession.payment_intent === 'string' ? checkoutSession.payment_intent : null,
        status: 'pending', // Initial status
        created_at: new Date().toISOString(),
        // Store payment method details later via webhook if needed
      });

    if (insertError) {
      console.error('Database insert error after Stripe session creation:', insertError);
      // Don't block the user, but log this critical error
      // Consider alerting/monitoring for this scenario
    }

    // 8. Return Checkout Session URL
    return NextResponse.json({ url: checkoutSession.url });

  } catch (error: any) {
    console.error('Erro ao criar pagamento Stripe:', error);
    let errorMessage = 'Erro interno ao processar pagamento.';
    if (error.type && error.type.startsWith('Stripe')) {
        errorMessage = `Erro do Stripe: ${error.message}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

