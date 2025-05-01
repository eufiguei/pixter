import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // 1. Check Authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('Authentication error:', sessionError);
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    // userId is obtained from session, not form data

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo fornecido' },
        { status: 400 }
      );
    }

    // 3. Prepare File for Upload
    const fileExt = file.name.split('.').pop() || 'png'; // Default to png if no extension
    // Use a consistent name like selfie.ext within the user's folder
    const fileName = `selfie.${fileExt}`;
    const filePath = `${userId}/${fileName}`; // Store under user's ID folder

    // 4. Upload File to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('selfies') // Ensure 'selfies' bucket exists and has policies set up
      .upload(filePath, file, {
        // contentType: file.type, // Let Supabase infer content type
        upsert: true // Overwrite existing selfie for the user
      });

    if (uploadError) {
      console.error('Erro ao fazer upload da selfie:', uploadError);
      return NextResponse.json(
        { error: `Falha no upload: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 5. Get Public URL
    const { data: urlData } = supabase.storage
      .from('selfies')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
        // Attempt to delete the uploaded file if URL retrieval fails
        await supabase.storage.from('selfies').remove([filePath]);
        console.error('Failed to get public URL for uploaded selfie:', filePath);
        return NextResponse.json({ error: 'Não foi possível obter a URL pública da selfie.' }, { status: 500 });
    }
    const newSelfieUrl = urlData.publicUrl;

    // 6. Update Selfie URL in User's Profile
    // Use the route handler client, assuming RLS allows users to update their own profile
    const { error: updateError } = await supabase
      .from('profiles') // Update the 'profiles' table
      .update({ selfie_url: newSelfieUrl, updated_at: new Date().toISOString() })
      .eq('id', userId); // Update the profile matching the authenticated user ID

    if (updateError) {
      // Attempt to delete the uploaded file if DB update fails
      await supabase.storage.from('selfies').remove([filePath]);
      console.error('Erro ao atualizar selfie_url no perfil:', updateError);
      return NextResponse.json(
        { error: `Falha ao atualizar perfil: ${updateError.message}` },
        { status: 500 }
      );
    }

    // 7. Return Success Response
    return NextResponse.json({
      success: true,
      message: 'Selfie atualizada com sucesso!',
      selfieUrl: newSelfieUrl
    });

  } catch (error: any) {
    console.error('Erro no upload de selfie:', error);
    if (error instanceof Error && error.message.includes('Payload too large')) {
        return NextResponse.json({ error: 'Arquivo muito grande. O limite é 1MB.' }, { status: 413 });
    }
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

