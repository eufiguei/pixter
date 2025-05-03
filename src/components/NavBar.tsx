// src/components/NavBar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

export default function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname() || '/';
  const router = useRouter();

  // quick checks
  const isLoading = status === 'loading';
  const isPublicPay = pathname.startsWith('/pagamento/');
  const userType = session?.user?.tipo; // must be set in your NextAuth JWT/user object

  // Logo always goes to the right home
  const logoHref = session
    ? userType === 'motorista'
      ? '/motorista/dashboard'
      : '/cliente/dashboard'
    : '/';

  // signOut handler
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/');
  };

  // Build the right-hand links
  function renderLinks() {
    if (isLoading) {
      return <div className="h-6 w-24 bg-gray-200 animate-pulse rounded" />;
    }

    // ── 1) PUBLIC PAYMENT PAGES ─────────────────────────────────
    if (isPublicPay) {
      // if a client is already signed in, show only their links
      if (session && userType === 'cliente') {
        return (
          <nav className="flex items-center space-x-4">
            <Link
              href="/cliente/dashboard"
              className="text-sm font-medium hover:text-purple-600"
            >
              Histórico
            </Link>
            <Link
              href="/payment-methods"
              className="text-sm font-medium hover:text-purple-600"
            >
              Métodos
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm font-medium hover:text-purple-600"
            >
              Sair
            </button>
          </nav>
        );
      }

      // otherwise (not signed in OR motorista), just show client sign-in/sign-up
      return (
        <nav className="flex items-center space-x-4">
          <Link href="/login" className="text-sm font-medium hover:text-purple-600">
            Entrar
          </Link>
          <Link href="/cadastro" className="text-sm font-medium hover:text-purple-600">
            Criar Conta
          </Link>
        </nav>
      );
    }

    // ── 2) EVERYTHING ELSE ────────────────────────────────────────
    if (session) {
      if (userType === 'motorista') {
        return (
          <nav className="flex items-center space-x-4">
            <Link
              href="/motorista/dashboard#pagamentos"
              className="text-sm font-medium hover:text-purple-600"
            >
              Pagamentos
            </Link>
            <Link
              href="/motorista/dashboard#dados"
              className="text-sm font-medium hover:text-purple-600"
            >
              Meus Dados
            </Link>
            <Link
              href="/motorista/dashboard#pagina-pagamento"
              className="text-sm font-medium hover:text-purple-600"
            >
              Minha Página
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm font-medium hover:text-purple-600"
            >
              Sair
            </button>
          </nav>
        );
      } else {
        // logged-in cliente
        return (
          <nav className="flex items-center space-x-4">
            <Link
              href="/cliente/dashboard"
              className="text-sm font-medium hover:text-purple-600"
            >
              Histórico
            </Link>
            <Link
              href="/payment-methods"
              className="text-sm font-medium hover:text-purple-600"
            >
              Métodos
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm font-medium hover:text-purple-600"
            >
              Sair
            </button>
          </nav>
        );
      }
    }

    // ── 3) NOT SIGNED IN ─────────────────────────────────────────
    return (
      <nav className="flex items-center space-x-4">
        <Link href="/login" className="text-sm font-medium hover:text-purple-600">
          Entrar
        </Link>
        <Link href="/cadastro" className="text-sm font-medium hover:text-purple-600">
          Criar Conta
        </Link>
        <Link href="/motorista/login" className="text-sm font-medium hover:text-purple-600">
          Motoristas
        </Link>
      </nav>
    );
  }

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
