import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validação dos parâmetros
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Fazer login com o usuário
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Erro ao fazer login:', error);
      return NextResponse.json(
        { error: error.message || 'Credenciais inválidas' },
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
