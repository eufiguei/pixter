import { NextResponse } from "next/server";
import { Stripe } from "stripe";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2022-11-15" });

export async function GET(request: Request) {
  const supabaseAuth = createRouteHandlerClient({ cookies });
  try {
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const userId = session.user.id;

    const { data: profile, error: profileError } = await supabaseServer
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile || !profile.stripe_account_id) {
      return NextResponse.json({ error: "Perfil ou conta Stripe não encontrada." }, { status: 404 });
    }

    const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);
    return NextResponse.json({ url: loginLink.url });

  } catch (error: any) {
    console.error("Erro ao criar link de login Stripe:", error);
    return NextResponse.json({ error: error.message || "Erro interno." }, { status: 500 });
  }
}