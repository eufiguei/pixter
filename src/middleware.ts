import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Global middleware that:
 *  1. Checks NextAuth session
 *  2. Redirects unauthenticated users away from protected pages → /login
 *  3. Redirects authenticated users away from login/cadastro pages → /cliente/dashboard
 */
export async function middleware(req: NextRequest) {
  /* -------------------------------------------------------------
     1. Get the NextAuth session token
  --------------------------------------------------------------*/
  const session = await getToken({
     req,
     secret: process.env.NEXTAUTH_SECRET
   });
   
  /* -------------------------------------------------------------
     2. Decide whether this path needs auth. Anything that is NOT
        /login, /cadastro, /public/* or /api/* is considered private.
  --------------------------------------------------------------*/
  const { pathname } = req.nextUrl;
   
  const isPublic = 
    pathname.startsWith('/login') ||
    pathname.startsWith('/cadastro') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/motorista/login') ||
    pathname.startsWith('/motorista/cadastro') ||
    pathname === '/';
   
  const isAuthenticated = !!session;
  
  // If not authenticated and trying to access a protected route
  if (!isAuthenticated && !isPublic) {
    // Preserve the original url so we can send the user back after login
    const loginUrl = req.nextUrl.clone();
         
    // Determine the right login page based on the path
    if (pathname.startsWith('/motorista')) {
      loginUrl.pathname = '/motorista/login';
    } else {
      loginUrl.pathname = '/login';
    }
         
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
   
  // If authenticated and trying to access login or registration pages
  if (isAuthenticated) {
    // Check if user is on login or registration pages
    const isLoginPage = 
      pathname === '/login' || 
      pathname === '/cadastro';
    
    const isMotoristaLoginPage = 
      pathname === '/motorista/login' || 
      pathname === '/motorista/cadastro';
    
    // Get user type from session token
    const userType = session.tipo as string || 'cliente';
    
    // Redirect to appropriate dashboard based on user type
    if (isLoginPage || (isMotoristaLoginPage && userType === 'cliente')) {
      const dashboardUrl = new URL('/cliente/dashboard', req.url);
      return NextResponse.redirect(dashboardUrl);
    } else if (isMotoristaLoginPage && userType === 'motorista') {
      const dashboardUrl = new URL('/motorista/dashboard', req.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }
   
  // Session is present OR the route is public → let the request pass
  return NextResponse.next();
}

/* ---------------------------------------------------------------
  Only run the middleware where it makes sense (everything except
  static assets & Next-internal paths).
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