// src/app/api/stripe/create-payment-intent/route.ts
import { NextResponse } from "next/server";
import { Stripe } from "stripe";
import { supabaseServer } from "@/lib/supabase/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";

// Initialize Stripe
const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!,
  { apiVersion: "2022-11-15" }
);

export async function POST(request: Request) {
  try {
    const { amount, driverId } = await request.json();

    // 1️⃣ Validate amount and driverId
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Valor inválido." },
        { status: 400 }
      );
    }
    if (!driverId || typeof driverId !== "string") {
      return NextResponse.json(
        { error: "Identificação do motorista inválida." },
        { status: 400 }
      );
    }

    // 2️⃣ Get NextAuth session to detect if a client is logged in
    const session = await getServerSession(authOptions);
    let customerId: string | null = null;
    let ephemeralKeySecret: string | undefined;

    if (session?.user?.id && session.user.tipo === "cliente") {
      // Look up the client's Stripe customer ID
      const { data: clientProfile, error: clientError } =
        await supabaseServer
          .from("profiles")
          .select("stripe_customer_id")
          .eq("id", session.user.id)
          .maybeSingle();
      if (clientError) {
        console.error("Erro fetching client profile:", clientError);
      } else if (clientProfile?.stripe_customer_id) {
        customerId = clientProfile.stripe_customer_id;
        // Create an Ephemeral Key so saved cards show up
        const eph = await stripe.ephemeralKeys.create(
          { customer: customerId },
          { apiVersion: "2022-11-15" }
        );
        ephemeralKeySecret = eph.secret;
      }
    }

    // 3️⃣ Look up the driver’s connected Stripe account
    const { data: driverProfile, error: driverError } =
      await supabaseServer
        .from("profiles")
        .select("stripe_account_id")
        .eq("id", driverId)
        .eq("tipo", "motorista")
        .single();

    if (driverError || !driverProfile?.stripe_account_id) {
      console.error("Driver lookup error:", driverError);
      return NextResponse.json(
        { error: "Motorista não encontrado ou não habilitado." },
        { status: 404 }
      );
    }
    const connectedAccount = driverProfile.stripe_account_id;

    // 4️⃣ Create the PaymentIntent on your platform, routing funds to the driver
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // in cents
      currency: "brl",
      automatic_payment_methods: { enabled: true },
      transfer_data: { destination: connectedAccount },
      // if we have a customer, attach it & allow future off-session usage
      ...(customerId
        ? {
            customer: customerId,
            setup_future_usage: "off_session",
          }
        : {}),
      metadata: { driverId },
    });

    // 5️⃣ Return both secrets to the frontend
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      ephemeralKeySecret,
    });
  } catch (err: any) {
    console.error("Create PaymentIntent error:", err);
    return NextResponse.json(
      { error: err.message || "Falha ao iniciar pagamento." },
      { status: 500 }
    );
  }
}
