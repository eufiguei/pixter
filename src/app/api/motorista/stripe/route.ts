import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { supabaseServer } from "@/lib/supabase/client";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    // Get profile
    const { data: profile, error: profileError } = await supabaseServer
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: "Erro ao buscar perfil" },
        { status: 500 }
      );
    }

    // If no Stripe account, return early
    if (!profile.stripe_account_id) {
      return NextResponse.json({
        status: null,
        accountLink: null,
        loginLink: null,
        requirements: null,
      });
    }

    // Get Stripe account status
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    
    // Determine status
    let status: "pending" | "verified" | "restricted" | null = null;
    if (account.charges_enabled && account.payouts_enabled) {
      status = "verified";
    } else if (account.requirements?.disabled_reason) {
      status = "restricted";
    } else {
      status = "pending";
    }

    // Update profile with latest status
    await supabaseServer
      .from("profiles")
      .update({ stripe_account_status: status })
      .eq("id", session.user.id);

    // Create account link if not verified
    let accountLink = null;
    if (status !== "verified") {
      accountLink = await stripe.accountLinks.create({
        account: profile.stripe_account_id,
        refresh_url: `${process.env.NEXT_PUBLIC_URL}/motorista/dashboard/dados`,
        return_url: `${process.env.NEXT_PUBLIC_URL}/motorista/dashboard/dados`,
        type: "account_onboarding",
      });
    }

    // Create login link for verified accounts
    let loginLink = null;
    if (status === "verified") {
      loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);
    }

    return NextResponse.json({
      status,
      accountLink: accountLink?.url || null,
      loginLink: loginLink?.url || null,
      requirements: account.requirements || null,
    });
  } catch (error: any) {
    console.error("Stripe API error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao acessar Stripe" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    // Get profile
    const { data: profile, error: profileError } = await supabaseServer
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: "Erro ao buscar perfil" },
        { status: 500 }
      );
    }

    // If already has Stripe account, return error
    if (profile.stripe_account_id) {
      return NextResponse.json(
        { error: "Conta Stripe já existe" },
        { status: 400 }
      );
    }

    // Create Stripe account
    const account = await stripe.accounts.create({
      type: "express",
      country: "BR",
      email: profile.email || undefined,
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Update profile with Stripe account ID
    await supabaseServer
      .from("profiles")
      .update({ 
        stripe_account_id: account.id,
        stripe_account_status: "pending"
      })
      .eq("id", session.user.id);

    // Create account link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_URL}/motorista/dashboard/dados`,
      return_url: `${process.env.NEXT_PUBLIC_URL}/motorista/dashboard/dados`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: any) {
    console.error("Stripe API error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao criar conta Stripe" },
      { status: 500 }
    );
  }
}
