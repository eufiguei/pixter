// src/components/NavBar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';

export default function NavBar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname() || '/';

  // 1) Redirect away from login pages if already signed in
  useEffect(() => {
    if (status === 'loading') return;

    const tipo = session?.user?.tipo;
    // driver tries to hit /motorista/login
    if (tipo === 'motorista' && pathname.startsWith('/motorista/login')) {
      router.replace('/motorista/dashboard/overview');
    }
    // client tries to hit /login
    if (tipo === 'cliente' && pathname === '/login') {
      router.replace('/cliente/dashboard');
    }
  }, [status, session, pathname, router]);

  // 2) Sign-out handler (also auto-logout when switching roles)
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/');
  };

  // 3) Detect “public payment” pages: one numeric segment of 10–14 digits
  const isPublicPaymentPage = /^\/\d{10,14}$/.test(pathname);

  // 4) Build logo link
  let logoHref = '/';
  if (status === 'authenticated') {
    if (session.user.tipo === 'motorista') logoHref = '/motorista/dashboard/overview';
    else if (session.user.tipo === 'cliente') logoHref = '/cliente/dashboard';
  }

  // 5) Pick which nav links to render
  let links;
  if (status === 'loading') {
    links = <div className="h-6 w-24 bg-gray-200 animate-pulse rounded" />;
  } else if (isPublicPaymentPage) {
    // — Public page (only client flows here)
    if (status === 'authenticated' && session.user.tipo === 'cliente') {
      // client when signed in on public page
      links = (
        <nav className="flex space-x-4">
          <Link href="/cliente/dashboard">Dashboard</Link>
          <Link href="/cliente/dashboard/historico">Histórico</Link>
          <Link href="/cliente/payment-methods">Carteira</Link>
          <button onClick={handleSignOut}>Sair</button>
        </nav>
      );
    } else {
      // visitor or driver “pretending” here
      const returnTo = `?returnTo=${encodeURIComponent(pathname)}`;
      links = (
        <nav className="flex space-x-4">
          <Link href={`/login${returnTo}`}>Entrar</Link>
          <Link href={`/cadastro${returnTo}`}>Criar Conta</Link>
        </nav>
      );
    }
  } else if (status === 'authenticated' && session.user.tipo === 'motorista') {
    // — Driver everywhere else
    links = (
      <nav className="flex space-x-4">
        <Link href="/motorista/dashboard/pagamentos">Pagamentos</Link>
        <Link href="/motorista/dashboard/dados">Meus Dados</Link>
        <Link href="/motorista/dashboard/pagina-pagamento">Minha Página</Link>
        <button onClick={handleSignOut}>Sair</button>
      </nav>
    );
  } else if (status === 'authenticated' && session.user.tipo === 'cliente') {
    // — Client everywhere else
    links = (
      <nav className="flex space-x-4">
        <Link href="/cliente/dashboard">Dashboard</Link>
        <Link href="/cliente/dashboard/historico">Histórico</Link>
        <Link href="/cliente/payment-methods">Carteira</Link>
        <button onClick={handleSignOut}>Sair</button>
      </nav>
    );
  } else {
    // — Totally logged-out on non-payment pages
    links = (
      <nav className="flex space-x-4">
        <Link href="/login">Entrar</Link>
        <Link href="/cadastro">Criar Conta</Link>
        <Link href="/motorista/login">Motoristas</Link>
      </nav>
    );
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white shadow">
      <Link href={logoHref} className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <span className="font-bold text-2xl">Pixter</span>
      </Link>
      {links}
    </header>
  );
}
