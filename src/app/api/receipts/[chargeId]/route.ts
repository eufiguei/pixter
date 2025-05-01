// src/app/api/receipts/[chargeId]/route.ts

import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import stripe from "@/lib/stripe/server";
import { supabaseServer as supabase } from "@/lib/supabase/server"; // Assuming server client for profile lookup
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Constants
const PIXTER_FEE_PERCENTAGE = 0.03;
const COMPANY_NAME = "Pixter";
const COMPANY_SUBTITLE = "Pagamentos Digitais Ltda.";
const FOOTER_TEXT = "Obrigado por usar Pixter. Volte sempre!";

// Helper function to format currency
function formatCurrency(value: number, currency: string = "brl"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency,
    currencyDisplay: "symbol",
  }).format(value / 100);
}

// Helper function to format date (Date only for receipt header)
function formatDateHeader(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Helper function to format date and time (for footer)
function formatDateTimeFooter(): string {
    return new Date().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

// Helper function to get payment method details
function getPaymentMethodDetails(charge: any): string {
  if (!charge?.payment_method_details) return "Desconhecido";
  const details = charge.payment_method_details;
  switch (details.type) {
    case "card":
      return `Cartão ${details.card?.brand} final ${details.card?.last4}`;
    case "pix":
      return "Pix";
    case "boleto":
      return "Boleto";
    // Add other types as needed
    default:
      return details.type;
  }
}

// Helper function to mask CPF
function maskCpf(cpf: string | null | undefined): string {
    if (!cpf) return "Não informado";
    const cleanedCpf = cpf.replace(/\D/g, ''); // Remove non-digits
    if (cleanedCpf.length !== 11) return "Inválido"; // Basic validation
    return `${cleanedCpf.substring(0, 3)}.***.***-${cleanedCpf.substring(9, 11)}`;
}


// --- HTML Templates (Updated based on IMG_0353.png and new requests) ---

function getClientReceiptHtml(details: any): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comprovante de Pagamento</title>
        <style>
            body { font-family: Helvetica, Arial, sans-serif; margin: 40px; color: #333; font-size: 11pt; }
            .container { max-width: 600px; margin: auto; padding: 30px; }
            .header { text-align: left; margin-bottom: 15px; }
            .header h1 { font-size: 1.8em; margin: 0; font-weight: bold; color: #000; }
            .header p { font-size: 0.9em; margin: 2px 0 0 0; color: #555; }
            hr { border: none; border-top: 1px solid #000; margin: 15px 0; }
            h2 { font-size: 1.2em; font-weight: bold; margin-bottom: 20px; text-align: left; color: #000; }
            .item { margin-bottom: 12px; display: flex; }
            /* Adjust width for Nome Completo label */
            .item span:first-child { font-weight: bold; color: #000; width: 120px; display: inline-block; }
            .item span:last-child { color: #333; }
            .payment-link { margin-top: 20px; }
            .footer { text-align: center; margin-top: 50px; font-size: 0.8em; color: #777; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${COMPANY_NAME}</h1>
                <p>${COMPANY_SUBTITLE}</p>
            </div>
            <hr>
            <h2>COMPROVANTE DE PAGAMENTO</h2>
            <div class="item"><span>Data:</span> <span>${details.date_header}</span></div>
            {/* Changed label to Nome Completo */} 
            <div class="item"><span>Nome Completo:</span> <span>${details.driver_name}</span></div>
            {/* Added Masked CPF */} 
            <div class="item"><span>CPF:</span> <span>${details.driver_cpf_masked}</span></div>
            <div class="item"><span>Profissão:</span> <span>${details.driver_profession}</span></div>
            <div class="item"><span>Valor Pago:</span> <span>${details.amount_paid_formatted}</span></div>
            <div class="item payment-link"><span>Link Pagamento:</span> <span>${details.payment_link}</span></div>
            
            <div class="footer">${FOOTER_TEXT}</div>
            <div class="footer">ID: ${details.transaction_id} | Gerado em: ${formatDateTimeFooter()}</div>
        </div>
    </body>
    </html>
    `;
}

function getDriverReceiptHtml(details: any): string {
  // Similar structure to client, but adds fee breakdown
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Detalhes do Recebimento</title>
        <style>
            body { font-family: Helvetica, Arial, sans-serif; margin: 40px; color: #333; font-size: 11pt; }
            .container { max-width: 600px; margin: auto; padding: 30px; }
            .header { text-align: left; margin-bottom: 15px; }
            .header h1 { font-size: 1.8em; margin: 0; font-weight: bold; color: #000; }
            .header p { font-size: 0.9em; margin: 2px 0 0 0; color: #555; }
            hr { border: none; border-top: 1px solid #000; margin: 15px 0; }
            h2 { font-size: 1.2em; font-weight: bold; margin-bottom: 20px; text-align: left; color: #000; }
            .item { margin-bottom: 12px; display: flex; }
            /* Adjust width for labels */
            .item span:first-child { font-weight: bold; color: #000; width: 160px; display: inline-block; }
            .item span:last-child { color: #333; }
            .fee { color: #e53e3e; }
            .net { font-weight: bold; }
            .footer { text-align: center; margin-top: 50px; font-size: 0.8em; color: #777; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${COMPANY_NAME}</h1>
                <p>${COMPANY_SUBTITLE}</p>
            </div>
            <hr>
            <h2>DETALHES DO RECEBIMENTO</h2>
            <div class="item"><span>Data:</span> <span>${details.date_header}</span></div>
            <div class="item"><span>Cliente:</span> <span>${details.client_identifier}</span></div>
            <div class="item"><span>Método:</span> <span>${details.method}</span></div>
            <hr>
            <div class="item"><span>Valor Bruto Recebido:</span> <span>${details.amount_original_formatted}</span></div>
            <div class="item fee"><span>Taxa Pixter (${details.fee_percentage}%):</span> <span>- ${details.pixter_fee_formatted}</span></div>
            <hr>
            <div class="item net"><span>Valor Líquido Recebido:</span> <span>${details.net_amount_formatted}</span></div>

            <div class="footer">${FOOTER_TEXT}</div>
            <div class="footer">ID: ${details.transaction_id} | Gerado em: ${formatDateTimeFooter()}</div>
        </div>
    </body>
    </html>
    `;
}

// --- API Route Handler ---

// Define profile type including cpf
type DriverProfile = {
    nome: string | null;
    profissao: string | null;
    celular: string | null;
    stripe_account_id: string | null;
    cpf: string | null; // Add CPF field
};

export async function GET(
  request: Request,
  { params }: { params: { chargeId: string } }
) {
  const chargeId = params.chargeId;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "client"; // \'client\' or \'driver\'
  const supabaseAuth = createRouteHandlerClient({ cookies });

  try {
    // 1. Fetch Charge details from Stripe first
    const charge = await stripe.charges.retrieve(chargeId, {
      expand: ["customer", "payment_intent", "transfer", "balance_transaction"],
    });

    if (!charge) {
      return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
    }

    // 2. Determine Stripe Account ID (Driver)
    let stripeAccountId: string | null = null;
    if (charge.transfer_data?.destination) {
        stripeAccountId = charge.transfer_data.destination as string;
    } else if (charge.on_behalf_of) {
        stripeAccountId = charge.on_behalf_of as string;
    } 
    // Add more logic here if needed based on charge type
    
    // 3. Fetch Driver Profile (includes CPF)
    let driverProfile: DriverProfile | null = null;
    if (type === "driver") {
      // If driver is requesting, authenticate and fetch their profile
      const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession();
      if (sessionError || !session) {
        return NextResponse.json({ error: "Não autorizado para recibo do motorista" }, { status: 401 });
      }
      const userId = session.user.id;
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("stripe_account_id, nome, profissao, celular, cpf") // Select CPF
        .eq("id", userId)
        .single<DriverProfile>(); // Use type assertion

      if (profileError || !profile) {
        console.error("Driver profile error:", profileError);
        return NextResponse.json({ error: "Perfil do motorista não encontrado." }, { status: 404 });
      }
      // Security check: Ensure the requested charge belongs to this driver\'s Stripe account
      if (!stripeAccountId) { // Infer if not found via transfer/on_behalf_of
          stripeAccountId = profile.stripe_account_id;
      }
      if (stripeAccountId !== profile.stripe_account_id) {
          console.warn(`Security warning: Driver ${userId} requested receipt for charge ${chargeId} not matching their Stripe account ${profile.stripe_account_id}`);
          return NextResponse.json({ error: "Recibo não pertence a esta conta." }, { status: 403 });
      }
      driverProfile = profile;
    } else if (type === "client" && stripeAccountId) {
        // For client receipt, fetch the driver\'s profile using the Stripe Account ID
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("nome, profissao, celular, cpf") // Select CPF
            .eq("stripe_account_id", stripeAccountId)
            .single<DriverProfile>(); // Use type assertion
        if (profileError || !profile) {
            console.error(`Error fetching driver profile for client receipt (Stripe Acc: ${stripeAccountId}):`, profileError);
            // Don\'t fail the request, just use fallback names/details
        } else {
            driverProfile = profile;
        }
    }

    // Fallback names/details if profile lookup failed or wasn\'t needed
    const driverName = driverProfile?.nome || "Motorista Pixter";
    const driverProfession = driverProfile?.profissao || "Profissional";
    // Corrected line 260:
    const driverPhone = driverProfile?.celular?.replace(/\D/g, '') || null;
    const driverCpfMasked = maskCpf(driverProfile?.cpf);
    const paymentLink = driverPhone ? `${process.env.NEXT_PUBLIC_BASE_URL || request.headers.get("host") || "pixter.com"}/${driverPhone}` : "Link Indisponível";

    // 4. Prepare data for the template
    const originalAmount = charge.amount; // Amount in cents
    const pixterFee = Math.round(originalAmount * PIXTER_FEE_PERCENTAGE);
    const netAmount = originalAmount - pixterFee;
    const clientIdentifier = charge.billing_details?.email || charge.billing_details?.name || "Cliente Anônimo";

    const receiptDetails = {
      transaction_id: charge.id,
      date_header: formatDateHeader(charge.created),
      driver_name: driverName,
      driver_profession: driverProfession,
      driver_cpf_masked: driverCpfMasked, // Add masked CPF
      client_identifier: clientIdentifier,
      method: getPaymentMethodDetails(charge),
      amount_paid: originalAmount, // Client paid the original amount
      amount_paid_formatted: formatCurrency(originalAmount, charge.currency),
      amount_original: originalAmount,
      amount_original_formatted: formatCurrency(originalAmount, charge.currency),
      pixter_fee: pixterFee,
      pixter_fee_formatted: formatCurrency(pixterFee, charge.currency),
      fee_percentage: (PIXTER_FEE_PERCENTAGE * 100).toFixed(0),
      net_amount: netAmount,
      net_amount_formatted: formatCurrency(netAmount, charge.currency),
      payment_link: paymentLink,
    };

    // 5. Generate HTML based on type
    const htmlContent = type === "driver"
      ? getDriverReceiptHtml(receiptDetails)
      : getClientReceiptHtml(receiptDetails);

    // 6. Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    // 7. Return PDF response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="recibo_${chargeId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating PDF receipt:", error);
    // Provide more specific Stripe error messages if available
    let errorMessage = error.message || "Erro ao gerar recibo PDF";
    if (error.type === "StripeInvalidRequestError" && error.code === "resource_missing") {
        errorMessage = `Cobrança com ID ${chargeId} não encontrada.`;
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: error.statusCode || 500 } // Use Stripe status code if available
    );
  }
}

