import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const driverId = formData.get('driverId') as string;
    
    if (!file || !driverId) {
      return NextResponse.json(
        { error: 'Arquivo ou ID do motorista não fornecido' },
        { status: 400 }
      );
    }

    // Verificar se o usuário tem permissão para atualizar este motorista
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session || authData.session.user.id !== driverId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      );
    }

    // Converter o arquivo para um buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Gerar um nome de arquivo único
    const fileExt = file.name.split('.').pop();
    const fileName = `${driverId}-${Date.now()}.${fileExt}`;
    const filePath = `${driverId}/${fileName}`;

    // Fazer upload do arquivo para o Supabase Storage
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (error) {
      console.error('Erro ao fazer upload do avatar:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Obter a URL pública do arquivo
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Atualizar a URL do avatar no perfil do motorista
    const { error: updateError } = await supabase
      .from('drivers')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', driverId);

    if (updateError) {
      console.error('Erro ao atualizar avatar_url:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      avatarUrl: urlData.publicUrl
    });
  } catch (error) {
    console.error('Erro no upload de avatar:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
