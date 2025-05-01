import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

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
      email: email, // Include email in profile data if needed
      celular: celular, // Include optional fields
      cpf: cpf
    };
    // Remove undefined fields
    Object.keys(profileData).forEach(key => (profileData as any)[key] === undefined && delete (profileData as any)[key]);


    // Sign up the user using Auth Helpers
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Pass profile data to be used by the handle_new_user trigger in Supabase
        data: profileData,
        // Optional: Specify email redirect URL for confirmation link
        // emailRedirectTo: `${request.url.origin}/auth/callback`,
      }
    });

    if (authError) {
      console.error('Supabase signup error:', authError);

      // Handle specific error: User already registered
      if (authError.message.includes('User already registered')) {
         // Attempt to resend the confirmation email
         const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
         if (resendError) {
            console.error('Error resending confirmation email:', resendError);
            // Return the original error if resend fails
            return NextResponse.json({ error: `Usuário já registrado. Falha ao reenviar email de confirmação: ${resendError.message}` }, { status: 400 });
         } else {
            // Inform user that email exists and confirmation was resent
            return NextResponse.json({ success: false, message: 'Este email já está registrado. Um novo email de confirmação foi enviado (verifique sua caixa de spam).' }, { status: 200 }); // Use 200 OK but indicate action needed
         }
      }

      // Return generic error for other signup issues
      return NextResponse.json(
        { error: 'Erro ao criar usuário. Verifique os dados fornecidos.' },
        { status: 400 }
      );
    }

    // Check if user object exists (successful signup initiation)
    if (!authData.user) {
        console.error('Supabase signup succeeded but returned no user object.');
        return NextResponse.json(
            { error: 'Falha inesperada ao iniciar o cadastro.' },
            { status: 500 }
        );
    }

    // IMPORTANT: Profile creation is handled by the `handle_new_user` trigger in Supabase.
    // Do NOT manually insert profile here.
    // Do NOT sign in the user here; they must confirm their email first.

    console.log('Client signup initiated successfully for:', email);
    return NextResponse.json({
      success: true,
      message: 'Cadastro iniciado! Verifique seu email (incluindo pasta de spam) para confirmar sua conta.',
      // Do not return session data here
    });

  } catch (error: any) {
    console.error('Erro geral no signup-client:', error);
    if (error instanceof SyntaxError) { // Handle invalid JSON
        return NextResponse.json({ error: 'JSON inválido no corpo da requisição' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor ao criar usuário' },
      { status: 500 }
    );
  }
}

