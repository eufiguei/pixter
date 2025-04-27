// /src/app/api/stripe/create-connect-account/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export async function POST(request: Request) {
  try {
    const { driverId } = await request.json();
    
    // Verificar autenticação
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session || authData.session.user.id !== driverId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      );
    }
    
    // Buscar dados do motorista
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();
      
    if (driverError || !driver) {
      return NextResponse.json(
        { error: 'Motorista não encontrado' },
        { status: 404 }
      );
    }
    
    // Verificar se já existe uma conta
    if (driver.stripe_account_id) {
      // Recuperar a conta existente
      const account = await stripe.accounts.retrieve(driver.stripe_account_id);
      
      // Verificar se precisa completar onboarding
      if (account.details_submitted) {
        return NextResponse.json({
          accountId: driver.stripe_account_id,
          detailsSubmitted: true
        });
      }
      
      // Criar link para completar onboarding
      const accountLink = await stripe.accountLinks.create({
        account: driver.stripe_account_id,
        refresh_url: `${process.env.NEXT_PUBLIC_URL}/motorista/stripe-refresh`,
        return_url: `${process.env.NEXT_PUBLIC_URL}/motorista/stripe-success`,
        type: 'account_onboarding',
      });
      
      return NextResponse.json({ url: accountLink.url });
    }
    
    // Criar nova conta Stripe Connect
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'BR',
      email: driver.email || undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      business_profile: {
        mcc: '4121', // Táxis e limusines
        url: process.env.NEXT_PUBLIC_URL,
      },
      metadata: {
        driverId: driverId
      }
    });
    
    // Atualizar o registro do motorista
    await supabase
      .from('drivers')
      .update({
        stripe_account_id: account.id,
        stripe_account_status: account.details_submitted ? 'submitted' : 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', driverId);
    
    // Criar link para onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_URL}/motorista/stripe-refresh`,
      return_url: `${process.env.NEXT_PUBLIC_URL}/motorista/stripe-success`,
      type: 'account_onboarding',
    });
    
    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error('Erro ao criar conta Stripe Connect:', error);
    return NextResponse.json(
      { error: 'Erro ao criar conta Stripe Connect' },
      { status: 500 }
    );
  }
}
