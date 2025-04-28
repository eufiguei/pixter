import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    // Fazer logout
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Erro ao fazer logout:', error);
      return NextResponse.json(
        { error: error.message || 'Erro ao fazer logout' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao fazer logout:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer logout' },
      { status: 500 }
    );
  }
}
