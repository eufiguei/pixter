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
    
    // Buscar pagamentos do motorista
    const { data: payments, error } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('driver_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar pagamentos:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar pagamentos' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ payments });
  } catch (error: any) {
    console.error('Erro ao buscar pagamentos:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar pagamentos' },
      { status: 500 }
    );
  }
}
