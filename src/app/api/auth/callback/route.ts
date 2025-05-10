// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    try {
      await supabase.auth.exchangeCodeForSession(code)
      // Redirect to login page with success parameter
      return NextResponse.redirect(new URL('/login?verified=true', request.url))
    } catch (error) {
      console.error('Error processing verification:', error)
      // Redirect with error
      return NextResponse.redirect(new URL('/login?error=verification-failed', request.url))
    }
  }
  
  // No code, redirect to home page
  return NextResponse.redirect(new URL('/', request.url))
}