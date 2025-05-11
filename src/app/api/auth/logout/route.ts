import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // Sign out the user
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out:', error);
      return NextResponse.json(
        { error: error.message || 'Erro ao fazer logout' },
        { status: 500 }
      );
    }

    // The Auth Helpers middleware should handle clearing the session cookie.
    // Just return success.
    return NextResponse.json({ success: true, message: 'Logout realizado com sucesso.' });

  } catch (error: any) {
    console.error('Erro geral no logout:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}

