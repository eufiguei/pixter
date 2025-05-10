import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const requestUrl = new URL(request.url);

  try {
    const body = await request.json();
    const { name, email, password, celular, cpf } = body;

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nome, email e senha são obrigatórios" },
        { status: 400 }
      );
    }

    // Prepare data for Supabase trigger (handle_new_user)
    const profileData = {
      nome: name,
      tipo: "cliente",
      email: email,
      celular: celular || null,
      cpf: cpf || null,
      account: "email", // Track this as an email account
    };

    // Update the redirect URL to use the callback route
    const redirectTo = `${requestUrl.origin}/auth/callback`;

    // Sign up the user using Auth Helpers
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: profileData,
        emailRedirectTo: redirectTo,
      },
    });

    // Log the response for debugging
    console.log(
      "Supabase signup response:",
      JSON.stringify({
        user: authData?.user
          ? { id: authData.user.id, email: authData.user.email }
          : null,
        error: authError ? { message: authError.message } : null,
      })
    );

    if (authError) {
      console.error("Supabase signup error:", authError);
      if (authError.message.includes("User already registered")) {
        const { error: resendError } = await supabase.auth.resend({
          type: "signup",
          email,
          options: {
            emailRedirectTo: redirectTo,
          },
        });

        if (resendError) {
          console.error("Error resending confirmation email:", resendError);
          return NextResponse.json(
            {
              error: `Usuário já registrado. Falha ao reenviar email de confirmação: ${resendError.message}`,
            },
            { status: 400 }
          );
        } else {
          return NextResponse.json(
            {
              success: true,
              message:
                "Este email já está registrado. Um novo email de confirmação foi enviado (verifique sua caixa de spam).",
            },
            { status: 200 }
          );
        }
      }
      return NextResponse.json(
        { error: "Erro ao criar usuário. Verifique os dados fornecidos." },
        { status: 400 }
      );
    }

    if (!authData.user) {
      console.error("Supabase signup succeeded but returned no user object.");
      return NextResponse.json(
        { error: "Falha inesperada ao iniciar o cadastro." },
        { status: 500 }
      );
    }

    // For existing users that already have a profile, make sure we
    // update the account type
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          account: "email",
        })
        .eq("id", authData.user.id);

      if (updateError) {
        console.error("Error updating profile:", updateError);
        // Continue despite update error
      }
    } catch (err) {
      console.error("Profile update error:", err);
      // Continue despite update error
    }

    console.log("Client signup initiated successfully for:", email);
    return NextResponse.json({
      success: true,
      message:
        "Cadastro iniciado! Verifique seu email (incluindo pasta de spam) para confirmar sua conta.",
    });
  } catch (error: any) {
    console.error("Erro geral no signup-client:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "JSON inválido no corpo da requisição",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Erro interno no servidor ao criar usuário" },
      { status: 500 }
    );
  }
}