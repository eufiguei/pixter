// src/components/NavBar.tsx
// Updated based on user feedback (IMG_0354, IMG_0355, IMG_0356, A3BE9B45)

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

          if (profileError && profileError.code !== 'PGRST116') { // Ignore 'not found' error
            console.error('Error fetching profile type:', profileError);
            setSession(session as SessionWithTipo); // Keep session without type
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
             console.warn('Profile not found for user, cannot determine type:', session.user.id);
             setSession(session as SessionWithTipo); // Keep session without type
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
  }, [supabase]);

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

  // Determine page context
  const isPublicPaymentPage = pathname?.startsWith('/pagamento/') && pathname.split('/').length === 3; // Matches /pagamento/[id] but not subpages
  const isDriverDashboard = pathname?.startsWith('/motorista/dashboard');
  const isClientDashboard = pathname?.startsWith('/cliente/dashboard') || pathname?.startsWith('/payment-methods'); // Include payment methods page

  // Determine logo link destination
  const getLogoLink = () => {
    if (session && session.user) {
      const userType = session.user.user_metadata?.tipo;
      // Link to the main dashboard page for logged-in users
      if (userType === 'motorista') return '/motorista/dashboard'; 
      if (userType === 'cliente') return '/cliente/dashboard';
    }
    return '/'; // Default to home page if logged out or type unknown
  };

  const renderLinks = () => {
    if (loading) {
      return <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>; // Placeholder for loading
    }

    // --- Logged IN --- 
    if (session && session.user) {
      const userType = session.user.user_metadata?.tipo;

      if (userType === 'motorista') {
        // Logged-in Driver Links (Updated based on A3BE9B45)
        // Assuming a single dashboard page at /motorista/dashboard now
        return (
          <nav className="flex items-center space-x-4">
            <Link href="/motorista/dashboard#pagamentos" className={`text-sm font-medium hover:text-purple-600`}>Pagamentos Recebidos</Link>
            <Link href="/motorista/dashboard#dados" className={`text-sm font-medium hover:text-purple-600`}>Meus Dados</Link>
            <Link href="/motorista/dashboard#pagina-pagamento" className={`text-sm font-medium hover:text-purple-600`}>Minha Página de Pagamento</Link>
            <button onClick={handleSignOut} className="text-sm font-medium hover:text-purple-600">Sair</button>
          </nav>
        );
      } else if (userType === 'cliente') {
        // Logged-in Client Links (Updated Structure from IMG_0354)
        return (
          <nav className="flex items-center space-x-4">
            <Link href="/cliente/dashboard" className={`text-sm font-medium ${pathname === '/cliente/dashboard' ? 'text-purple-600' : 'hover:text-purple-600'}`}>Histórico de Pagamentos</Link>
            <Link href="/payment-methods" className={`text-sm font-medium ${pathname?.startsWith('/payment-methods') ? 'text-purple-600' : 'hover:text-purple-600'}`}>Métodos de Pagamento</Link>
            {/* Assuming profile page is /cliente/dashboard for now, adjust if needed */}
            <Link href="/cliente/dashboard" className={`text-sm font-medium ${pathname === '/cliente/dashboard' ? 'text-purple-600' : 'hover:text-purple-600'}`}>Meu Perfil</Link> 
            <button onClick={handleSignOut} className="text-sm font-medium hover:text-purple-600">Sair</button>
          </nav>
        );
      } else {
        // Logged-in user, but type is unknown/missing (Generic logout)
         console.warn('User logged in but type (tipo) is missing:', session.user.id);
         return (
           <nav className="flex items-center space-x-4">
             <span className="text-sm font-medium text-gray-500">{session.user.email || 'Usuário'}</span>
             <button onClick={handleSignOut} className="text-sm font-medium hover:text-purple-600">Sair</button>
           </nav>
         );
      }
    // --- Logged OUT --- 
    } else {
      // Public Payment Page ([id] only) - No links on the right (IMG_0356)
      if (isPublicPaymentPage) {
        return null; // Render nothing on the right side
      }
      // Default for home and other public pages (e.g., login, signup)
      return (
        <nav className="flex items-center space-x-4">
          <Link href="/login" className="text-sm font-medium hover:text-purple-600">Entrar</Link>
          <Link href="/cadastro" className="text-sm font-medium hover:text-purple-600">Criar Conta</Link>
          <Link href="/motorista/login" className="text-sm font-medium hover:text-purple-600">Motoristas</Link>
        </nav>
      );
    }
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white shadow-md">
      <Link href={getLogoLink()} className="flex items-center space-x-2">
        {/* Simple P logo */}
        <div className="w-8 h-8 flex items-center justify-center rounded bg-purple-600">
            <span className="text-white font-bold text-lg">P</span>
        </div>
        <span className="font-bold text-2xl">Pixter</span>
      </Link>

      {renderLinks()}
    </header>
  );
}

