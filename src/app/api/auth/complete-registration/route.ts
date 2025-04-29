import { NextResponse } from 'next/server';
import {
  createDriverWithPhone,
  formatPhoneNumber
} from '@/lib/supabase/client';

export const runtime = 'edge';          // opcional, se estiver usando Edge

export async function POST(req: Request) {
  try {
    /* -------- 1. Lê o multipart -------- */
    const formData = await req.formData();

    // Campos obrigatórios
    const phone          = formData.get('phone')          as string;
    const countryCode    = formData.get('countryCode')    as string;
    const nome           = formData.get('nome')           as string;
    const cpf            = formData.get('cpf')            as string;
    const profissao      = formData.get('profissao')      as string;
    const dataNascimento = formData.get('dataNascimento') as string;
    const avatarIndex    = formData.get('avatarIndex')    as string;

    // Opcional
    const email   = formData.get('email')  as string | null;
    const selfie  = formData.get('selfie') as File   | null;

    /* -------- 2. Sanitiza / formata -------- */
    const formattedPhone = formatPhoneNumber(phone, countryCode);

    const userData: Record<string, any> = {
      nome,
      cpf,
      profissao,
      data_nascimento: dataNascimento,
      avatar_index: Number(avatarIndex),
    };

    // só inclui email se realmente veio algo
    if (email && email.trim() !== '') {
      userData.email = email;
    }

    /* -------- 3. Cria (ou atualiza) motorista -------- */
    const { data, error } = await createDriverWithPhone(formattedPhone, userData);
    if (error) {
      console.error('Erro ao criar motorista:', error);
      return NextResponse.json(
        { error: 'Falha ao criar motorista' },
        { status: 500 }
      );
    }

    /* -------- 4. (Opcional) faz upload da selfie -------- */
    if (selfie && selfie.size > 0) {
      // Ex.: supabase.storage.from('selfies').upload(...)
      // não incluí o código porque depende do seu bucket
    }

    /* -------- 5. Sucesso -------- */
    return NextResponse.json(
      {
        message: 'Cadastro concluído!',
        userId : data?.user?.id,
        session: data?.session
      },
      { status: 200 }
    );

  } catch (err: any) {
    console.error('Erro ao completar cadastro:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
