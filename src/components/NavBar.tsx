// src/components/NavBar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react"; // Added useState, useRef
import { signOut, useSession } from "next-auth/react";
import { Menu, X } from "lucide-react"; // Using lucide-react for icons

export default function NavBar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null); // Ref for the mobile menu

  const userType = session?.user?.tipo;
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
    // Bind the event listener
    if (isMobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobileMenuOpen]); // Only re-run if isMobileMenuOpen changes

  // --- Redirection Logic --- 
  useEffect(() => {
    if (isLoading) return; // Wait until session status is resolved

    const isPublicPaymentPage = /^\/pagamento\/\d{10,14}$/.test(pathname);
    const isClientAuthPage = ["/login", "/cadastro"].includes(pathname);
    const isDriverAuthPage = [
      "/motorista/login",
      "/motorista/cadastro",
    ].includes(pathname);

    // 1. Logged-in users trying to access auth pages
    if (isAuthenticated) {
      if (userType === "cliente" && isClientAuthPage) {
        router.replace("/cliente/dashboard");
        return;
      }
      if (userType === "motorista" && isDriverAuthPage) {
        router.replace("/motorista/dashboard/overview");
        return;
      }
      // Redirect logged-in users from homepage to their dashboard
      if (pathname === "/") {
        if (userType === "cliente") router.replace("/cliente/dashboard");
        if (userType === "motorista") router.replace("/motorista/dashboard/overview");
        return;
      }
    }

    // 2. Role Mismatch Access Control (Redirect if wrong role for area)
    if (isAuthenticated) {
        // Client trying to access driver area
        if (userType === "cliente" && pathname.startsWith("/motorista/")) {
            router.replace("/cliente/dashboard");
            return;
        }
        // Driver trying to access client area (excluding public payment page)
        if (userType === "motorista" && 
            (pathname.startsWith("/cliente/") || pathname.startsWith("/dashboard") || pathname.startsWith("/payment-methods")) && 
            !isPublicPaymentPage) {
            router.replace("/motorista/dashboard/overview");
            return;
        }
    }

    // 3. Guests trying to access protected areas
    if (!isAuthenticated) {
      const callbackUrlParam = `?callbackUrl=${encodeURIComponent(pathname + searchParams.toString())}`;
      // Guest in client area
      if (pathname.startsWith("/cliente/") || pathname.startsWith("/dashboard") || pathname.startsWith("/payment-methods")) {
        router.replace(`/login${callbackUrlParam}`);
        return;
      }
      // Guest in driver area (excluding auth pages)
      if (pathname.startsWith("/motorista/") && !isDriverAuthPage) {
        router.replace(`/motorista/login${callbackUrlParam}`);
        return;
      }
    }

  }, [status, userType, pathname, router, searchParams, isAuthenticated, isLoading]);

  // --- Sign-out Handler --- 
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    // Redirect to homepage after sign out
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
  const isPublicPaymentPage = /^\/pagamento\/\d{10,14}$/.test(pathname);
  const callbackUrlParam = `?callbackUrl=${encodeURIComponent(pathname + searchParams.toString())}`;

  if (isLoading) {
    // No links during loading
  } else if (isPublicPaymentPage) {
    // --- Public Payment Page --- 
    if (isAuthenticated && userType === "cliente") {
      // Logged-in Client on Public Page
      linksConfig = [
        { href: "/cliente/dashboard", text: "Dashboard" },
        { onClick: handleSignOut, text: "Sair" },
      ];
    } else {
      // Guest or Driver on Public Page
      linksConfig = [
        { href: `/login${callbackUrlParam}`, text: "Entrar (Cliente)" },
        { href: `/cadastro${callbackUrlParam}`, text: "Criar Conta" },
      ];
    }
  } else if (isAuthenticated) {
    // --- Authenticated User (Non-Public Page) --- 
    if (userType === "motorista") {
      // Logged-in Driver
      linksConfig = [
        { href: "/motorista/dashboard/overview", text: "Visão Geral" },
        { href: "/motorista/dashboard/pagamentos", text: "Pagamentos" },
        { href: "/motorista/dashboard/dados", text: "Meus Dados" },
        { href: "/motorista/dashboard/pagina-pagamento", text: "Minha Página" },
        { onClick: handleSignOut, text: "Sair" },
      ];
    } else if (userType === "cliente") {
      // Logged-in Client
      linksConfig = [
        { href: "/cliente/dashboard/historico", text: "Histórico" },
        { href: "/cliente/payment-methods", text: "Wallet" },
        { href: "/cliente/dashboard/dados", text: "Meus Dados" },
        { onClick: handleSignOut, text: "Sair" },
      ];
    }
  } else {
    // --- Guest (Non-Public Page) --- 
    linksConfig = [
      { href: "/login", text: "Entrar" },
      { href: "/cadastro", text: "Criar Conta" },
      { href: "/motorista/login", text: "Sou Motorista" },
    ];
  }

  // Helper to render link or button
  const renderLink = (link: { href?: string; text: string; onClick?: () => void }, isMobile: boolean) => {
    const className = isMobile
      ? "block px-4 py-2 text-base text-gray-700 hover:bg-gray-100"
      : "text-sm font-medium text-gray-600 hover:text-gray-900";
    
    if (link.href) {
      return (
        <Link key={link.text} href={link.href} className={className}>
          {link.text}
        </Link>
      );
    } else if (link.onClick) {
      return (
        <button key={link.text} onClick={link.onClick} className={`${className} w-full text-left`}>
          {link.text}
        </button>
      );
    }
    return null;
  };

  // --- Render NavBar --- 
  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */} 
          <div className="flex-shrink-0">
            <Link href={logoHref} className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="font-semibold text-xl text-gray-800">Pixter</span>
            </Link>
          </div>

          {/* Desktop Links */} 
          <div className="hidden md:flex md:items-center md:space-x-4">
            {isLoading ? (
              <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
            ) : (
              linksConfig.map(link => renderLink(link, false))
            )}
          </div>

          {/* Mobile Menu Button */} 
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
      </div>

      {/* Mobile Menu, show/hide based on menu state. */} 
      {isMobileMenuOpen && (
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

