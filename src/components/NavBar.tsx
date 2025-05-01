// src/components/NavBar.tsx
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session, User } from '@supabase/supabase-js';

// Define a type for the user with the 'tipo' property
interface UserWithTipo extends User {
  user_metadata: {
    tipo?: 'cliente' | 'motorista';
    [key: string]: any;
  };
}

// Define a type for the session with the extended user type
interface SessionWithTipo extends Omit<Session, 'user'> {
  user: UserWithTipo | null;
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [session, setSession] = useState<SessionWithTipo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSessionData = async () => {
      setLoading(true);
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error getting session:', error);
        setSession(null);
      } else if (session) {
        // Check if user type ('tipo') is already in user_metadata
        if (!session.user?.user_metadata?.tipo) {
          // If not, fetch it from the profiles table
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('tipo')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.error('Error fetching profile type:', profileError);
            // Keep the session but without the type
            setSession(session as SessionWithTipo);
          } else if (profile) {
            // Add the type to the user metadata in the session state
            const updatedUser = {
              ...session.user,
              user_metadata: {
                ...session.user.user_metadata,
                tipo: profile.tipo,
              },
            } as UserWithTipo;
            setSession({ ...session, user: updatedUser });
          } else {
             // Profile not found, maybe still being created?
             console.warn('Profile not found for user:', session.user.id);
             setSession(session as SessionWithTipo);
          }
        } else {
          // Type already exists in session
          setSession(session as SessionWithTipo);
        }
      } else {
        setSession(null);
      }
      setLoading(false);
    };

    getSessionData();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);
      // Refetch session data on sign-in/sign-out to get updated profile info if needed
      getSessionData();
    });

    // Cleanup listener on component unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]); // Re-run if supabase client changes (shouldn't happen often)

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    } else {
      setSession(null); // Clear session state immediately
      router.push('/'); // Redirect to home page after sign out
      router.refresh(); // Refresh server components
    }
  };

  const isPublicPaymentPage = pathname?.includes('/pagamento/') && !pathname?.includes('/pagamento/sucesso') && !pathname?.includes('/pagamento/cancelado');
  const isHomePage = pathname === '/';
  const isDriverDashboard = pathname?.startsWith('/motorista/dashboard');
  const isClientDashboard = pathname?.startsWith('/cliente/dashboard');

  const renderLinks = () => {
    if (loading) {
      return <div className="text-sm font-medium">Carregando...</div>; // Show loading state
    }

    if (session && session.user) {
      const userType = session.user.user_metadata?.tipo;
      // Logged-in user
      if (userType === 'motorista') {
        // Logged-in Driver
        return (
          <nav className="flex items-center space-x-4">
            <Link href="/motorista/dashboard" className={`text-sm font-medium ${pathname === '/motorista/dashboard' ? 'text-purple-600' : 'hover:text-purple-600'}`}>Visão Geral</Link>
            <Link href="/motorista/dashboard/dados" className={`text-sm font-medium ${pathname === '/motorista/dashboard/dados' ? 'text-purple-600' : 'hover:text-purple-600'}`}>Meus Dados</Link>
            <Link href="/motorista/dashboard/pagina-pagamento" className={`text-sm font-medium ${pathname === '/motorista/dashboard/pagina-pagamento' ? 'text-purple-600' : 'hover:text-purple-600'}`}>Minha Página Pagamento</Link>
            <button onClick={handleSignOut} className="text-sm font-medium hover:text-purple-600">Sair</button>
          </nav>
        );
      } else if (userType === 'cliente') {
        // Logged-in Client
        return (
          <nav className="flex items-center space-x-4">
            <Link href="/cliente/dashboard" className={`text-sm font-medium ${pathname === '/cliente/dashboard' ? 'text-purple-600' : 'hover:text-purple-600'}`}>Dashboard</Link>
            {/* Add other client links here */}
            <button onClick={handleSignOut} className="text-sm font-medium hover:text-purple-600">Sair</button>
          </nav>
        );
      } else {
        // Logged-in user, but type is unknown/missing (show generic links or just logout)
         console.warn('User logged in but type (tipo) is missing:', session.user.id);
         return (
           <nav className="flex items-center space-x-4">
             <span className="text-sm font-medium text-gray-500">{session.user.email}</span>
             <button onClick={handleSignOut} className="text-sm font-medium hover:text-purple-600">Sair</button>
           </nav>
         );
      }
    } else {
      // Logged-out user
      if (isPublicPaymentPage) {
        return (
          <nav className="flex items-center space-x-4">
            <Link href="/login" className="text-sm font-medium hover:text-purple-600">Entrar</Link>
            <Link href="/cadastro" className="text-sm font-medium hover:text-purple-600">Criar Conta</Link>
          </nav>
        );
      } else {
         // Default for home and other public pages (e.g., login, signup)
         return (
          <nav className="flex items-center space-x-4">
            <Link href="/login" className="text-sm font-medium hover:text-purple-600">Entrar</Link>
            <Link href="/cadastro" className="text-sm font-medium hover:text-purple-600">Criar Conta</Link>
            <Link href="/motorista/login" className="text-sm font-medium hover:text-purple-600">Motoristas</Link>
          </nav>
        );
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white shadow-md">
      <Link href="/" className="flex items-center space-x-2">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#7c3aed">
          <rect width="24" height="24" rx="4" />
          <text x="12" y="17" fontSize="13" textAnchor="middle" fill="white" fontWeight="bold">P</text>
        </svg>
        <span className="font-bold text-2xl">Pixter</span>
      </Link>

      {renderLinks()}
    </header>
  );
}

