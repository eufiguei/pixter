import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Helper function to format currency
const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '0,00';
  // Assuming value is in cents
  return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Helper function to format status
const formatStatus = (status: string | null | undefined) => {
  switch (status) {
    case 'succeeded': return 'Recebido';
    case 'pending': return 'Pendente';
    case 'failed': return 'Falhou';
    default: return status || 'Desconhecido';
  }
};

// Helper function to format payment method
const formatPaymentMethod = (method: string | null | undefined, details: any) => {
    if (details?.brand && details?.last4) {
        return `Cartão ${details.brand} final ${details.last4}`;
    }
    switch (method) {
        case 'card': return 'Cartão';
        case 'pix': return 'Pix';
        case 'apple_pay': return 'Apple Pay';
        default: return method || 'Não especificado';
    }
};

export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // Get payment ID from query parameters
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json(
        { error: 'ID do pagamento não fornecido' },
        { status: 400 }
      );
    }

    // Check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return NextResponse.json({ error: 'Erro interno ao verificar sessão' }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const driverId = session.user.id;

    // Fetch the payment details, ensuring it belongs to the logged-in driver
    const { data: payment, error } = await supabase
      .from('pagamentos') // Ensure this table name is correct
      .select(`
        *,
        client_profile:user_id ( nome, email, celular )
      `)
      .eq('id', paymentId)
      .eq('driver_id', driverId) // Security check: only fetch driver's own received payments
      .single();

    if (error) {
      console.error('Erro ao buscar pagamento para motorista:', error);
      if (error.code === 'PGRST116') { // Not found or insufficient privilege
         return NextResponse.json({ error: 'Pagamento não encontrado ou acesso negado' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Erro ao buscar detalhes do pagamento' }, { status: 500 });
    }

    if (!payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }

    // Generate HTML receipt (Driver's perspective)
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comprovante de Recebimento - Pixter</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f7fafc;
            color: #2d3748;
            line-height: 1.6;
          }
          .receipt {
            max-width: 600px;
            margin: 20px auto;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 30px;
            background-color: #ffffff;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 20px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #7c3aed; /* Purple */
            margin-bottom: 5px;
          }
          .header p {
            font-size: 16px;
            color: #4a5568;
            margin: 0;
          }
          .info {
            margin-bottom: 20px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px dashed #e2e8f0;
          }
          .info-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }
          .info-label {
            font-weight: 600;
            color: #4a5568;
            flex-basis: 40%;
            text-align: left;
          }
          .info-value {
            color: #2d3748;
            flex-basis: 60%;
            text-align: right;
          }
          .total-row .info-label,
          .total-row .info-value {
            font-weight: bold;
            font-size: 1.1em;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #718096;
          }
          @media print {
            body { background-color: #fff; }
            .receipt { box-shadow: none; border: none; margin: 0; max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="logo">PIXTER</div>
            <p>Comprovante de Recebimento</p>
          </div>

          <div class="info">
            <div class="info-row">
              <span class="info-label">ID da Transação:</span>
              <span class="info-value">${payment.id}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Data e Hora:</span>
              <span class="info-value">${new Date(payment.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Pagador:</span>
              <span class="info-value">${payment.client_profile?.nome || payment.client_profile?.email || payment.client_profile?.celular || 'Cliente não identificado'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Valor Recebido:</span>
              <span class="info-value">${formatCurrency(payment.amount)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Gorjeta Recebida:</span>
              <span class="info-value">${formatCurrency(payment.tip_amount)}</span>
            </div>
            <div class="info-row total-row">
              <span class="info-label">Valor Total Recebido:</span>
              <span class="info-value">${formatCurrency(payment.total_amount)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Forma de Pagamento:</span>
              <span class="info-value">${formatPaymentMethod(payment.payment_method, payment.payment_method_details)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value">${formatStatus(payment.status)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Este é um comprovante eletrônico gerado pelo sistema Pixter.</p>
            <p>ID do Recebedor: ${driverId}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Return the HTML as response
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error: any) {
    console.error('Erro ao gerar comprovante para motorista:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor ao gerar comprovante' },
      { status: 500 }
    );
  }
}

