// src/app/api/log-temporary-payment/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server"; // Use server client
import stripe from "@/lib/stripe/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paymentIntentId } = body;

    if (!paymentIntentId) {
      return NextResponse.json({ error: "Payment Intent ID is required" }, { status: 400 });
    }

    // 1. Get Client IP Address
    const headersList = headers();
    const ip_address = (headersList.get("x-forwarded-for") ?? "127.0.0.1").split(",")[0].trim();

    // 2. Retrieve Charge ID from Payment Intent
    // We need the charge ID to link to the receipt later
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
    });

    if (!paymentIntent || !paymentIntent.latest_charge) {
        console.warn(`Could not retrieve charge ID for Payment Intent: ${paymentIntentId}`);
        // Decide if we should still log with just PI ID or fail
        return NextResponse.json({ error: "Could not retrieve charge details" }, { status: 404 });
    }

    const charge_id = typeof paymentIntent.latest_charge === "string" 
        ? paymentIntent.latest_charge 
        : paymentIntent.latest_charge.id;

    // 3. Insert into temporary_payments table
    const { error: insertError } = await supabaseServer
      .from("temporary_payments")
      .insert({ ip_address, charge_id });

    if (insertError) {
      console.error("Error inserting temporary payment log:", insertError);
      // Don't block the user flow, just log the error
      return NextResponse.json({ success: false, message: "Failed to log temporary payment" }, { status: 500 });
    }

    console.log(`Logged temporary payment for Charge ID: ${charge_id} from IP: ${ip_address}`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in /api/log-temporary-payment:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

