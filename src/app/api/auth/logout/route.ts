import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Initialize client here
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
