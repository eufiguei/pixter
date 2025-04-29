// src/app/api/stripe/connect-account/route.ts
import { NextResponse } from "next/server";
import { Stripe } from "stripe";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/client"; // Assuming this uses SERVICE_ROLE_KEY for server-side updates

// Initialize Stripe (Use environment variables!)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_YOUR_KEY", {
  apiVersion: "2024-04-10",
});

export async function GET(request: Request) {
  const supabaseAuth = createRouteHandlerClient({ cookies }); // For getting user session

  try {
    // 1. Get Authenticated User ID using Supabase Auth Helpers
    const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession();

    if (sessionError || !session?.user) {
      console.error("Authentication error:", sessionError?.message);
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Fetch User Profile from Supabase using Service Role Client for potential updates
    const { data: profile, error: profileError } = await supabaseServer
      .from("profiles")
      .select("stripe_account_id") // Select existing Stripe ID
      .eq("id", userId)
      .single();

    // Handle profile not found specifically
    if (profileError && profileError.code === "PGRST116") { // PGRST116: Row not found
        console.error("Profile not found for user:", userId);
        return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }
    // Handle other profile fetch errors
    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError?.message);
      return NextResponse.json({ error: "Erro ao buscar perfil." }, { status: 500 });
    }

    let stripeAccountId = profile.stripe_account_id;

    // 3. Create Stripe Account if it doesn\t exist
    if (!stripeAccountId) {
      console.log("Creating new Stripe Express account for user:", userId);
      const account = await stripe.accounts.create({
        type: "express",
        email: session.user.email, // Prefill email from session
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          supabaseUserId: userId, // Store Supabase user ID in Stripe metadata
        },
      });
      stripeAccountId = account.id;

      // 4. Save Stripe Account ID to Supabase Profile using Service Role Client
      const { error: updateError } = await supabaseServer
        .from("profiles")
        .update({ stripe_account_id: stripeAccountId })
        .eq("id", userId);

      if (updateError) {
        console.error("Failed to save Stripe Account ID to profile:", updateError.message);
        // Consider cleanup: maybe delete the Stripe account if saving fails?
        return NextResponse.json({ error: "Falha ao salvar informações do Stripe." }, { status: 500 });
      }
      console.log("Stripe Account ID saved to profile:", stripeAccountId);
    } else {
      console.log("Using existing Stripe Account ID:", stripeAccountId);
    }

    // 5. Create Stripe Account Link
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const returnUrl = `${origin}/motorista/stripe-success`;
    const refreshUrl = `${origin}/motorista/stripe-refresh`;

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    // 6. Return the Account Link URL
    return NextResponse.json({ url: accountLink.url });

  } catch (error: any) {
    console.error("Stripe Connect account process error:", error);
    // Differentiate Stripe errors from other errors if possible
    if (error.type === "StripeInvalidRequestError") {
        return NextResponse.json({ error: `Stripe Error: ${error.message}` }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || "Erro ao conectar com Stripe." },
      { status: 500 }
    );
  }
}