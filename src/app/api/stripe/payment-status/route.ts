import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/client'; // Use admin client for DB updates
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16', // Use a recent stable API version
});

export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore }); // For auth check

  try {
    // 1. Check Authentication (Optional but recommended for security)
    // Although this might be called after redirect, verifying the user session adds a layer of security.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.warn('Payment status check without active session:', sessionError);
      // Allow proceeding but log it, as Stripe session ID is the primary identifier here.
      // If stricter security is needed, return 401 here.
      // return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const userId = session?.user?.id; // User might not be logged in if they closed browser

    // 2. Get Stripe Session ID from URL
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'ID da sessão Stripe não fornecido' },
        { status: 400 }
      );
    }

    // 3. Retrieve Stripe Checkout Session
    let stripeSession: Stripe.Checkout.Session;
    try {
      stripeSession = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'], // Expand payment intent for more details
      });
    } catch (stripeError: any) {
      console.error('Stripe session retrieve error:', stripeError);
      if (stripeError.code === 'resource_missing') {
        return NextResponse.json({ error: 'Sessão de pagamento não encontrada no Stripe' }, { status: 404 });
      }
      return NextResponse.json({ error: `Erro ao buscar sessão no Stripe: ${stripeError.message}` }, { status: 500 });
    }

    // 4. Extract Relevant Information
    const paymentStatus = stripeSession.status; // 'open', 'complete', 'expired'
    const paymentIntent = stripeSession.payment_intent as Stripe.PaymentIntent | null;
    const paymentIntentStatus = paymentIntent?.status; // 'succeeded', 'processing', 'requires_payment_method', etc.
    const paymentIntentId = typeof stripeSession.payment_intent === 'string' ? stripeSession.payment_intent : paymentIntent?.id;

    // 5. Check and Update Database Record (using Admin client)
    // Use the Checkout Session ID as the primary link
    const { data: paymentRecord, error: dbError } = await supabaseAdmin
      .from('pagamentos')
      .select('status, user_id') // Select current status and user_id for verification
      .eq('id', sessionId) // Assuming 'id' column stores the checkout session ID
      .single();

    if (dbError) {
      console.error('Error fetching payment record from DB:', dbError);
      // Log error but proceed to return Stripe status to the user
    }

    // Security Check: Verify user ID if possible
    if (userId && paymentRecord && paymentRecord.user_id !== userId) {
        console.error(`User mismatch: Session user ${userId} trying to check status for payment belonging to ${paymentRecord.user_id}`);
        return NextResponse.json({ error: 'Acesso negado a este registro de pagamento' }, { status: 403 });
    }

    // Determine the definitive status based on Stripe
    let definitiveStatus = 'pending'; // Default
    if (paymentStatus === 'complete' && paymentIntentStatus === 'succeeded') {
      definitiveStatus = 'succeeded';
    } else if (paymentStatus === 'expired') {
      definitiveStatus = 'failed'; // Or 'expired'
    } else if (paymentIntentStatus === 'requires_payment_method' || paymentIntentStatus === 'canceled') {
      definitiveStatus = 'failed';
    }

    // Update DB only if status has changed and record exists
    if (paymentRecord && paymentRecord.status !== definitiveStatus) {
      const { error: updateError } = await supabaseAdmin
        .from('pagamentos')
        .update({
          status: definitiveStatus,
          stripe_payment_intent_id: paymentIntentId, // Ensure PI ID is stored
          payment_method_details: paymentIntent?.payment_method ? await getPaymentMethodDetails(paymentIntent.payment_method as string) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('Error updating payment status in DB:', updateError);
        // Log error but don't block response
      }
    }

    // 6. Return Status Information
    return NextResponse.json({
      paymentStatus: definitiveStatus, // Return our determined status
      stripeCheckoutStatus: paymentStatus,
      stripePaymentIntentStatus: paymentIntentStatus,
      paymentIntentId: paymentIntentId,
      amountTotal: stripeSession.amount_total ? stripeSession.amount_total / 100 : null,
      customerEmail: stripeSession.customer_details?.email,
      // Include metadata if needed
      metadata: stripeSession.metadata,
    });

  } catch (error: any) {
    console.error('Erro geral ao verificar status do pagamento:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao verificar status do pagamento' },
      { status: 500 }
    );
  }
}

// Helper to get basic payment method details (card brand/last4)
async function getPaymentMethodDetails(paymentMethodId: string): Promise<object | null> {
    try {
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (paymentMethod.card) {
            return {
                brand: paymentMethod.card.brand,
                last4: paymentMethod.card.last4,
                exp_month: paymentMethod.card.exp_month,
                exp_year: paymentMethod.card.exp_year,
            };
        }
        // Add checks for other payment method types if needed
        return { type: paymentMethod.type }; // Return type if not card
    } catch (error) {
        console.error(`Failed to retrieve payment method ${paymentMethodId}:`, error);
        return null;
    }
}

