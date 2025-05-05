import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

/**
 * Global middleware that:
 *  1. Re-hydrates / refreshes the Supabase session cookie on every request
 *  2. Redirects unauthenticated users away from protected pages → /login
 */
export async function middleware(req: NextRequest) {
  /* -------------------------------------------------------------
     1  Create a draft response and pass it to Supabase so it can
        set / refresh the auth cookie headers before we return.
  --------------------------------------------------------------*/
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Await the promise -- DO NOT race ahead or you’ll create loops
  const {
    data: { session },
  } = await supabase.auth.getSession();

  /* -------------------------------------------------------------
     2  Decide whether this path needs auth.  Anything that is NOT
        /login, /cadastro, /public/* or /api/* is considered private.
  --------------------------------------------------------------*/
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/cadastro') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/api');

  const isAuthenticated = !!session;

  if (!isAuthenticated && !isPublic) {
    // Preserve the original url so we can send the user back after login
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session is present OR the route is public → let the request pass
  return res;
}

/* ---------------------------------------------------------------
   Only run the middleware where it makes sense (everything except
   static assets & Next-internal paths).  Feel free to tune.
----------------------------------------------------------------*/
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static        (static files)
     * - _next/image         (image optimisation)
     * - favicon.ico         (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};