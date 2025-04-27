import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, code, userData } = body;

    // Validação dos parâmetros
    if (!phone || !code) {
      return NextResponse.json(
        { error: 'Número de telefone e código são obrigatórios' },
        { status: 400 }
      );
    }

    // Busca o código armazenado
    const { data: verificationData, error: fetchError } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (fetchError || !verificationData) {
      throw new Error('Código inválido ou expirado');
    }

    // Cria ou atualiza o usuário no Supabase
    let userId;
    
    // Verifica se o usuário já existe
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('celular', phone)
      .single();
      
    if (existingUser) {
      userId = existingUser.id;
      
      // Atualiza o perfil existente
      await supabase
        .from('profiles')
        .update({
          ...userData,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    } else {
      // Cria um novo usuário anônimo
      const { data: newUser, error: createError } = await supabase.auth.signUp({
        email: userData.email || `${phone.replace(/\D/g, '')}@example.com`,
        password: Math.random().toString(36).slice(-10), // Senha aleatória
        phone: phone
      });
      
      if (createError) {
        throw createError;
      }
      
      userId = newUser.user?.id;
      
      // Cria o perfil do usuário
      await supabase
        .from('profiles')
        .insert({
          id: userId,
          celular: phone,
          ...userData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }
    
    // Gera um token de sessão
    const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({
      email: userData.email || `${phone.replace(/\D/g, '')}@example.com`,
      password: Math.random().toString(36).slice(-10) // Mesma senha aleatória
    });
    
    if (sessionError) {
      throw sessionError;
    }

    // Remove o código verificado
    await supabase
      .from('verification_codes')
      .delete()
      .eq('phone', phone);

    return NextResponse.json({
      success: true,
      userId,
      session: session
    });
  } catch (error: any) {
    console.error('Erro ao verificar código:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao verificar código' },
      { status: 500 }
    );
  }
}
