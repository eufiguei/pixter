// src/components/NavBar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react"; // Use actual session
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client"; // Import Supabase client if needed for profile

export default function NavBar() {
  const pathname = usePathname();
  const { data: session, status } = useSession(); // Use actual session
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch user role from profile if session exists but doesn't contain role
  // Adjust this based on how role is stored (session or profile table)
  useEffect(() => {
    async function fetchRole() {
      if (session?.user?.id && !session.user.tipo) { // Check if tipo is missing
        const { data, error } = await supabase
          .from("profiles")
          .select("tipo")
          .eq("id", session.user.id)
          .single();
        if (data) {
          setUserRole(data.tipo);
        }
      }
    }
    if (status === "authenticated") {
        // Prioritize role from session if available
        if (session.user.tipo) {
            setUserRole(session.user.tipo);
        } else {
            fetchRole();
        }
    } else {
        setUserRole(null); // Clear role if not authenticated
    }
  }, [session, status]);

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";
  const role = session?.user?.tipo || userRole;

  const isPublicPaymentPage =
    pathname?.includes("/pagamento/") &&
    !pathname?.includes("/pagamento/sucesso") &&
    !pathname?.includes("/pagamento/cancelado");
  const isHomePage = pathname === "/";
  const isDriverDashboard = pathname?.startsWith("/motorista/dashboard");
  const isClientDashboard = pathname?.startsWith("/cliente/dashboard");

  const getLogoLink = () => {
    if (isAuthenticated) {
      if (role === "driver") return "/motorista/dashboard";
      if (role === "client") return "/cliente/dashboard";
    }
    return "/"; // Default to homepage if not logged in or role unknown
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" }); // Redirect to homepage after sign out
  };

  const renderLinks = () => {
    if (isLoading) {
      return <div className="h-6 w-20 animate-pulse bg-gray-200 rounded"></div>; // Loading placeholder
    }

    let links: { href: string; label: string; onClick?: () => void }[] = [];

    if (isAuthenticated) {
      // --- Logged-in user ---
      if (role === "driver") {
        links = [
          { href: "/motorista/dashboard", label: "Visão Geral" },
          { href: "/motorista/dashboard/pagamentos", label: "Meus Pagamentos" },
          { href: "/motorista/dashboard/dados", label: "Meus Dados" },
          {
            href: "/motorista/dashboard/pagina-pagamento",
            label: "Minha Página Pagamento",
          },
          { href: "#", label: "Sair", onClick: handleSignOut },
        ];
      } else if (role === "client") {
        links = [
          { href: "/cliente/dashboard/historico", label: "Histórico" }, // New Client Routes
          {
            href: "/cliente/dashboard/metodos-pagamento",
            label: "Métodos Pagamento",
          },
          { href: "/cliente/dashboard/perfil", label: "Meu Perfil" },
          { href: "#", label: "Sair", onClick: handleSignOut },
        ];
      } else {
        // Role unknown or other type - default to basic logged-in state
        links = [{ href: "#", label: "Sair", onClick: handleSignOut }];
      }
    } else {
      // --- Logged-out user ---
      if (isPublicPaymentPage) {
        links = [
          { href: "/login", label: "Entrar" },
          { href: "/cadastro", label: "Criar Conta" },
        ];
      } else {
        // Homepage, login, signup, success pages etc.
        links = [
          { href: "/login", label: "Entrar" },
          { href: "/cadastro", label: "Criar Conta" },
          { href: "/motorista/login", label: "Motoristas" },
        ];
      }
    }

    return (
      <>
        {/* Desktop Menu */}
        <nav className="hidden md:flex items-center space-x-4">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={link.onClick}
              className={`text-sm font-medium transition-colors duration-150 ${pathname === link.href
                  ? "text-purple-600"
                  : "text-gray-700 hover:text-purple-600"
                }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-700 hover:text-purple-600 focus:outline-none"
            aria-label="Toggle menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isMobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" /> // Close icon
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" /> // Hamburger icon
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white shadow-lg md:hidden z-40">
            <nav className="flex flex-col px-4 py-2 space-y-1">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => {
                    if (link.onClick) link.onClick();
                    setIsMobileMenuOpen(false); // Close menu on click
                  }}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-150 ${pathname === link.href
                      ? "text-purple-600 bg-purple-50"
                      : "text-gray-700 hover:text-purple-600 hover:bg-gray-50"
                    }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </>
    );
  };

  return (
    // Added sticky, top-0, z-50 and adjusted padding
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 bg-white shadow-md">
      <Link href={getLogoLink()} className="flex items-center space-x-2">
        {/* Consistent Logo */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="#7c3aed"
          className="flex-shrink-0"
        >
          <rect width="24" height="24" rx="4" />
          <text
            x="12"
            y="17"
            fontSize="13"
            textAnchor="middle"
            fill="white"
            fontWeight="bold"
          >
            P
          </text>
        </svg>
        <span className="font-bold text-xl sm:text-2xl hidden sm:inline">
          Pixter
        </span>
      </Link>

      {renderLinks()}
    </header>
  );
}

