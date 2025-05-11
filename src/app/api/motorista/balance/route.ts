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

  try {
    console.log(`Fetching payments for Stripe account: ${stripeAccount}`);
    
    // Fetch the last 10 payments for this connected account
    const payments = await stripe.charges.list(
      {
        limit: 10,
        expand: ['data.balance_transaction'],
      },
      { stripeAccount }
    );
    
    console.log(`Found ${payments.data.length} payments`);
    
    // Calculate total amounts
    const totalPaid = payments.data.reduce((sum, charge) => {
      if (charge.paid && charge.status === 'succeeded') {
        return sum + charge.amount;
      }
      return sum;
    }, 0);
    
    // Format the response
    const formattedPayments = payments.data.map(charge => ({
      id: charge.id,
      amount: charge.amount / 100, // Convert to reais
      currency: charge.currency,
      status: charge.status,
      paid: charge.paid,
      created: new Date(charge.created * 1000).toISOString(),
      description: charge.description || 'Sem descrição',
      payment_method: charge.payment_method_details?.type || 'unknown',
      receipt_url: charge.receipt_url
    }));
    
    console.log(`Total paid: ${totalPaid / 100} ${payments.data[0]?.currency?.toUpperCase() || 'BRL'}`);
    
    return NextResponse.json({
      total_paid: totalPaid, // in cents
      currency: payments.data[0]?.currency?.toUpperCase() || 'BRL',
      payments: formattedPayments,
      count: payments.data.length
    });
  } catch (err: any) {
    console.error("Stripe Balance Retrieve Error:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno ao buscar saldo" },
      { status: 500 }
    );
  }
}
