// src/components/NavBar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';

export default function NavBar() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  // Determine which menu to show
  const isPaymentPage = pathname.match(/^\/\d+$/);
  const isDriverDash = pathname.startsWith('/motorista/dashboard');
  const isClientDash = pathname.startsWith('/cliente/dashboard') || pathname.startsWith('/payment-methods');

  // Logo link destination
  const logoHref = session?.user?.tipo === 'motorista'
    ? '/motorista/dashboard'
    : session?.user?.tipo === 'cliente'
      ? '/cliente/dashboard'
      : '/';

  // Sign out handler
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/');
  };

  // Render right‐side links
  const renderLinks = () => {
    if (loading) {
      return <div className="h-6 w-24 bg-gray-200 animate-pulse rounded" />;
    }

    if (session?.user) {
      if (session.user.tipo === 'motorista') {
        return (
          <nav className="flex space-x-4">
            <Link href="/motorista/dashboard#pagamentos" className="hover:text-purple-600">Pagamentos</Link>
            <Link href="/motorista/dashboard#dados" className="hover:text-purple-600">Meus Dados</Link>
            <Link href="/motorista/dashboard#pagina-pagamento" className="hover:text-purple-600">Minha Página</Link>
            <button onClick={handleSignOut} className="hover:text-purple-600">Sair</button>
          </nav>
        );
      }
      if (session.user.tipo === 'cliente') {
        return (
          <nav className="flex space-x-4">
            <Link href="/cliente/dashboard" className={`hover:text-purple-600 ${isClientDash ? 'text-purple-600' : ''}`}>Histórico</Link>
            <Link href="/payment-methods" className={`hover:text-purple-600 ${pathname.startsWith('/payment-methods') ? 'text-purple-600' : ''}`}>Cartões</Link>
            <button onClick={handleSignOut} className="hover:text-purple-600">Sair</button>
          </nav>
        );
      }
      // fallback for unknown tipo
      return (
        <nav className="flex space-x-4">
          <span className="text-gray-500">{session.user.email}</span>
          <button onClick={handleSignOut} className="hover:text-purple-600">Sair</button>
        </nav>
      );
    }

    // not signed in
    if (isPaymentPage) {
      return null; // hide links on public payment page
    }

    // preserve where client came from
    const returnTo = encodeURIComponent(pathname);
    return (
      <nav className="flex space-x-4">
        <Link href={`/login?returnTo=${returnTo}`} className="hover:text-purple-600">Entrar</Link>
        <Link href={`/cadastro?returnTo=${returnTo}`} className="hover:text-purple-600">Criar Conta</Link>
        <Link href="/motorista/login" className="hover:text-purple-600">Motoristas</Link>
      </nav>
    );
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white shadow-md">
      <Link href={logoHref} className="flex items-center space-x-2">
        <div className="w-8 h-8 flex items-center justify-center rounded bg-purple-600">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <span className="font-bold text-2xl">Pixter</span>
      </Link>
      {renderLinks()}
    </header>
  );
}
