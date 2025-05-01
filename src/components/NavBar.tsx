// src/components/NavBar.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
// import { useSession, signOut } from 'next-auth/react'; // Import session later

// Placeholder for session status - replace with actual useSession hook later
const mockSession = null; // null for logged out, { user: { role: 'driver'/'client' } } for logged in
const mockSignOut = () => console.log('Signing out...');

export default function NavBar() {
  const pathname = usePathname();
  // const { data: session } = useSession(); // Use actual session later
  const session = mockSession;

  const isPublicPaymentPage = pathname?.includes('/pagamento/') && !pathname?.includes('/pagamento/sucesso') && !pathname?.includes('/pagamento/cancelado');
  const isHomePage = pathname === '/';
  const isDriverDashboard = pathname?.startsWith('/motorista/dashboard');
  const isClientDashboard = pathname?.startsWith('/cliente/dashboard'); // Assuming client dashboard path

  const renderLinks = () => {
    if (session) {
      // Logged-in user
      if (session.user.role === 'driver') {
        // Logged-in Driver
        return (
          <nav className="flex items-center space-x-4">
            <Link href="/motorista/dashboard" className={`text-sm font-medium ${pathname === '/motorista/dashboard' ? 'text-purple-600' : 'hover:text-purple-600'}`}>Visão Geral</Link>
            <Link href="/motorista/dashboard/dados" className={`text-sm font-medium ${pathname === '/motorista/dashboard/dados' ? 'text-purple-600' : 'hover:text-purple-600'}`}>Meus Dados</Link> {/* Assuming route */} 
            <Link href="/motorista/dashboard/pagina-pagamento" className={`text-sm font-medium ${pathname === '/motorista/dashboard/pagina-pagamento' ? 'text-purple-600' : 'hover:text-purple-600'}`}>Minha Página Pagamento</Link> {/* Assuming route */} 
            <button onClick={() => mockSignOut()} className="text-sm font-medium hover:text-purple-600">Sair</button>
          </nav>
        );
      } else {
        // Logged-in Client
        return (
          <nav className="flex items-center space-x-4">
             {/* Add client dashboard links here if needed */}
            <Link href="/cliente/dashboard" className={`text-sm font-medium ${pathname === '/cliente/dashboard' ? 'text-purple-600' : 'hover:text-purple-600'}`}>Dashboard</Link> {/* Example */} 
            <button onClick={() => mockSignOut()} className="text-sm font-medium hover:text-purple-600">Sair</button>
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
      } else if (isHomePage) {
        return (
          <nav className="flex items-center space-x-4">
            <Link href="/login" className="text-sm font-medium hover:text-purple-600">Entrar</Link>
            <Link href="/cadastro" className="text-sm font-medium hover:text-purple-600">Criar Conta</Link>
            <Link href="/motorista/login" className="text-sm font-medium hover:text-purple-600">Motoristas</Link> {/* Link to driver login/info */}
          </nav>
        );
      } else {
         // Default for other public pages (e.g., login, signup)
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
    // Added sticky, top-0, z-50 and increased padding
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white shadow-md">
      <Link href="/" className="flex items-center space-x-2">
        {/* Consistent Logo */}
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#7c3aed"> {/* Increased size slightly */}
          <rect width="24" height="24" rx="4" />
          <text x="12" y="17" fontSize="13" textAnchor="middle" fill="white" fontWeight="bold">P</text> {/* Added bold */}
        </svg>
        <span className="font-bold text-2xl">Pixter</span> {/* Increased size slightly */}
      </Link>

      {renderLinks()} 
    </header>
  );
}

