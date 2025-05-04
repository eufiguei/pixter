// src/components/NavBar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { Menu, X } from "lucide-react";

// Define a type for the user object within the session for better type safety
interface UserSession {
  id?: string;
  tipo?: 'cliente' | 'motorista';
  cpf_cnpj?: string; // Added for driver's public page link
  // Add other user properties if available and needed
}

interface SessionData {
  user?: UserSession;
  expires?: string;
}

export default function NavBar() {
  // Use the specific type for the session data
  const { data: session, status } = useSession() as { data: SessionData | null; status: 'loading' | 'authenticated' | 'unauthenticated' };
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const userType = session?.user?.tipo;
  const userCpfCnpj = session?.user?.cpf_cnpj; // Get driver's identifier
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  // --- Close mobile menu on route change --- 
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // --- Close mobile menu when clicking outside --- 
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    }
    if (isMobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  // --- Redirection Logic (Keep as is, seems correct based on requirements) --- 
  useEffect(() => {
    if (isLoading) return;

    const isPublicPaymentPage = /^\/pagamento\/[^\/]+$/.test(pathname); // Match /pagamento/{any id}
    const isClientAuthPage = ["/login", "/cadastro"].includes(pathname);
    const isDriverAuthPage = [
      "/motorista/login",
      "/motorista/cadastro",
    ].includes(pathname);

    if (isAuthenticated) {
      if (userType === "cliente" && isClientAuthPage) {
        router.replace("/cliente/dashboard");
        return;
      }
      if (userType === "motorista" && isDriverAuthPage) {
        router.replace("/motorista/dashboard/overview");
        return;
      }
      if (pathname === "/") {
        if (userType === "cliente") router.replace("/cliente/dashboard");
        if (userType === "motorista") router.replace("/motorista/dashboard/overview");
        return;
      }
      if (userType === "cliente" && pathname.startsWith("/motorista/")) {
        router.replace("/cliente/dashboard");
        return;
      }
      if (userType === "motorista" && 
          (pathname.startsWith("/cliente/") || pathname.startsWith("/dashboard") || pathname.startsWith("/payment-methods")) && 
          !isPublicPaymentPage) {
        router.replace("/motorista/dashboard/overview");
        return;
      }
    }

    if (!isAuthenticated) {
      const callbackUrlParam = `?callbackUrl=${encodeURIComponent(pathname + searchParams.toString())}`;
      if (pathname.startsWith("/cliente/") || pathname.startsWith("/dashboard") || pathname.startsWith("/payment-methods")) {
        router.replace(`/login${callbackUrlParam}`);
        return;
      }
      if (pathname.startsWith("/motorista/") && !isDriverAuthPage) {
        router.replace(`/motorista/login${callbackUrlParam}`);
        return;
      }
    }

  }, [status, userType, pathname, router, searchParams, isAuthenticated, isLoading]);

  // --- Sign-out Handler --- 
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
  };

  // --- Determine Logo Link --- 
  let logoHref = "/";
  if (isAuthenticated) {
    if (userType === "motorista") logoHref = "/motorista/dashboard/overview";
    else if (userType === "cliente") logoHref = "/cliente/dashboard";
  }

  // --- Render Links based on context --- 
  let linksConfig: { href?: string; text: string; onClick?: () => void }[] = [];
  const isPublicPaymentPage = /^\/pagamento\/[^\/]+$/.test(pathname); // Match /pagamento/{any id}
  const callbackUrlParam = `?callbackUrl=${encodeURIComponent(pathname + searchParams.toString())}`;

  // Determine if the simplified public view should be shown
  const showSimplifiedPublicView = isPublicPaymentPage && !isAuthenticated;

  if (isLoading) {
    // No links during loading
  } else if (isPublicPaymentPage) {
    // --- Public Payment Page --- 
    if (isAuthenticated && userType === "cliente") {
      // Logged-in Client on Public Page (Matches Situation 3)
      linksConfig = [
        { href: "/cliente/dashboard/historico", text: "Histórico Pagamentos" }, // Updated text
        { href: "/cliente/payment-methods", text: "Wallet" },
        { href: "/cliente/dashboard/dados", text: "Meus Dados" },
        { onClick: handleSignOut, text: "Sair" },
      ];
    } else {
      // Guest or Driver on Public Page (Matches Situation 1 & 5)
      linksConfig = [
        { href: `/login${callbackUrlParam}`, text: "Entrar" }, // Simplified text
        { href: `/cadastro${callbackUrlParam}`, text: "Criar Conta" },
      ];
    }
  } else if (isAuthenticated) {
    // --- Authenticated User (Non-Public Page) --- 
    if (userType === "motorista") {
      // Logged-in Driver (Matches Situation 2)
      const driverPublicPageLink = userCpfCnpj ? `/pagamento/${userCpfCnpj}` : '#'; // Fallback if no cpf_cnpj
      linksConfig = [
        { href: "/motorista/dashboard/overview", text: "Visão Geral" },
        { href: "/motorista/dashboard/pagamentos", text: "Pagamentos" },
        { href: "/motorista/dashboard/dados", text: "Meus Dados" },
        { href: driverPublicPageLink, text: "Minha Página Pública" }, // Updated link and text
        { onClick: handleSignOut, text: "Sair" },
      ];
    } else if (userType === "cliente") {
      // Logged-in Client (Matches Situation 3 dashboard view)
      linksConfig = [
        { href: "/cliente/dashboard/historico", text: "Histórico" },
        { href: "/cliente/payment-methods", text: "Wallet" },
        { href: "/cliente/dashboard/dados", text: "Meus Dados" },
        { onClick: handleSignOut, text: "Sair" },
      ];
    }
  } else {
    // --- Guest (Non-Public Page, e.g., Homepage) (Matches Situation 1) --- 
    linksConfig = [
      { href: "/login", text: "Entrar" },
      { href: "/cadastro", text: "Criar Conta" },
      { href: "/motorista/login", text: "Sou Motorista" }, // Changed text slightly as per user request 1
    ];
  }

  // Helper to render link or button
  const renderLink = (link: { href?: string; text: string; onClick?: () => void }, isMobile: boolean) => {
    const baseStyle = isMobile
      ? "block px-4 py-2 text-base text-gray-700 hover:bg-gray-100"
      : "text-sm font-medium text-gray-600 hover:text-gray-900";
    const buttonStyle = isMobile ? "w-full text-left" : "";
    
    if (link.href) {
      // Special case for disabled driver public page link
      if (link.text === "Minha Página Pública" && link.href === '#') {
        return (
          <span key={link.text} className={`${baseStyle} opacity-50 cursor-not-allowed`}>
            {link.text} (Indisponível)
          </span>
        );
      }
      return (
        <Link key={link.text} href={link.href} className={baseStyle}>
          {link.text}
        </Link>
      );
    } else if (link.onClick) {
      return (
        <button key={link.text} onClick={link.onClick} className={`${baseStyle} ${buttonStyle}`}>
          {link.text}
        </button>
      );
    }
    return null;
  };

  // --- Render NavBar --- 
  return (
    <header className={`sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200 ${showSimplifiedPublicView ? 'border-none shadow-none' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Simplified view for Guests/Drivers on Public Page */} 
        {showSimplifiedPublicView ? (
          <div className="flex items-center justify-center h-16 space-x-6"> {/* Centered links */} 
            {isLoading ? (
              <div className="h-6 w-40 bg-gray-200 animate-pulse rounded"></div>
            ) : (
              linksConfig.map(link => renderLink(link, false))
            )}
          </div>
        ) : (
          /* Standard view for all other cases */ 
          <div className="flex items-center justify-between h-16">
            {/* Logo - Hidden in simplified view */} 
            <div className="flex-shrink-0">
              <Link href={logoHref} className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-lg">P</span>
                </div>
                <span className="font-semibold text-xl text-gray-800">Pixter</span>
              </Link>
            </div>

            {/* Desktop Links - Hidden in simplified view */} 
            <div className="hidden md:flex md:items-center md:space-x-6"> {/* Increased spacing */} 
              {isLoading ? (
                <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
              ) : (
                linksConfig.map(link => renderLink(link, false))
              )}
            </div>

            {/* Mobile Menu Button - Hidden in simplified view */} 
            <div className="-mr-2 flex items-center md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                aria-controls="mobile-menu"
                aria-expanded={isMobileMenuOpen}
              >
                <span className="sr-only">Open main menu</span>
                {isMobileMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Menu, show/hide based on menu state. Only shown in standard view */} 
      {!showSimplifiedPublicView && isMobileMenuOpen && (
        <div ref={menuRef} className="md:hidden absolute top-16 inset-x-0 z-40 bg-white shadow-lg border-t border-gray-200" id="mobile-menu">
          <div className="pt-2 pb-3 space-y-1">
            {isLoading ? (
              <div className="px-4 py-2">
                <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
              </div>
            ) : (
              linksConfig.map(link => renderLink(link, true))
            )}
          </div>
        </div>
      )}
    </header>
  );
}
