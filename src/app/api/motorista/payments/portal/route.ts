// backend (app/api/payments/portal/route.ts)
import Stripe from 'stripe';
export async function POST(req: Request) {
  const { session } = await req.json();         // sessão do usuário
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2022-11-15' });

  const portal = await stripe.billingPortal.sessions.create({
    customer: session.stripeCustomerId,
    return_url: process.env.NEXT_PUBLIC_APP_URL + '/dashboard'
  });
  return Response.redirect(portal.url, 303);
}