// src/components/NavBar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session, User } from '@supabase/supabase-js';

// Extend Supabase User to include your `tipo` metadata
interface UserWithTipo extends User {
  user_metadata: {
    tipo?: 'cliente' | 'motorista';
    [key: string]: any;
  };
}

// Extend Session similarly
interface SessionWithTipo extends Omit<Session, 'user'> {
  user: UserWithTipo | null;
}

export default function NavBar() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [session, setSession] = useState<SessionWithTipo | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session + tipo on mount & on auth changes
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Error fetching session:', error);
        setSession(null);
      } else if (session) {
        // If we already have tipo in metadata, skip fetch
        if (session.user?.user_metadata?.tipo) {
          setSession(session as SessionWithTipo);
        } else {
          // Else fetch from profiles table
          const { data: profile, error: pErr } = await supabase
            .from('profiles')
            .select('tipo')
            .eq('id', session.user.id)
            .single();

          if (pErr && pErr.code !== 'PGRST116') {
            console.error('Error fetching perfil.tipo:', pErr);
            setSession(session as SessionWithTipo);
          } else if (profile) {
            setSession({
              ...session,
              user: {
                ...session.user,
                user_metadata: {
                  ...session.user.user_metadata,
                  tipo: profile.tipo,
                },
              },
            });
          } else {
            setSession(session as SessionWithTipo);
          }
        }
      } else {
        setSession(null);
      }
      setLoading(false);
    };

    load();

    // subscribe to auth changes to always have fresh tipo
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    router.push('/');
    router.refresh();
  };

  // Hide everything on /pagamento/[id]
  const isPublicPaymentPage =
    pathname.startsWith('/pagamento/') && pathname.split('/').length === 3;

  // Are we inside a driver dashboard?
  const isDriverDash = pathname.startsWith('/motorista/dashboard');

  // Are we inside a client dashboard?
  const isClientDash =
    pathname.startsWith('/cliente/dashboard') ||
    pathname.startsWith('/payment-methods');

  // Logo always points to the correct dashboard or home
  const getLogoLink = () => {
    const tipo = session?.user?.user_metadata?.tipo;
    if (tipo === 'motorista') return '/motorista/dashboard';
    if (tipo === 'cliente') return '/cliente/dashboard';
    return '/';
  };

  // Build `returnTo=` param for end-client flows
  const returnToParam = `?returnTo=${encodeURIComponent(pathname)}`;

  const renderLinks = () => {
    if (loading) {
      return (
        <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
      );
    }

    // --- logged in ---
    if (session?.user) {
      const tipo = session.user.user_metadata?.tipo;
      if (tipo === 'motorista') {
        return (
          <nav className="flex items-center space-x-4">
            <Link href="/motorista/dashboard#pagamentos" className="text-sm font-medium hover:text-purple-600">
              Pagamentos
            </Link>
            <Link href="/motorista/dashboard#dados" className="text-sm font-medium hover:text-purple-600">
              Meus Dados
            </Link>
            <Link href="/motorista/dashboard#pagina-pagamento" className="text-sm font-medium hover:text-purple-600">
              Minha Página
            </Link>
            <button onClick={handleSignOut} className="text-sm font-medium hover:text-purple-600">
              Sair
            </button>
          </nav>
        );
      }
      if (tipo === 'cliente') {
        return (
          <nav className="flex items-center space-x-4">
            <Link href="/cliente/dashboard" className={`text-sm font-medium ${pathname === '/cliente/dashboard' ? 'text-purple-600' : 'hover:text-purple-600'}`}>
              Histórico
            </Link>
            <Link href="/payment-methods" className={`text-sm font-medium ${pathname.startsWith('/payment-methods') ? 'text-purple-600' : 'hover:text-purple-600'}`}>
              Cartões
            </Link>
            <button onClick={handleSignOut} className="text-sm font-medium hover:text-purple-600">
              Sair
            </button>
          </nav>
        );
      }
      // fallback if we can’t determine tipo
      return (
        <nav className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-500">
            {session.user.email}
          </span>
          <button onClick={handleSignOut} className="text-sm font-medium hover:text-purple-600">
            Sair
          </button>
        </nav>
      );
    }

    // --- public visitor ---
    if (isPublicPaymentPage) {
      // don’t show any links
      return null;
    }

    // not signed in: show entry links
    return (
      <nav className="flex items-center space-x-4">
        <Link href={`/login${returnToParam}`} className="text-sm font-medium hover:text-purple-600">
          Entrar
        </Link>
        <Link href={`/cadastro${returnToParam}`} className="text-sm font-medium hover:text-purple-600">
          Criar Conta
        </Link>
        <Link href="/motorista/login" className="text-sm font-medium hover:text-purple-600">
          Motoristas
        </Link>
      </nav>
    );
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white shadow-md">
      <Link href={getLogoLink()} className="flex items-center space-x-2">
        <div className="w-8 h-8 flex items-center justify-center rounded bg-purple-600">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <span className="font-bold text-2xl">Pixter</span>
      </Link>
      {renderLinks()}
    </header>
  );
}
