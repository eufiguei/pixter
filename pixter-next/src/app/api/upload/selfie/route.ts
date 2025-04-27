import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    
    if (!file || !userId) {
      return NextResponse.json(
        { error: 'Arquivo ou ID do usuário não fornecido' },
        { status: 400 }
      );
    }
    
    // Upload para o bucket do Supabase
    const { data, error } = await supabase.storage
      .from('selfies')
      .upload(`${userId}/selfie.png`, file, {
        cacheControl: '3600',
        upsert: true
      });
      
    if (error) {
      throw error;
    }
    
    // Atualiza o perfil do usuário com o URL da selfie
    const { data: publicUrl } = supabase.storage
      .from('selfies')
      .getPublicUrl(`${userId}/selfie.png`);
      
    await supabase
      .from('profiles')
      .update({
        selfie_url: publicUrl.publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    return NextResponse.json({
      success: true,
      url: publicUrl.publicUrl
    });
  } catch (error: any) {
    console.error('Erro ao fazer upload da selfie:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer upload da selfie' },
      { status: 500 }
    );
  }
}
