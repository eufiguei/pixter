// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { Stripe } from "stripe";
import { supabaseServer } from "@/lib/supabase/client"; // Use Service Role Key

// Initialize Stripe (Use environment variables!)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_YOUR_KEY", {
  apiVersion: "2022-11-15",
});

// Get the webhook secret from environment variables
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_YOUR_SECRET";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  let event: Stripe.Event;

  // 1. Verify webhook signature
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    console.log("Webhook event received:", event.type);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // 2. Handle the event
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Handling payment_intent.succeeded: ${paymentIntent.id}`);
        await handlePaymentIntentSucceeded(paymentIntent);
        break;

      case "account.updated":
        const account = event.data.object as Stripe.Account;
        console.log(`Handling account.updated: ${account.id}`);
        await handleAccountUpdated(account);
        break;

      // Add other event types you want to handle here
      // e.g., payment_intent.payment_failed, charge.dispute.created, etc.

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error("Error processing webhook event:", error);
    return NextResponse.json(
      { error: "Webhook processing error." },
      { status: 500 }
    );
  }
}

// --- Handler Functions ---

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { id, amount, metadata, currency, status } = paymentIntent;
  // CORREÇÃO: Use a chave correta definida durante a criação do pagamento
  const driverId = metadata?.driverId; // <<< Mude de driverProfileId para driverId

  if (!driverId) {
    console.error("Missing driverId in PaymentIntent metadata:", id);
    return; // Pare o processamento se não pudermos vinculá-lo a um vendedor
  }

  try {
    // Upsert no histórico de pagamentos (crie se não existir, atualize se existir)
    // Assume que stripe_payment_id é único
    const { error: upsertError } = await supabaseServer
      .from("pagamentos") // Certifique-se que a tabela é "pagamentos"
      .upsert({
        stripe_payment_id: id,
        vendedor_id: driverId, // <<< Use a variável driverId corrigida
        valor: amount / 100, // Converta centavos para a unidade monetária base
        moeda: currency,
        status: status,
        // created_at é tratado pelo valor padrão ou gatilho
        // updated_at pode ser definido aqui se necessário
      }, { onConflict: "stripe_payment_id" }); // Especifique a coluna de conflito

    if (upsertError) {
      console.error("Erro ao fazer upsert no histórico de pagamentos:", upsertError.message);
    } else {
      console.log("Histórico de pagamentos registrado/atualizado para:", id);
      // Opcionalmente: Acione a notificação para o vendedor aqui
    }

  } catch (error) {
    console.error("Exceção em handlePaymentIntentSucceeded:", error);
  }
}


async function handleAccountUpdated(account: Stripe.Account) {
  const { id, metadata, charges_enabled, details_submitted, payouts_enabled } = account;
  const supabaseUserId = metadata?.supabaseUserId; // Get Supabase user ID from metadata

  if (!supabaseUserId) {
    console.error("Missing supabaseUserId in Stripe Account metadata:", id);
    return; // Cannot link account update without the user ID
  }

  try {
    // Determine a simplified status based on Stripe flags
    let accountStatus = "pending";
    if (details_submitted) {
      accountStatus = charges_enabled && payouts_enabled ? "verified" : "restricted";
    }

    // Update the corresponding profile in Supabase
    const { error: updateError } = await supabaseServer
      .from("profiles")
      .update({
        // Store individual flags or a combined status
        stripe_account_charges_enabled: charges_enabled,
        stripe_account_details_submitted: details_submitted,
        stripe_account_payouts_enabled: payouts_enabled,
        stripe_account_status: accountStatus, // Store the simplified status
        updated_at: new Date().toISOString(),
      })
      .eq("id", supabaseUserId); // Use the ID from metadata

    if (updateError) {
      console.error("Error updating profile from account.updated webhook:", updateError.message);
    } else {
      console.log("Profile updated successfully for Stripe account:", id, "User:", supabaseUserId);
    }

  } catch (error) {
    console.error("Exception in handleAccountUpdated:", error);
  }
}