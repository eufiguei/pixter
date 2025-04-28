import { NextResponse } from 'next/server';
import { sendVerificationSMS, generateVerificationCode, formatPhoneNumber } from '@/lib/twilio/client';
import { storeVerificationCode } from '@/lib/supabase/client';

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
    
    // Gera código de verificação
    const verificationCode = await generateVerificationCode();
    
    // Armazena o código no Supabase para verificação posterior
    const { error: storeError } = await storeVerificationCode(formattedPhone, verificationCode);
      
    if (storeError) {
      console.error('Erro ao armazenar código de verificação:', storeError);
      return NextResponse.json(
        { error: 'Erro ao armazenar código de verificação. Tente novamente.' },
        { status: 500 }
      );
    }
    
    // Envia SMS com o código
    const { success, error } = await sendVerificationSMS(formattedPhone, verificationCode);
    
    if (!success) {
      console.error('Erro ao enviar SMS:', error);
      return NextResponse.json(
        { error: 'Erro ao enviar SMS. Verifique o número de telefone e tente novamente.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Código de verificação enviado com sucesso'
    });
  } catch (error: any) {
    console.error('Erro ao enviar código de verificação:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar código de verificação' },
      { status: 500 }
    );
  }
}
