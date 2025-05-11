import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { supabaseServer } from "@/lib/supabase/client";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

export async function GET(request: Request) {
  // 1) Ensure we have an authenticated motorista
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.tipo !== "motorista") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = session.user.id;

  // 2) Grab their connected Stripe account ID from Supabase
  const { data: profile, error: pErr } = await supabaseServer
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", userId)
    .single();
  if (pErr || !profile?.stripe_account_id) {
    return NextResponse.json(
      { error: "Conta Stripe não encontrada no perfil" },
      { status: 404 }
    );
  }
  const stripeAccount = profile.stripe_account_id;

  // 3) First verify the Stripe account exists and is active
  try {
    console.log(`Verifying Stripe account: ${stripeAccount}`);
    const account = await stripe.accounts.retrieve(stripeAccount);
    console.log('Stripe account status:', account.details_submitted, account.payouts_enabled, account.charges_enabled);
    
    if (!account.details_submitted || !account.payouts_enabled || !account.charges_enabled) {
      console.warn('Stripe account not fully set up:', {
        details_submitted: account.details_submitted,
        payouts_enabled: account.payouts_enabled,
        charges_enabled: account.charges_enabled
      });
    }

    // 4) Fetch the balance on the CONNECTED account
    console.log(`Fetching balance for Stripe account: ${stripeAccount}`);
    
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount }
    );
    
    console.log('Raw balance response:', JSON.stringify(balance, null, 2));

    // Find the BRL balance entry
    const availableBRL = balance.available.find((b) => b.currency === "brl")?.amount ?? 0;
    const pendingBRL = balance.pending.find((b) => b.currency === "brl")?.amount ?? 0;
    
    console.log('Available BRL:', availableBRL, 'Pending BRL:', pendingBRL);

    return NextResponse.json({
      available: availableBRL, // in cents
      pending: pendingBRL,     // in cents
      currency: "BRL",
    });
  } catch (err: any) {
    console.error("Stripe Balance Retrieve Error:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno ao buscar saldo" },
      { status: 500 }
    );
  }
}
