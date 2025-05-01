// src/app/api/auth/login-driver/route.ts (Updated for Supabase Built-in OTP & Session)
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { formatPhoneNumber } from "@/lib/supabase/client"; // Keep phone formatter
// Remove the problematic import
// import { AuthOtpResponse } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Initialize client here
    const body = await request.json();
    const { phone, code, countryCode = "55" } = body;

    // 1. Validation
    if (!phone || !code) {
      return NextResponse.json(
        { error: "Número de telefone e código são obrigatórios" },
        { status: 400 }
      );
    }

    // 2. Format Phone Number
    const formattedPhone = formatPhoneNumber(phone, countryCode);

    // 3. Verify OTP using Supabase Auth (Creates Session on Success)
    // Remove the explicit type annotation to let TypeScript infer the correct type
    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: code,
      type: "sms", // or "whatsapp" if configured
    });

    if (otpError) {
      console.error("Supabase verifyOtp error:", otpError.message);
      // Map common errors to user-friendly messages
      let errorMessage = "Código inválido ou expirado";
      if (otpError.message.includes("expired")) {
          errorMessage = "Código expirado. Por favor, solicite um novo.";
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: 401 } // Unauthorized
      );
    }

    // Check if session and user are returned (verification successful)
    if (!otpData.session || !otpData.user) {
        console.error("Supabase verifyOtp succeeded but did not return session/user.");
        return NextResponse.json(
            { error: "Falha ao verificar o código. Tente novamente." },
            { status: 500 }
        );
    }

    // 4. Verification successful, user is logged in. Now check if they are a motorista.
    const userId = otpData.user.id;

    const { data: profileData, error: profileError } = await supabase // Use the same client instance
      .from("profiles")
      .select("tipo") // Only select the type
      .eq("id", userId)
      .single();

    if (profileError) {
        console.error("Error fetching profile for user:", userId, profileError.message);
        // Log out the user if profile check fails?
        // await supabase.auth.signOut(); // Consider this for security
        return NextResponse.json(
            { error: "Erro ao buscar perfil do motorista." },
            { status: 500 }
        );
    }

    if (!profileData || profileData.tipo?.toLowerCase() !== "motorista") {
        console.log("User is not a motorista or profile missing. Type:", profileData?.tipo);
        // Log out the user as they shouldn't access the driver section
        await supabase.auth.signOut(); // Sign out the session created by verifyOtp
        return NextResponse.json(
            { error: "Acesso não autorizado. Este usuário não é um motorista." },
            { status: 403 } // Forbidden
        );
    }

    // 5. Success: Code verified, session created, user is a motorista
    console.log("Motorista login successful for user:", userId);
    // The session is already handled by Supabase client-side after verifyOtp succeeds.
    // Return success and potentially user info (but not the session object itself from here).
    return NextResponse.json({
      success: true,
      message: "Login realizado com sucesso!",
      userId: userId,
      // You might return minimal user details if needed by the frontend immediately
      // user: { id: otpData.user.id, email: otpData.user.email, phone: otpData.user.phone }
    });

  } catch (error: any) {
    console.error("Erro geral no login-driver:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno no servidor" },
      { status: 500 }
    );
  }
}