// src/app/api/stripe/connect-account/route.ts (Corrected for NextAuth.js)
import { NextResponse } from "next/server";
import { Stripe } from "stripe";
// Removed Supabase Auth Helpers: import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
// Removed: import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next"; // Import getServerSession
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Import your authOptions
import { supabaseServer } from "@/lib/supabase/client"; // Use the server client (service role) for DB operations

// Initialize Stripe (Use environment variables!)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { // Added non-null assertion assuming it's set
  apiVersion: "2022-11-15",
});

export async function GET(request: Request) {
  // 1. Get Authenticated User ID using NextAuth.js getServerSession
  const session = await getServerSession(authOptions);

  // Check if session exists and has the user ID (added in your NextAuth callbacks)
  if (!session || !session.user || !session.user.id) {
    console.error("NextAuth Authentication error: No session or user ID found.");
    // Return the same error message the frontend expects
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const userId = session.user.id;
  const userEmail = session.user.email; // Get email from NextAuth session if needed

  try {
    // 2. Fetch User Profile from Supabase using Service Role Client
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
    if (profileError) { // Removed !profile check as single() returns null which is handled by PGRST116
      console.error("Error fetching profile:", profileError.message);
      return NextResponse.json({ error: "Erro ao buscar perfil." }, { status: 500 });
    }

    let stripeAccountId = profile?.stripe_account_id; // Use optional chaining as profile might be null if not found

    // 3. Create Stripe Account if it doesn't exist
    if (!stripeAccountId) {
      if (!userEmail) {
        // Cannot create Stripe account without an email
        console.error("Cannot create Stripe account: User email not found in NextAuth session for user:", userId);
        return NextResponse.json({ error: "Email do usuário não encontrado para criar conta Stripe." }, { status: 400 });
      }
      console.log("Creating new Stripe Express account for user:", userId);
      const account = await stripe.accounts.create({
        type: "express",
        email: userEmail, // Prefill email from NextAuth session
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          supabaseUserId: userId, // Store Supabase/NextAuth user ID in Stripe metadata
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
    if (error.type?.startsWith("Stripe")) { // Check if it looks like a Stripe error
      return NextResponse.json({ error: `Stripe Error: ${error.message}` }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || "Erro ao conectar com Stripe." },
      { status: 500 }
    );
  }
}