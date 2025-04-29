
// src/app/api/auth/complete-registration/route.ts
import { NextResponse } from 'next/server';
import { createDriverWithPhone, formatPhoneNumber } from '@/lib/supabase/client';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const phone = formData.get('phone') as string;
    const countryCode = formData.get('countryCode') as string;
    const nome = formData.get('nome') as string;
    const cpf = formData.get('cpf') as string;
    const profissao = formData.get('profissao') as string;
    const dataNascimento = formData.get('dataNascimento') as string;
    const avatarIndex = formData.get('avatarIndex') as string;
    const email = formData.get('email') as string | null;

    const userData: any = {
      nome,
      cpf,
      profissao,
      data_nascimento: dataNascimento,
      avatar_index: Number(avatarIndex)
    };
    if (email && email.trim() !== '') userData.email = email.trim();

    const formattedPhone = formatPhoneNumber(phone, countryCode);
    const { data, error } = await createDriverWithPhone(formattedPhone, userData);

    if (error) {
      const msg = error.message;
      const status = msg === 'phone_exists' || msg === 'email_exists' ? 409 : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    return NextResponse.json({ userId: data.user.id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 });
  }
}
