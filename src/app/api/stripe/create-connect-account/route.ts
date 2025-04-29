// src/app/api/stripe/connect-account/route.ts
import { NextResponse } from "next/server";
import { Stripe } from "stripe";
import { supabaseServer } from "@/lib/supabase/client";
import { getServerSession } from "next-auth/next" // Assuming NextAuth.js for session
// import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Adjust path if needed

// Initialize Stripe (Use environment variables!)
// Ensure you have STRIPE_SECRET_KEY in your .env.local
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_YOUR_KEY", {
  apiVersion: "2024-04-10", // Use the latest API version
});

export async function GET(request: Request) {
  try {
    const { driverId } = await request.json();
    
    // Verificar autenticação
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session || authData.session.user.id !== driverId) {
              console.error("CRITICAL: Need to implement actual user ID retrieval in /api/stripe/connect-account");
				return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      );
    }
    
   // 2. Fetch User Profile from Supabase
    const { data: profile, error: profileError } = await supabaseServer
      .from("profiles")
      .select("stripe_account_id") // Select existing Stripe ID
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile or profile not found:", profileError?.message);
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    let stripeAccountId = profile.stripe_account_id;

    // 3. Create Stripe Account if it doesn\t exist
    if (!stripeAccountId) {
      console.log("Creating new Stripe Express account for user:", userId);
      const account = await stripe.accounts.create({
        type: "express",
        // You can prefill email, country, etc., if available
        // email: session.user.email,
        // country: "BR", // Example
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual", // Assuming individual drivers
      });
      stripeAccountId = account.id;

      // 4. Save Stripe Account ID to Supabase Profile
      const { error: updateError } = await supabaseServer
        .from("profiles")
        .update({ stripe_account_id: stripeAccountId })
        .eq("id", userId);

      if (updateError) {
        console.error("Failed to save Stripe Account ID to profile:", updateError.message);
        // Consider how to handle this - maybe delete the Stripe account?
        return NextResponse.json({ error: "Falha ao salvar informações do Stripe." }, { status: 500 });
      }
      console.log("Stripe Account ID saved to profile:", stripeAccountId);
    } else {
      console.log("Using existing Stripe Account ID:", stripeAccountId);
    }

    // 5. Create Stripe Account Link
    // Define your return and refresh URLs (must be configured in Stripe dashboard too)
    const origin = request.headers.get("origin") || "http://localhost:3000"; // Get base URL
    const returnUrl = `${origin}/motorista/stripe-success`; // Page shown after successful onboarding
    const refreshUrl = `${origin}/motorista/stripe-refresh`; // Page shown if onboarding link expires or fails

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    // 6. Return the Account Link URL
    return NextResponse.json({ url: accountLink.url });

  } catch (error: any) {
    console.error("Stripe Connect account creation error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao conectar com Stripe." },
      { status: 500 }
    );
  }
}