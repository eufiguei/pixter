import { NextResponse } from 'next/server';
import { generateVerificationCode, sendVerificationSMS } from '@/lib/twilio/client';
import { storeVerificationCode, formatPhoneNumber } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, countryCode = '55' } = body;

    // Validação dos parâmetros
    if (!phone) {
      return NextResponse.json(
        { error: 'Número de telefone é obrigatório' },
        { status: 400 }
      );
    }

    // Formata o número de telefone
    const formattedPhone = formatPhoneNumber(phone, countryCode);
    
    // Gera um código de verificação
    const code = await generateVerificationCode();
    
    // Armazena o código no banco de dados
    const { error: storeError } = await storeVerificationCode(formattedPhone, code);
    
    if (storeError) {
      console.error('Erro ao armazenar código:', storeError);
      return NextResponse.json(
        { error: 'Erro ao gerar código de verificação' },
        { status: 500 }
      );
    }
    
    // Envia o SMS com o código
    const { success, error: smsError } = await sendVerificationSMS(formattedPhone, code);
    
    if (!success) {
      console.error('Erro ao enviar SMS:', smsError);
      return NextResponse.json(
        { error: smsError || 'Erro ao enviar SMS' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Código enviado com sucesso'
    });
  } catch (error: any) {
    console.error('Erro ao enviar código:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar código de verificação' },
      { status: 500 }
    );
  }
}
