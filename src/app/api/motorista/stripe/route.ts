import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { supabaseServer } from "@/lib/supabase/client";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
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
    console.log("Stripe account status:", {
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      disabled_reason: account.requirements?.disabled_reason,
      capabilities: account.capabilities,
      details_submitted: account.details_submitted
    });
    
    // Determine status
    let status: "pending" | "verified" | "restricted" | null = null;
    if (account.charges_enabled && account.payouts_enabled) {
      status = "verified";
      console.log("Stripe account is VERIFIED");
    } else if (account.requirements?.disabled_reason) {
      status = "restricted";
      console.log("Stripe account is RESTRICTED");
    } else {
      status = "pending";
      console.log("Stripe account is PENDING");
    }
    
    // If the database has a different status, update it
    if (profile.stripe_account_status !== status) {
      console.log(`Updating Stripe status in database from ${profile.stripe_account_status} to ${status}`);
    }

    // Update profile with latest status
    await supabaseServer
      .from("profiles")
      .update({ stripe_account_status: status })
      .eq("id", session.user.id);

    // Always try to create a login link - helpful for both verified and pending accounts
    let loginLink = null;
    try {
      loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);
      console.log("Created Stripe login link successfully");
    } catch (loginError) {
      console.error("Error creating login link:", loginError);
      // If login link fails, try to create an account link for onboarding
      try {
        const accountLink = await stripe.accountLinks.create({
          account: profile.stripe_account_id,
          refresh_url: `${process.env.NEXT_PUBLIC_URL || 'https://pixter-mu.vercel.app'}/motorista/dashboard/dados`,
          return_url: `${process.env.NEXT_PUBLIC_URL || 'https://pixter-mu.vercel.app'}/motorista/dashboard/dados`,
          type: "account_onboarding",
        });
        console.log("Created Stripe account link for onboarding");
        loginLink = { url: accountLink.url };
      } catch (accountLinkError) {
        console.error("Error creating account link:", accountLinkError);
      }
    }

    // Return a simplified response
    return NextResponse.json({
      status,
      accountLink: loginLink?.url || null, // We're now using loginLink as our primary link
      requirements: account.requirements || null,
      // Include additional details for debugging
      details: {
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted
      }
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
