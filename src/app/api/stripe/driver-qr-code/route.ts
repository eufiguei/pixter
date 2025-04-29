// src/app/api/stripe/driver-qr-code/route.ts
import { NextResponse, NextRequest } from "next/server";
import QRCode from "qrcode";
import { supabaseServer } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("driverId");

    if (!driverId) {
      return NextResponse.json({ error: "ID do motorista não fornecido." }, { status: 400 });
    }

    // 1. Fetch driver profile to get phone number
    const { data: profile, error: profileError } = await supabaseServer
      .from("profiles")
      .select("celular")
      .eq("id", driverId)
      .eq("tipo", "motorista") // Ensure it's a driver
      .single();

    if (profileError || !profile || !profile.celular) {
      console.error("Error fetching profile or missing phone number:", profileError?.message);
      return NextResponse.json({ error: "Perfil do motorista não encontrado ou número de celular ausente." }, { status: 404 });
    }

    // 2. Construct the public payment URL
    const formattedPhoneForUrl = profile.celular.replace(/\D/g, ""); // Remove non-digits
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"; // Get base URL
    const paymentUrl = `${origin}/${formattedPhoneForUrl}`;

    // 3. Generate QR Code as Data URL
    const qrCodeDataUrl = await QRCode.toDataURL(paymentUrl, {
      errorCorrectionLevel: "H", // High error correction
      type: "image/png",
      margin: 1,
      width: 200, // Adjust size as needed
    });

    // 4. Return the QR Code Data URL
    return NextResponse.json({ qrCode: qrCodeDataUrl, paymentUrl: paymentUrl });

  } catch (error: any) {
    console.error("QR Code generation error:", error);
    return NextResponse.json(
      { error: error.message || "Falha ao gerar QR code." },
      { status: 500 }
    );
  }
}