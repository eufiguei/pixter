import { NextResponse } from 'next/server';
import { sendVerificationSMS, generateVerificationCode } from '@/lib/twilio/client';

export async function GET(request: Request) {
  try {
    // Número de teste - substitua pelo seu número para testar
    const testPhone = '+5511995843051'; // Substitua pelo seu número
    const code = await generateVerificationCode();
    
    const result = await sendVerificationSMS(testPhone, code);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return NextResponse.json({
      success: true,
      message: `Código ${code} enviado com sucesso para ${testPhone}`,
      messageId: result.messageId
    });
  } catch (error) {
    console.error('Erro no teste de SMS:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar SMS de teste' },
      { status: 500 }
    );
  }
}
