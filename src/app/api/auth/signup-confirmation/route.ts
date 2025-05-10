import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const requestUrl = new URL(request.url);

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email é obrigatório" },
        { status: 400 }
      );
    }

    // Check if there's a logged-in user with confirmed email
    let isEmailConfirmed = false;

    try {
      // First check if there's a logged-in user in Supabase
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (!authError && authData?.user) {
        // If email matches the request and is already confirmed
        if (authData.user.email === email && authData.user.email_confirmed_at) {
          isEmailConfirmed = true;
        }
      }
    } catch (err) {
      console.error("Error checking user in Supabase:", err);
      // Continue even if this check fails
    }

    // If email is already confirmed, return an error
    if (isEmailConfirmed) {
      return NextResponse.json(
        { error: "Este email já está verificado. Tente fazer login." },
        { status: 400 }
      );
    }

    // Update redirect URL to use the callback route
    const redirectTo = `${requestUrl.origin}/auth/callback`;

    // Resend confirmation email
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    console.log(
      "Resend confirmation email result:",
      error ? `Error: ${error.message}` : "Success"
    );

    if (error) {
      console.error("Error resending confirmation email:", error);

      // Handle rate limiting
      if (error.message.includes("Email rate limit")) {
        return NextResponse.json(
          {
            error:
              "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
          },
          { status: 429 }
        );
      }

      // Handle non-existent user
      if (
        error.message.includes("User not found") ||
        error.message.includes("Invalid user")
      ) {
        return NextResponse.json(
          { error: "Email não encontrado. Por favor, crie uma conta." },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: error.message || "Falha ao reenviar email de confirmação" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Email de confirmação reenviado com sucesso! Verifique sua caixa de entrada e pasta de spam.",
    });
  } catch (error: any) {
    console.error("Error in signup-confirmation endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno no servidor" },
      { status: 500 }
    );
  }
}
