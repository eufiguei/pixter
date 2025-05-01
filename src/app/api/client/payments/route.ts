import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Note: Stripe is not used in this GET route, so it's removed for clarity.

export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // Check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return NextResponse.json({ error: 'Erro interno ao verificar sessão' }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch payments for the user using the route handler client
    // Included driver's name via join
    const { data: payments, error } = await supabase
      .from('pagamentos') // Ensure this table name is correct
      .select(`
        id,
        amount,
        tip_amount,
        total_amount,
        payment_method_details, // Assuming this column stores card brand/last4
        status,
        created_at,
        driver_profile:driver_id ( nome ) 
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar pagamentos:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar histórico de pagamentos' },
        { status: 500 }
      );
    }

    // Format the data for the response
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      amount: payment.amount / 100, // Assuming amount is in cents
      tip_amount: (payment.tip_amount || 0) / 100, // Assuming tip is in cents
      total_amount: payment.total_amount / 100, // Assuming total is in cents
      payment_method_details: payment.payment_method_details, // e.g., { brand: 'visa', last4: '4242' }
      status: payment.status,
      created_at: payment.created_at,
      driver_name: payment.driver_profile?.nome || 'N/A' // Extract driver name
    }));

    return NextResponse.json({ payments: formattedPayments });

  } catch (error: any) {
    console.error('Erro geral ao buscar pagamentos:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor ao buscar pagamentos' },
      { status: 500 }
    );
  }
}

