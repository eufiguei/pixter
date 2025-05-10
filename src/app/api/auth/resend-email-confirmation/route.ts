import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

    // Get the server session to check the logged in user
    // const session = await getServerSession(authOptions);

    // First, try to get the user from Supabase using the public API
    const { data: authData, error: authError } = await supabase.auth.getUser();

    // Check if the user exists in Supabase
    if (authError) {
      console.error("Error getting user:", authError);
    }

    // Check if the email matches the logged-in user
    if (authData?.user && authData.user.email === email) {
      // Check if email is already confirmed
      if (authData.user.email_confirmed_at) {
        return NextResponse.json(
          { error: "Este email já está verificado. Tente fazer login." },
          { status: 400 }
        );
      }
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
    console.log("Resend confirmation email error:", error);

    if (error) {
      console.error("Error resending confirmation email:", error);
      if (error.message.includes("Email rate limit")) {
        return NextResponse.json(
          {
            error:
              "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
          },
          { status: 429 }
        );
      }

      // If the user doesn't exist, Supabase will return an error
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
    console.error("Error in resend-confirmation endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno no servidor" },
      { status: 500 }
    );
  }
}
