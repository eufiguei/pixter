'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session, User } from '@supabase/supabase-js';

// Extend the user type with your `tipo` field:
interface UserWithTipo extends User {
  user_metadata: { tipo?: 'cliente' | 'motorista' };
}

interface SessionWithTipo extends Omit<Session, 'user'> {
  user: UserWithTipo | null;
}

export default function NavBar() {
  const pathname = usePathname()!;
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [session, setSession] = useState<SessionWithTipo | null>(null);
  const [loading, setLoading] = useState(true);

  // load session + tipo
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) {
        console.error(error);
        setSession(null);
      } else if (session) {
        // if tipo already in metadata, done
        if (session.user?.user_metadata?.tipo) {
          setSession(session as SessionWithTipo);
        } else {
          // else fetch from your profiles table
          const { data: profile, error: pErr } = await supabase
            .from('profiles')
            .select('tipo')
            .eq('id', session.user!.id)
            .single();
          if (profile?.tipo) {
            setSession({
              ...session,
              user: {
                ...session.user!,
                user_metadata: { tipo: profile.tipo },
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
    const { data: listener } = supabase.auth.onAuthStateChange(load);
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    router.push('/');
  };

  // detect your “public payment” page: it’s exactly one numeric segment, e.g. `/5511995843051`
  const isPublicPaymentPage = /^\/\d{10,11}$/.test(pathname);

  // logo click target
  const getLogoLink = () => {
    const tipo = session?.user?.user_metadata?.tipo;
    if (tipo === 'motorista') return '/motorista/dashboard';
    if (tipo === 'cliente')   return '/cliente/dashboard';
    return '/';
  };

  // now render the right links
  const renderLinks = () => {
    if (loading) {
      return <div className="h-6 w-24 bg-gray-200 animate-pulse rounded" />;
    }

    // 1) if we’re on the public‐payment page, only show client Entrar/Cadastrar
    if (isPublicPaymentPage) {
      return (
        <nav className="flex items-center space-x-4">
          <Link href="/login" className="text-sm hover:text-purple-600">Entrar</Link>
          <Link href="/cadastro" className="text-sm hover:text-purple-600">Criar Conta</Link>
        </nav>
      );
    }

    // 2) logged-in motorista?
    if (session?.user?.user_metadata?.tipo === 'motorista') {
      return (
        <nav className="flex items-center space-x-4">
          <Link href="/motorista/dashboard#pagamentos" className="text-sm hover:text-purple-600">Pagamentos</Link>
          <Link href="/motorista/dashboard#dados" className="text-sm hover:text-purple-600">Meus Dados</Link>
          <Link href="/motorista/dashboard#pagina-pagamento" className="text-sm hover:text-purple-600">Minha Página</Link>
          <button onClick={handleSignOut} className="text-sm hover:text-purple-600">Sair</button>
        </nav>
      );
    }

    // 3) logged-in cliente?
    if (session?.user?.user_metadata?.tipo === 'cliente') {
      return (
        <nav className="flex items-center space-x-4">
          <Link href="/cliente/dashboard" className="text-sm hover:text-purple-600">Histórico</Link>
          <Link href="/payment-methods" className="text-sm hover:text-purple-600">Cartões</Link>
          <button onClick={handleSignOut} className="text-sm hover:text-purple-600">Sair</button>
        </nav>
      );
    }

    // 4) otherwise “not signed in”
    return (
      <nav className="flex items-center space-x-4">
        <Link href="/login"   className="text-sm hover:text-purple-600">Entrar</Link>
        <Link href="/cadastro" className="text-sm hover:text-purple-600">Criar Conta</Link>
        <Link href="/motorista/login" className="text-sm hover:text-purple-600">Motoristas</Link>
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
