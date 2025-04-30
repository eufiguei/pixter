// src/app/api/public/driver-info/[phoneNumber]/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/client";

// This endpoint fetches public-facing driver info based on phone number
// Note: Ensure Row Level Security on `profiles` allows public read for necessary fields
// or consider creating a dedicated view/function for public data.

export async function GET(
  request: Request,
  { params }: { params: { phoneNumber: string } }
) {
  try {
    const phoneNumber = params.phoneNumber;

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json({ error: "Número de telefone inválido." }, { status: 400 });
    }

    // Format phone number to E.164 for lookup (assuming input is digits only)
    const formattedPhone = `+${phoneNumber.replace(/\D/g, "")}`;

    // Fetch profile data - SELECT ONLY the fields needed publicly!
    const { data: profile, error: profileError } = await supabaseServer
      .from("profiles")
      .select("id, nome, profissao, avatar_url, stripe_account_id") // Select public fields + stripe ID + avatar_url
      .eq("celular", formattedPhone)
      .eq("tipo", "motorista")
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching public driver info:", profileError.message);
      return NextResponse.json({ error: "Erro ao buscar informações do motorista." }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: "Motorista não encontrado." }, { status: 404 });
    }

    // Check if Stripe is connected before returning info
    if (!profile.stripe_account_id) {
        return NextResponse.json({ error: "Motorista não habilitado para receber pagamentos no momento." }, { status: 404 });
    }

    // Return only the necessary public data
    const publicData = {
        nome: profile.nome,
        profissao: profile.profissao,
        avatar_url: profile.avatar_url, // Return the avatar URL
        // DO NOT return stripe_account_id publicly
    };

    return NextResponse.json(publicData);

  } catch (error: any) {
    console.error("Public driver info error:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

