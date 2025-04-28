import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET(request: Request) {
  try {
    // Verificar autenticação
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Buscar perfil do motorista
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .eq('tipo', 'motorista')
      .single();
    
    if (error || !profile) {
      console.error('Erro ao buscar perfil:', error);
      return NextResponse.json(
        { error: 'Perfil não encontrado' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(profile);
  } catch (error: any) {
    console.error('Erro ao buscar perfil:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar perfil' },
      { status: 500 }
    );
  }
}
