import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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

    // Fetch driver profile using the route handler client
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*') // Select all profile fields
      .eq('id', userId)
      .eq('tipo', 'motorista') // Ensure the user is a driver
      .single();

    if (error) {
      console.error('Erro ao buscar perfil do motorista:', error);
      if (error.code === 'PGRST116') { // Not found or insufficient privilege
         return NextResponse.json({ error: 'Perfil de motorista não encontrado ou acesso negado' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Erro ao buscar perfil do motorista' }, { status: 500 });
    }

    if (!profile) {
      // This case might happen if the user exists but their profile type is not 'motorista'
      return NextResponse.json(
        { error: 'Perfil de motorista não encontrado' },
        { status: 404 }
      );
    }

    // Return the complete profile data
    return NextResponse.json(profile);

  } catch (error: any) {
    console.error('Erro geral ao buscar perfil do motorista:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor ao buscar perfil' },
      { status: 500 }
    );
  }
}

// Added PUT method to update profile
export async function PUT(request: Request) {
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
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userId = session.user.id;
    const updates = await request.json();

    // Basic validation for updates (add more as needed)
    if (!updates || Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Nenhum dado fornecido para atualização' }, { status: 400 });
    }

    // Prevent updating critical fields like id or tipo via this endpoint
    delete updates.id;
    delete updates.tipo;
    delete updates.created_at;
    delete updates.stripe_customer_id; // Should be managed elsewhere
    delete updates.default_payment_method; // Should be managed elsewhere

    // Add updated_at timestamp
    updates.updated_at = new Date().toISOString();

    // Update the driver's profile
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .eq('tipo', 'motorista') // Ensure we only update driver profiles
      .select() // Return the updated profile
      .single();

    if (error) {
      console.error('Erro ao atualizar perfil do motorista:', error);
      if (error.code === 'PGRST116') { // Not found or insufficient privilege
         return NextResponse.json({ error: 'Perfil de motorista não encontrado ou acesso negado para atualização' }, { status: 404 });
      }
      // Handle potential constraint violations (e.g., unique CPF)
      if (error.code === '23505') { // unique_violation
          return NextResponse.json({ error: `Falha na atualização: ${error.details}` }, { status: 409 }); // Conflict
      }
      return NextResponse.json({ error: 'Erro ao atualizar perfil do motorista' }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Perfil de motorista não encontrado após atualização' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Perfil atualizado com sucesso', profile: data });

  } catch (error: any) {
    console.error('Erro geral ao atualizar perfil do motorista:', error);
    if (error instanceof SyntaxError) { // Handle invalid JSON in request body
        return NextResponse.json({ error: 'JSON inválido no corpo da requisição' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor ao atualizar perfil' },
      { status: 500 }
    );
  }
}

