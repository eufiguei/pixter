// src/app/api/motorista/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { supabaseServer } from "@/lib/supabase/client";

export async function GET(request: Request) {
  // 1) Validate via NextAuth
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (session.user.tipo !== "motorista") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // 2) Fetch the profile from Supabase with your server key
  const userId = session.user.id;
  const { data: profile, error } = await supabaseServer
    .from("profiles")
    .select("id, nome, email, celular, tipo, stripe_account_id")
    .eq("id", userId)
    .eq("tipo", "motorista")
    .single();

  if (error) {
    console.error("Erro ao buscar perfil do motorista:", error);
    return NextResponse.json(
      { error: "Erro ao buscar perfil do motorista" },
      { status: 500 }
    );
  }

  // 3) Return it
  return NextResponse.json(profile);
}

// If you also have a PUT to update the driver’s info, do the same pattern:
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (session.user.tipo !== "motorista") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const userId = session.user.id;
  const updates = await request.json();

  // Sanitize/validate …
  delete updates.id;
  delete updates.tipo;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseServer
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .eq("tipo", "motorista")
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar perfil do motorista:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil do motorista" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Perfil atualizado com sucesso",
    profile: data,
  });
}
