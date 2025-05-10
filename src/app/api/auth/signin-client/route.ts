import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Sign in the user
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Error signing in:', error);
      // Provide a more generic error message for security
      return NextResponse.json(
        { error: 'Credenciais inválidas. Verifique seu email e senha.' },
        { status: 401 } // Unauthorized
      );
    }

    // Session is automatically handled by Auth Helpers middleware.
    // Return success, no need to return the session object here.
    return NextResponse.json({
      success: true,
      message: 'Login realizado com sucesso',
      // Optionally return minimal user info if needed immediately
      // user: { id: data.user.id, email: data.user.email }
    });

  } catch (error: any) {
    console.error('Erro geral no signin-client:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}

