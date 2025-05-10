// src/app/api/stripe/update-payment-intent/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

export async function POST(request: Request) {
  try {
    const { paymentIntentId, amount } = await request.json();

    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return NextResponse.json(
        { error: "Invalid Payment Intent ID." },
        { status: 400 }
      );
    }
    if (typeof amount !== "number" || amount <= 0) {
      // Basic validation, Stripe might have minimum amounts too
      return NextResponse.json(
        { error: "Invalid amount." },
        { status: 400 }
      );
    }

    // Retrieve the associated Stripe Account ID if needed (e.g., from metadata or another source)
    // For simplicity, assuming direct payments or account ID is handled elsewhere if Connect
    // If using Connect, you MUST pass the stripeAccount parameter here.
    // const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    // const stripeAccountId = paymentIntent.transfer_data?.destination; // Example if using destination charges
    // if (!stripeAccountId) { ... handle error ... }

    const updatedIntent = await stripe.paymentIntents.update(
      paymentIntentId,
      {
        amount: amount, // Amount in cents
        currency: "brl", // Ensure currency is consistent
        // If you need to update metadata or other fields, add them here
      }
      // Uncomment and add stripeAccount if using Connect
      // , { stripeAccount: stripeAccountId }
    );

    return NextResponse.json({ clientSecret: updatedIntent.client_secret });

  } catch (err: any) {
    console.error("Error updating Payment Intent:", err);
    // Provide a more generic error to the client
    const errorMessage = err instanceof Stripe.errors.StripeError
      ? err.message
      : "Failed to update payment amount.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

