import { NextResponse } from 'next/server';
import { verifyCode, deleteVerificationCode, formatPhoneNumber } from '@/lib/supabase/client';
import { supabase } from '@/lib/supabase/client';

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
    const { data: verificationData, error: verificationError } = await verifyCode(formattedPhone, code);
    
    if (verificationError || !verificationData) {
      return NextResponse.json(
        { error: 'Código inválido ou expirado' },
        { status: 401 }
      );
    }
    
    // Deleta o código usado
    await deleteVerificationCode(formattedPhone);
    
    // Busca o perfil do motorista pelo telefone
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('celular', formattedPhone)
      .eq('tipo', 'motorista')
      .single();
    
    if (profileError || !profileData) {
      return NextResponse.json(
        { error: 'Motorista não encontrado' },
        { status: 404 }
      );
    }
    
    // Gera um email baseado no telefone para login
    const email = `${formattedPhone.replace(/\D/g, '')}@pixter.temp`;
    
    // Busca o usuário pelo email
    const { data: userData, error: userError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false
      }
    });
    
    if (userError) {
      return NextResponse.json(
        { error: userError.message || 'Erro ao fazer login' },
        { status: 500 }
      );
    }
    
    // Retorna os dados da sessão
    return NextResponse.json({
      success: true,
      userId: profileData.id,
      session: userData.session
    });
  } catch (error: any) {
    console.error('Erro ao fazer login:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer login' },
      { status: 500 }
    );
  }
}
