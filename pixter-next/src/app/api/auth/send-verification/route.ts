import { NextResponse } from 'next/server';
import { sendVerificationSMS, generateVerificationCode } from '@/lib/twilio/client';
import { supabase } from '@/lib/supabase/client';

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
    const formattedPhone = `+${countryCode}${phone.replace(/\D/g, '')}`;
    
    // Gera código de verificação
    const verificationCode = await generateVerificationCode();
    
    // Armazena o código no Supabase para verificação posterior
    const { error: storeError } = await supabase
      .from('verification_codes')
      .upsert({
        phone: formattedPhone,
        code: verificationCode,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutos
      });
      
    if (storeError) {
      throw storeError;
    }
    
    // Envia SMS com o código
    const { success, error } = await sendVerificationSMS(formattedPhone, verificationCode);
    
    if (!success) {
      throw new Error(error);
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
