import { NextResponse } from 'next/server';
import { verifyCode, deleteVerificationCode, formatPhoneNumber } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, code, countryCode = '55' } = body;

    // Validação dos parâmetros
    if (!phone || !code) {
      return NextResponse.json(
        { error: 'Número de telefone e código são obrigatórios' },
        { status: 400 }
      );
    }

    // Formata o número de telefone
    const formattedPhone = formatPhoneNumber(phone, countryCode);
    
    // Verifica o código
    const { data, error } = await verifyCode(formattedPhone, code);
    
    if (error || !data) {
      return NextResponse.json(
        { error: 'Código inválido ou expirado' },
        { status: 401 }
      );
    }
    
    // Deleta o código usado
    await deleteVerificationCode(formattedPhone);
    
    return NextResponse.json({
      success: true,
      message: 'Código verificado com sucesso'
    });
  } catch (error: any) {
    console.error('Erro ao verificar código:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao verificar código' },
      { status: 500 }
    );
  }
}
