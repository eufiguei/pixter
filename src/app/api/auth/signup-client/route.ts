import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const requestUrl = new URL(request.url); // Get the request URL to determine the origin

  try {
    const body = await request.json();
    const { name, email, password, celular, cpf } = body; // Include optional fields

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Prepare data for Supabase trigger (handle_new_user)
    const profileData = {
      nome: name,
      tipo: 'cliente',
      email: email,
      celular: celular,
      cpf: cpf
    };
    Object.keys(profileData).forEach(key => (profileData as any)[key] === undefined && delete (profileData as any)[key]);

    // Determine the redirect URL (client dashboard)
    const redirectTo = `${requestUrl.origin}/cliente/dashboard`; // Redirect to client dashboard after confirmation

    // Sign up the user using Auth Helpers
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: profileData,
        // Add the emailRedirectTo option
        emailRedirectTo: redirectTo,
      }
    });

    if (authError) {
      console.error('Supabase signup error:', authError);
      if (authError.message.includes('User already registered')) {
         const { error: resendError } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo } }); // Add redirectTo to resend as well
         if (resendError) {
            console.error('Error resending confirmation email:', resendError);
            return NextResponse.json({ error: `Usuário já registrado. Falha ao reenviar email de confirmação: ${resendError.message}` }, { status: 400 });
         } else {
            return NextResponse.json({ success: true, message: 'Este email já está registrado. Um novo email de confirmação foi enviado (verifique sua caixa de spam).' }, { status: 200 }); // Changed success to true as action was taken
         }
      }
      return NextResponse.json(
        { error: 'Erro ao criar usuário. Verifique os dados fornecidos.' },
        { status: 400 }
      );
    }

    if (!authData.user) {
        console.error('Supabase signup succeeded but returned no user object.');
        return NextResponse.json(
            { error: 'Falha inesperada ao iniciar o cadastro.' },
            { status: 500 }
        );
    }

    console.log('Client signup initiated successfully for:', email);
    return NextResponse.json({
      success: true,
      message: 'Cadastro iniciado! Verifique seu email (incluindo pasta de spam) para confirmar sua conta.',
    });

  } catch (error: any) {
    console.error('Erro geral no signup-client:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'JSON inválido no corpo da requisição' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor ao criar usuário' },
      { status: 500 }
    );
  }
}

