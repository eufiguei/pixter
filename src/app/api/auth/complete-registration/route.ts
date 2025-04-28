import { NextResponse } from 'next/server';
import { createDriverWithPhone, formatPhoneNumber } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const phone = formData.get('phone') as string;
    const countryCode = formData.get('countryCode') as string || '55';
    const nome = formData.get('nome') as string;
    const profissao = formData.get('profissao') as string;
    const dataNascimento = formData.get('dataNascimento') as string;
    const cpf = formData.get('cpf') as string;
    const email = formData.get('email') as string || null;
    const avatarIndex = parseInt(formData.get('avatarIndex') as string || '0');
    const selfieFile = formData.get('selfie') as File || null;

    // Validação dos parâmetros
    if (!phone || !nome || !profissao || !cpf) {
      return NextResponse.json(
        { error: 'Dados incompletos para cadastro' },
        { status: 400 }
      );
    }

    // Formata o número de telefone
    const formattedPhone = formatPhoneNumber(phone, countryCode);
    
    // Dados do motorista
    const userData = {
      nome,
      profissao,
      data_nascimento: dataNascimento,
      cpf,
      email,
      avatarIndex,
      tipo: 'motorista',
    };

    // Cria ou atualiza o motorista no Supabase
    const { data, error } = await createDriverWithPhone(formattedPhone, userData);

    if (error) {
      console.error('Erro ao criar motorista:', error);
      return NextResponse.json(
        { error: error.message || 'Erro ao criar conta de motorista' },
        { status: 500 }
      );
    }

    // Upload da selfie se fornecida
    if (selfieFile && data?.user?.id) {
      const userId = data.user.id;
      const filePath = `motoristas/${userId}/selfie.jpg`;
      
      const { error: uploadError } = await uploadImage('avatars', filePath, selfieFile);
      
      if (uploadError) {
        console.error('Erro ao fazer upload da selfie:', uploadError);
        // Não falha o cadastro se o upload da selfie falhar
      }
    }

    return NextResponse.json({
      success: true,
      userId: data?.user?.id,
      session: data?.session
    });
  } catch (error: any) {
    console.error('Erro ao completar cadastro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao completar cadastro' },
      { status: 500 }
    );
  }
}
