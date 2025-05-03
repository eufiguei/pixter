// src/app/api/public/driver-info/[phoneNumber]/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/client";

export async function GET(
  request: Request,
  { params }: { params: { phoneNumber: string } }
) {
  try {
    const raw = params.phoneNumber;
    if (!raw || typeof raw !== "string") {
      return NextResponse.json(
        { error: "Número de telefone inválido." },
        { status: 400 }
      );
    }

    // normalize to E.164
    const digits = raw.replace(/\D/g, "");
    const e164 = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;

    // fetch exactly what we need (including stripe_account_id so we can check “connected”)
    const { data: prof, error } = await supabaseServer
      .from("profiles")
      .select("id, nome, profissao, avatar_url, stripe_account_id, celular, tipo")
      .eq("celular", e164)
      .eq("tipo", "motorista")
      .maybeSingle();

    if (error) {
      console.error("public driver-info error:", error);
      return NextResponse.json(
        { error: "Erro ao buscar informações do motorista." },
        { status: 500 }
      );
    }
    if (!prof) {
      return NextResponse.json(
        { error: "Motorista não encontrado." },
        { status: 404 }
      );
    }
    if (!prof.stripe_account_id) {
      return NextResponse.json(
        { error: "Motorista não habilitado para pagamentos." },
        { status: 404 }
      );
    }

    // shape out only the public‐safe fields
    const profile = {
      id: prof.id,
      nome: prof.nome,
      profissao: prof.profissao,
      avatar_url: prof.avatar_url,
      celular: prof.celular,
    };

    return NextResponse.json({ profile });
  } catch (err: any) {
    console.error("public driver-info error:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
