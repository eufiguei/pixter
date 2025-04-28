import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export async function GET(request: Request) {
  try {
    // Obter o ID do pagamento da query
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    
    if (!paymentId) {
      return NextResponse.json(
        { error: 'ID do pagamento não fornecido' },
        { status: 400 }
      );
    }
    
    // Verificar autenticação
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Buscar o pagamento
    const { data: payment, error } = await supabase
      .from('pagamentos')
      .select(`
        *,
        driver:driver_id (nome, profissao)
      `)
      .eq('id', paymentId)
      .eq('user_id', userId)
      .single();
    
    if (error || !payment) {
      console.error('Erro ao buscar pagamento:', error);
      return NextResponse.json(
        { error: 'Pagamento não encontrado' },
        { status: 404 }
      );
    }
    
    // Gerar comprovante em HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Comprovante de Pagamento</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .receipt {
            max-width: 600px;
            margin: 0 auto;
            border: 1px solid #ccc;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #6b46c1;
          }
          .info {
            margin-bottom: 20px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          .info-label {
            font-weight: bold;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="logo">PIXTER</div>
            <p>Comprovante de Pagamento</p>
          </div>
          
          <div class="info">
            <div class="info-row">
              <span class="info-label">ID do Pagamento:</span>
              <span>${payment.id}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Data:</span>
              <span>${new Date(payment.created_at).toLocaleString('pt-BR')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Motorista:</span>
              <span>${payment.driver?.nome || 'Não especificado'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Profissão:</span>
              <span>${payment.driver?.profissao || 'Motorista'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Valor:</span>
              <span>R$ ${payment.amount.toFixed(2)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Gorjeta:</span>
              <span>R$ ${(payment.tip_amount || 0).toFixed(2)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Total:</span>
              <span>R$ ${payment.total_amount.toFixed(2)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Método de Pagamento:</span>
              <span>${
                payment.payment_method === 'card' ? 'Cartão' : 
                payment.payment_method === 'pix' ? 'Pix' : 
                payment.payment_method === 'apple_pay' ? 'Apple Pay' : 
                payment.payment_method || 'Não especificado'
              }</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span>${
                payment.status === 'succeeded' ? 'Aprovado' :
                payment.status === 'pending' ? 'Pendente' :
                payment.status === 'failed' ? 'Falhou' :
                payment.status || 'Desconhecido'
              }</span>
            </div>
          </div>
          
          <div class="footer">
            <p>Este é um comprovante eletrônico gerado pelo sistema Pixter.</p>
            <p>Para mais informações, acesse pixter.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Retornar o HTML como resposta
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error: any) {
    console.error('Erro ao gerar comprovante:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar comprovante' },
      { status: 500 }
    );
  }
}
