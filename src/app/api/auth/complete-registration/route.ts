import { NextResponse } from 'next/server';
import {
  createDriverWithPhone,
  formatPhoneNumber
} from '@/lib/supabase/client';

export async function POST(req: Request) {
  try {
    /* 1. lê multipart */
    const formData = await req.formData();

    const phone          = formData.get('phone')          as string;
    const countryCode    = formData.get('countryCode')    as string;
    const nome           = formData.get('nome')           as string;
    const cpf            = formData.get('cpf')            as string;
    const profissao      = formData.get('profissao')      as string;
    const dataNascimento = formData.get('dataNascimento') as string;
    const avatarIndex    = formData.get('avatarIndex')    as string;
    const email          = formData.get('email')          as string | null;

    /* 2. monta userData */
    const formattedPhone = formatPhoneNumber(phone, countryCode);

    const userData: Record<string, any> = {
      nome,
      cpf,
      profissao,
      data_nascimento: dataNascimento,
      avatar_index: Number(avatarIndex)
    };
    if (email && email.trim() !== '') userData.email = email.trim();

    /* 3. cria motorista */
    const { data, error } = await createDriverWithPhone(formattedPhone, userData);

    if (error) {
      const code =
        error.message === 'phone_exists' ? 409
        : error.message === 'email_exists' ? 409
        : 500;
      return NextResponse.json({ error: error.message }, { status: code });
    }

    /* 4. sucesso */
    return NextResponse.json(
      { userId: data.user.id, session: data.session },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('complete-registration error:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
