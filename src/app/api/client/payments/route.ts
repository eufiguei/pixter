import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Define an interface for the expected payment structure after the query
interface Payment {
  id: string;
  amount: number;
  tip_amount: number | null;
  total_amount: number;
  payment_method_details: object | null;
  status: string;
  created_at: string;
  driver_profile: { nome: string | null } | null;
}

export async function GET(request: Request) {
  const cookieStore = cookies();
  // Define the type for the Supabase client with the database schema
  // Replace 'any' with your actual Database type if generated
  const supabase = createRouteHandlerClient<any>({ cookies: () => cookieStore });

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
    // Removed the comment from the select string
    const { data: payments, error } = await supabase
      .from('pagamentos') // Ensure this table name is correct
      .select(`
        id,
        amount,
        tip_amount,
        total_amount,
        payment_method_details,
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

    // Ensure payments is treated as an array of Payment objects
    const typedPayments = payments as Payment[];

    // Format the data for the response
    const formattedPayments = typedPayments.map(payment => ({
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

