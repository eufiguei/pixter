// src/app/api/auth/send-verification/route.ts (Updated for Supabase Built-in OTP & Auth Helpers)
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { formatPhoneNumber } from "@/lib/supabase/client"; // Keep formatPhoneNumber helper

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const body = await request.json();
    const { phone, countryCode = "55" } = body;

    // 1. Validation
    if (!phone) {
      return NextResponse.json(
        { error: "Número de telefone é obrigatório" },
        { status: 400 }
      );
    }

    // 2. Format Phone Number
    const formattedPhone = formatPhoneNumber(phone, countryCode);

    // 3. Use Supabase Auth to send OTP via Route Handler Client
    // This tells Supabase to handle code generation and sending via its configured provider (e.g., Twilio)
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,

      // options: { shouldCreateUser: false } // Optional: prevent creating new users via OTP if they don't exist
    });
    console.log("response from Supabase SignWithOTP:", data);
    
    if (error) {
      console.error("Supabase signInWithOtp error:", error.message);
      // Provide a more generic error to the client
      return NextResponse.json(
        { error: "Falha ao enviar o código de verificação." },
        { status: 500 }
      );
    }

    // IMPORTANT: Supabase handles the code generation and sending.
    // You NO LONGER need to generate a code manually or store it in `verification_codes`.
    console.log("Supabase OTP initiated for:", formattedPhone);
    return NextResponse.json({
      success: true,
      message: "Código enviado com sucesso! Verifique seu Celular/SMS.",
    });
  } catch (error: any) {
    console.error("Erro geral em send-verification:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno no servidor" },
      { status: 500 }
    );
  }
}
