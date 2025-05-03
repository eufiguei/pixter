import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabase/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

export async function POST(request: Request) {
  try {
    const { amount, driverId } = await request.json();

    // 1️⃣ Validate
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    }
    if (!driverId || typeof driverId !== "string") {
      return NextResponse.json({ error: "Identificação do motorista inválida." }, { status: 400 });
    }

    // 2️⃣ If a client is logged in, look up their Stripe Customer and issue an Ephemeral Key
    const session = await getServerSession(authOptions);
    let customerId: string | undefined;
    let ephemeralKeySecret: string | undefined;

    if (session?.user?.id && session.user.tipo === "cliente") {
      const { data: clientProfile } = await supabaseServer
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (clientProfile?.stripe_customer_id) {
        customerId = clientProfile.stripe_customer_id;
        const eph = await stripe.ephemeralKeys.create(
          { customer: customerId },
          { apiVersion: "2022-11-15" }
        );
        ephemeralKeySecret = eph.secret;
      }
    }

    // 3️⃣ Look up the driver’s connected account
    const { data: driverProfile, error: drvErr } = await supabaseServer
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", driverId)
      .eq("tipo", "motorista")
      .single();

    if (drvErr || !driverProfile?.stripe_account_id) {
      return NextResponse.json(
        { error: "Motorista não encontrado ou não habilitado." },
        { status: 404 }
      );
    }
    const connectedAccount = driverProfile.stripe_account_id;

    // 4️⃣ Create the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),    // already in cents
      currency: "brl",
      automatic_payment_methods: { enabled: true },
      transfer_data: { destination: connectedAccount },
      ...(customerId
        ? {
            customer: customerId,
            setup_future_usage: "off_session",
          }
        : {}),
      metadata: { driverId },
    });

    // 5️⃣ Return both secrets
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
