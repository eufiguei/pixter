import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, userData, password } = body;

    // Validação dos parâmetros
    if (!phone || !userData) {
      return NextResponse.json(
        { error: 'Dados incompletos para cadastro' },
        { status: 400 }
      );
    }

    // Verifica se o usuário já existe
    const { data: existingUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('celular', phone)
      .single();

    let userId;
    
    if (existingUser) {
      // Atualiza o usuário existente
      userId = existingUser.id;
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          ...userData,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
        
      if (updateError) {
        throw updateError;
      }
    } else {
      // Cria um novo usuário
      const email = userData.email || `${phone.replace(/\D/g, '')}@pixter.temp`;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: password || Math.random().toString(36).slice(-10), // Senha aleatória se não fornecida
        phone,
        options: {
          data: {
            tipo: 'motorista',
            nome: userData.nome
          }
        }
      });
      
      if (authError) {
        throw authError;
      }
      
      userId = authData.user?.id;
      
      // Cria o perfil do usuário
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          ...userData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (profileError) {
        throw profileError;
      }
    }
    
    // Gera uma sessão para o usuário
    const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({
      email: userData.email || `${phone.replace(/\D/g, '')}@pixter.temp`,
      password: password || Math.random().toString(36).slice(-10)
    });
    
    if (sessionError) {
      throw sessionError;
    }

    return NextResponse.json({
      success: true,
      userId,
      session
    });
  } catch (error: any) {
    console.error('Erro ao completar cadastro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao completar cadastro' },
      { status: 500 }
    );
  }
}
