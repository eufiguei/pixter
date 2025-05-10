// src/app/api/stripe/list-payment-methods/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options"; // Adjust path as needed
import { Stripe } from "stripe";

// Initialize Stripe (Use environment variables!)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_YOUR_KEY", {
  apiVersion: "2022-11-15", // Use your desired API version
});

export async function GET(request: Request) {
  try {
    // 1. Get session and Stripe Customer ID
    const session = await getServerSession(authOptions);

    // Type assertion to access custom properties
    const stripeCustomerId = (session?.user as any)?.stripeCustomerId;

    if (!session || !stripeCustomerId) {
      return NextResponse.json({ error: "Usuário não autenticado ou não encontrado." }, { status: 401 });
    }

    // 2. List payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
    });

    // 3. Format the response (only send necessary, non-sensitive data)
    const formattedPaymentMethods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      exp_month: pm.card?.exp_month,
      exp_year: pm.card?.exp_year,
    }));

    return NextResponse.json(formattedPaymentMethods);

  } catch (error: any) {
    console.error("List Payment Methods error:", error);
    return NextResponse.json(
      { error: error.message || "Falha ao buscar métodos de pagamento." },
      { status: 500 }
    );
  }
}

