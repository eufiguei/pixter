import { NextResponse } from 'next/server';
import { formatPhoneNumber, signInWithPhone } from '@/lib/supabase/client';

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
    
    // Tenta fazer login com o telefone
    const { data, error } = await signInWithPhone(formattedPhone);
    
    if (error) {
      console.error('Erro ao fazer login:', error);
      return NextResponse.json(
        { error: error.message || 'Motorista não encontrado ou erro ao fazer login' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Login realizado com sucesso',
      session: data
    });
  } catch (error: any) {
    console.error('Erro ao fazer login:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer login' },
      { status: 500 }
    );
  }
}
