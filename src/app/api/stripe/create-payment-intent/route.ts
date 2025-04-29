// src/app/api/stripe/create-payment-intent/route.ts
import { NextResponse } from "next/server";
import { Stripe } from "stripe";
import { supabaseServer } from "@/lib/supabase/client";

// Initialize Stripe (Use environment variables!)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_YOUR_KEY", {
  apiVersion: "2022-11-15",
});

// Helper function to calculate application fee (example: 5%)
const calculateApplicationFeeAmount = (amount: number): number => {
  // Ensure amount is in cents
  return Math.floor(amount * 0.05); // 5% fee, rounded down
};

export async function POST(request: Request) {
  try {
    const { amount, driverPhoneNumber } = await request.json();

    // Basic validation
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    }
    if (!driverPhoneNumber || typeof driverPhoneNumber !== "string") {
      return NextResponse.json({ error: "Identificação do motorista inválida." }, { status: 400 });
    }

    // Convert amount to cents (Stripe expects integer amount in smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    // 1. Find the driver's profile using the phone number
    // Assuming phone number is stored in E.164 format in auth.users
    // We need to join profiles with auth.users or query profiles by a unique identifier derived from phone
    // For simplicity, let's assume a direct lookup on a formatted phone number in profiles for now
    // WARNING: This lookup might need adjustment based on your exact schema and how phone numbers are stored/queried.
    // A better approach might be to query auth.users by phone, get the ID, then query profiles by ID.
    const formattedPhone = `+${driverPhoneNumber.replace(/\D/g, "")}`; // Ensure E.164

    const { data: profile, error: profileError } = await supabaseServer
      .from("profiles")
      .select("id, stripe_account_id") // Select Stripe ID
      .eq("celular", formattedPhone) // Querying by 'celular' column
      .eq("tipo", "motorista")
      .maybeSingle(); // Use maybeSingle to handle not found gracefully

    if (profileError) {
      console.error("Error fetching driver profile:", profileError.message);
      return NextResponse.json({ error: "Erro ao buscar motorista." }, { status: 500 });
    }

    if (!profile || !profile.stripe_account_id) {
      console.log("Driver not found or Stripe not connected for phone:", formattedPhone);
      return NextResponse.json({ error: "Motorista não encontrado ou não habilitado para pagamentos." }, { status: 404 });
    }

    const stripeAccountId = profile.stripe_account_id;

    // 2. Create a Payment Intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "brl", // Brazilian Real
      automatic_payment_methods: {
        enabled: true, // Let Stripe handle payment methods like Card, Pix, etc.
      },
      // --- Crucial for Connect --- 
      transfer_data: {
        destination: stripeAccountId, // Transfer funds to the connected driver account
      },
      // Optional: Application Fee (if Pixter takes a cut)
      // application_fee_amount: calculateApplicationFeeAmount(amountInCents),
      // ---------------------------
      metadata: {
        driverProfileId: profile.id, // Store driver ID for reconciliation
        payingPhoneNumber: driverPhoneNumber, // Store identifier used
      },
    });

    // 3. Return the client secret to the frontend
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });

  } catch (error: any) {
    console.error("Create Payment Intent error:", error);
    return NextResponse.json(
      { error: error.message || "Falha ao iniciar pagamento." },
      { status: 500 }
    );
  }
}
