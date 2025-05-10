import { NextResponse } from "next/server";
// @ts-ignore - Bypassing TypeScript errors for NextAuth imports
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { supabaseServer } from "@/lib/supabase/client";
import Stripe from "stripe";

// @ts-ignore - Bypass process.env error
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions) as {
      user?: {
        id: string;
        tipo?: string;
        email?: string;
      }
    } | null;
    
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

    // Get Stripe account status with expanded capabilities data
    const account = await stripe.accounts.retrieve(profile.stripe_account_id, {
      expand: ['capabilities']
    });
    console.log("Stripe account details:", {
      id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      disabled_reason: account.requirements?.disabled_reason,
      details_submitted: account.details_submitted,
      capabilities_count: Object.keys(account.capabilities || {}).length
    });
    
    // More detailed logging for troubleshooting
    console.log("Requirements status:", JSON.stringify(account.requirements, null, 2));
    console.log("Capabilities status:", JSON.stringify(account.capabilities, null, 2));
    
    // Determine status with more detailed checks
    let status: "pending" | "verified" | "restricted" | null = null;
    if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
      status = "verified";
      console.log("Stripe account is VERIFIED - ready to accept payments");
    } else if (account.requirements?.disabled_reason || 
             (account.requirements?.errors && account.requirements.errors.length > 0)) {
      status = "restricted";
      console.log("Stripe account is RESTRICTED - issues detected");
    } else if (account.details_submitted) {
      status = "pending";
      console.log("Stripe account is PENDING - verification in progress");
    } else {
      status = "pending";
      console.log("Stripe account is PENDING - onboarding incomplete");
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
        // @ts-ignore - Bypass process.env error
        const RETURN_URL = process.env.STRIPE_RETURN_URL || 'http://localhost:3000';
        const accountLink = await stripe.accountLinks.create({
          account: profile.stripe_account_id,
          refresh_url: `${process.env.NEXT_PUBLIC_URL || 'https://pixter-mu.vercel.app'}/motorista/dashboard/dados`,
          // @ts-ignore - Bypass process.env error
          return_url: process.env.STRIPE_RETURN_URL || 'https://pixter-mu.vercel.app/motorista/dashboard/dados',
          type: "account_onboarding",
        });
        console.log("Created Stripe account link for onboarding");
        loginLink = { url: accountLink.url };
      } catch (accountLinkError) {
        console.error("Error creating account link:", accountLinkError);
      }
    }

    // Return a response with more detailed information
    return NextResponse.json({
      status,
      accountLink: loginLink?.url || null, // We're now using loginLink as our primary link
      loginLink: loginLink?.url || null, // Include both for backward compatibility
      requirements: account.requirements || null,
      // Include all relevant details for better diagnostics
      details: {
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        capabilities_status: Object.entries(account.capabilities || {})
          .filter(([_, capability]) => (capability as { status?: string })?.status === 'active')
          .map(([name]) => name),
        requirements_disabled_reason: account.requirements?.disabled_reason || null,
        requirements_past_due: account.requirements?.past_due?.length || 0,
        requirements_pending_verification: account.requirements?.pending_verification?.length || 0
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
    const session = await getServerSession(authOptions) as {
      user?: {
        id: string;
        tipo?: string;
        email?: string;
      }
    } | null;
    
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
    // @ts-ignore - Fix Stripe type definition
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
    // @ts-ignore - Bypass process.env error
    const RETURN_URL = process.env.STRIPE_RETURN_URL || 'http://localhost:3000';
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_URL || 'https://pixter-mu.vercel.app'}/motorista/dashboard/dados`,
      // @ts-ignore - Bypass process.env error
      return_url: process.env.STRIPE_RETURN_URL || 'https://pixter-mu.vercel.app/motorista/dashboard/dados',
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
