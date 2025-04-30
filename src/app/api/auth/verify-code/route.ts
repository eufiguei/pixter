// src/app/api/auth/verify-code/route.ts (Corrected - No Database Type, No PhoneOtpType)
import { NextResponse } from "next/server";
import { cookies } from "next/headers"; // Import cookies
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"; // Import Supabase client for route handlers
import { verifyCode, deleteVerificationCode, formatPhoneNumber } from "@/lib/supabase/client";
// Removed: import type { Database } from "@/types/supabase";
// Removed: import type { PhoneOtpType } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const cookieStore = cookies(); // Get cookie store
  // Create Supabase client capable of handling cookies
  const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const body = await request.json();
    const { phone, code, countryCode = "55" } = body;

    // Validation
    if (!phone || !code) {
      return NextResponse.json(
        { error: "Número de telefone e código são obrigatórios" },
        { status: 400 }
      );
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone, countryCode);

    // 1. Verify the code against your custom table (as before)
    const { data: customVerificationData, error: customVerificationError } = await verifyCode(formattedPhone, code);

    if (customVerificationError || !customVerificationData) {
      console.warn(`Custom code verification failed for ${formattedPhone}: ${customVerificationError?.message || "Code not found or expired"}`);
      return NextResponse.json(
        { error: "Código inválido ou expirado" },
        { status: 401 }
      );
    }

    // 2. If custom verification passes, perform Supabase OTP verification to establish session
    //    Specify the type directly as a string literal.
    const otpType = "sms"; // Use 'sms' for login, or 'phone_change' if applicable
    const { data: sessionData, error: sessionError } = await supabaseAuth.auth.verifyOtp({
      phone: formattedPhone,
      token: code,
      type: otpType,
    });

    if (sessionError) {
      console.error(`Supabase verifyOtp error for ${formattedPhone}:`, sessionError);
      return NextResponse.json(
        { error: "Falha ao verificar o código com o sistema de autenticação." },
        { status: 500 } // Or 401 if it's an invalid code according to Supabase
      );
    }

    if (!sessionData || !sessionData.session) {
      console.error(`Supabase verifyOtp succeeded for ${formattedPhone} but returned no session.`);
      return NextResponse.json(
        { error: "Não foi possível estabelecer a sessão. Tente novamente." },
        { status: 500 }
      );
    }

    // 3. If Supabase verification is successful, delete the code from your custom table
    await deleteVerificationCode(formattedPhone);

    console.log(`Successfully verified OTP and established session for user: ${sessionData.user.id}`);

    // 4. Return success - Supabase Auth Helpers automatically handle setting the session cookies via the response
    return NextResponse.json({
      success: true,
      message: "Código verificado e sessão estabelecida com sucesso",
      userId: sessionData.user.id // Optionally return user ID
    });

  } catch (error: any) {
    console.error("Erro geral ao verificar código:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno ao verificar código" },
      { status: 500 }
    );
  }
}