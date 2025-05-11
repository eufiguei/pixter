// src/components/NavBar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  Menu,
  X,
  ChevronDown,
  User,
  LogOut,
  CreditCard,
  History,
  Settings,
  ExternalLink,
} from "lucide-react";

// Define a type for the user object within the session for better type safety
interface UserSession {
  id?: string;
  tipo?: "cliente" | "vendedor";
  celular?: string; // Use celular for public page link
  email?: string; // For displaying in profile dropdown
  name?: string; // For displaying in profile dropdown
  image?: string; // For avatar in profile dropdown
  // Add other user properties if available and needed
}

interface SessionData {
  user?: UserSession;
  expires?: string;
}

export default function NavBar() {
  // Use the specific type for the session data
  const { data: session, status } = useSession() as {
    data: SessionData | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const userType = session?.user?.tipo;
  const user = session?.user || null; // Get user object from session
  // console.log("Session info in NavBar:", session, status, user);

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  // --- Close mobile menu on route change ---
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileDropdownOpen(false);
  }, [pathname]);

  // --- Close menus when clicking outside ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setIsProfileDropdownOpen(false);
      }
    }

    if (isMobileMenuOpen || isProfileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobileMenuOpen, isProfileDropdownOpen]);

  // --- Redirection Logic ---
  useEffect(() => {
    if (isLoading) return;

    const isPublicPaymentPage = /^\/\+?[0-9]{10,}$/.test(pathname);
    const isClientAuthPage = ["/login", "/cadastro"].includes(pathname);
    const isDriverAuthPage = [
      "/vendedor/login",
      "/vendedor/cadastro",
    ].includes(pathname);

    if (isAuthenticated) {
      if (userType === "cliente" && isClientAuthPage) {
        router.replace("/cliente/dashboard");
        return;
      }
      if (userType === "vendedor" && isDriverAuthPage) {
        router.replace("/vendedor/dashboard/overview");
        return;
      }
      if (pathname === "/") {
        if (userType === "cliente") router.replace("/cliente/dashboard");
        if (userType === "vendedor")
          router.replace("/vendedor/dashboard/overview");
        return;
      }
      if (userType === "cliente" && pathname.startsWith("/vendedor/")) {
        router.replace("/cliente/dashboard");
        return;
      }
      const driverPublicPagePath = session?.user?.celular
        ? `/${session.user.celular.replace(/\D/g, "")}`
        : null;
      if (
        userType === "vendedor" &&
        (pathname.startsWith("/cliente/") ||
          pathname.startsWith("/dashboard") ||
          pathname.startsWith("/payment-methods")) &&
        pathname !== driverPublicPagePath
      ) {
        router.replace("/vendedor/dashboard/overview");
        return;
      }
    }

    if (status === "unauthenticated") {
      const callbackUrlParam = `?callbackUrl=${encodeURIComponent(
        pathname + searchParams.toString()
      )}`;
      if (
        pathname.startsWith("/cliente/") ||
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/payment-methods")
      ) {
        router.replace(`/login${callbackUrlParam}`);
        return;
      }
      if (pathname.startsWith("/vendedor/") && !isDriverAuthPage) {
        router.replace(`/vendedor/login${callbackUrlParam}`);
        return;
      }
    }
  }, [
    status,
    userType,
    pathname,
    router,
    searchParams,
    isAuthenticated,
    isLoading,
    session?.user?.celular,
  ]);

  // --- Sign-out Handler ---
  const handleSignOut = async () => {
    setIsProfileDropdownOpen(false);
    await signOut({ redirect: false });
    router.push("/");
  };

  // --- Determine Logo Link ---
  let logoHref = "/";
  if (isAuthenticated) {
    if (userType === "vendedor") logoHref = "/vendedor/dashboard/overview";
    else if (userType === "cliente") logoHref = "/cliente/dashboard";
  }

  // --- Profile Menu Items ---
  const getProfileMenuItems = () => {
    if (userType === "cliente") {
      return [
        {
          href: "/cliente/dashboard/dados",
          text: "Meu Perfil",
          icon: <User className="w-4 h-4 mr-2" />,
        },
        {
          href: "/cliente/dashboard/historico",
          text: "Histórico de Pagamentos",
          icon: <History className="w-4 h-4 mr-2" />,
        },
        {
          href: "/cliente/payment-methods",
          text: "Minha Carteira",
          icon: <CreditCard className="w-4 h-4 mr-2" />,
        },
        {
          onClick: handleSignOut,
          text: "Sair",
          icon: <LogOut className="w-4 h-4 mr-2" />,
        },
      ];
    } else if (userType === "vendedor") {
      const driverPublicPageLink = session?.user?.celular
        ? `/${session.user.celular.replace(/\D/g, "")}`
        : "#";
      return [
        {
          href: "/vendedor/dashboard/dados",
          text: "Meu Perfil",
          icon: <User className="w-4 h-4 mr-2" />,
        },
        {
          href: "/vendedor/dashboard/overview",
          text: "Painel",
          icon: <Settings className="w-4 h-4 mr-2" />,
        },
        {
          href: "/vendedor/dashboard/pagamentos",
          text: "Pagamentos",
          icon: <CreditCard className="w-4 h-4 mr-2" />,
        },
        {
          href: driverPublicPageLink,
          text: "Minha Página Pública",
          icon: <ExternalLink className="w-4 h-4 mr-2" />,
          disabled: driverPublicPageLink === "#", // Task 11: Link should be unavailable if no stripe connection
        },
        {
          onClick: handleSignOut,
          text: "Sair",
          icon: <LogOut className="w-4 h-4 mr-2" />,
        },
      ];
    }
    return [];
  };

  // --- Navigation Links ---
  const getNavigationLinks = () => {
    const isPublicPaymentPage = /^\/\+?[0-9]{10,}$/.test(pathname);
    const callbackUrlParam = `?callbackUrl=${encodeURIComponent(
      pathname + searchParams.toString()
    )}`;

    if (isPublicPaymentPage) {
      if (!isAuthenticated || userType === "vendedor") {
        return [
          { href: `/login${callbackUrlParam}`, text: "Entrar" },
          { href: `/cadastro${callbackUrlParam}`, text: "Criar Conta" },
        ];
      }
      return [];
    } else if (!isAuthenticated) {
      return [
        { href: "/login", text: "Entrar" },
        { href: "/cadastro", text: "Criar Conta" },
        { href: "/vendedor/login", text: "Sou Vendedor" }, // Changed from "I'm a Driver"
      ];
    }
    return [];
  };

  // Helper to render link or button
  const renderLink = (
    link: {
      href?: string;
      text: string;
      onClick?: () => void;
      icon?: React.ReactNode;
      disabled?: boolean;
    },
    isMobile: boolean
  ) => {
    const baseStyle = isMobile
      ? "block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 w-full text-left"
      : "text-sm font-medium text-gray-600 hover:text-gray-900";

    if (link.href && !link.disabled) {
      return (
        <Link
          key={link.text}
          href={link.href}
          className={`${baseStyle} flex items-center`}
        >
          {link.icon && link.icon}
          {link.text}
        </Link>
      );
    } else if (link.href && link.disabled) {
      return (
        <span
          key={link.text}
          className={`${baseStyle} opacity-50 cursor-not-allowed flex items-center`}
        >
          {link.icon && link.icon}
          {link.text} (Indisponível)
        </span>
      );
    } else if (link.onClick) {
      return (
        <button
          key={link.text}
          onClick={link.onClick}
          className={`${baseStyle} flex items-center`}
        >
          {link.icon && link.icon}
          {link.text}
        </button>
      );
    }
    return null;
  };

  const isPublicPaymentPage = /^\/\+?[0-9]{10,}$/.test(pathname);
  const showSimplifiedPublicView =
    isPublicPaymentPage && (!isAuthenticated || userType === "vendedor");

  return (
    <header
      className={`sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200 ${
        showSimplifiedPublicView ? "border-none shadow-none" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {showSimplifiedPublicView ? (
          <div className="flex items-center justify-center h-16 space-x-6">
            {isLoading ? (
              <div className="h-6 w-40 bg-gray-200 animate-pulse rounded"></div>
            ) : (
              getNavigationLinks().map((link) => renderLink(link, false))
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between h-16">
            <div className="flex-shrink-0">
              <Link href={logoHref} className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-lg">P</span>
                </div>
                <span className="font-semibold text-xl text-gray-800">
                  Pixter
                </span>
              </Link>
            </div>

            <div className="hidden md:flex md:items-center md:space-x-6">
              {isLoading ? (
                <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
              ) : isAuthenticated ? (
                <>
                  <div className="relative" ref={profileDropdownRef}>
                    <button
                      onClick={() =>
                        setIsProfileDropdownOpen(!isProfileDropdownOpen)
                      }
                      className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        {session?.user?.image ? (
                          <img
                            src={session.user.image}
                            alt="Perfil"
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <User className="w-4 h-4 text-purple-600" />
                        )}
                      </div>
                      <span>
                        {session?.user?.name || session?.user?.email || "Usuário"}
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {isProfileDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
                        {getProfileMenuItems().map((item) =>
                          renderLink(item, false)
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                getNavigationLinks().map((link) => renderLink(link, false))
              )}
            </div>

            <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-500"
                aria-controls="mobile-menu"
                aria-expanded={isMobileMenuOpen}
              >
                <span className="sr-only">Abrir menu principal</span>
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

      {!showSimplifiedPublicView && isMobileMenuOpen && (
        <div
          ref={menuRef}
          className="md:hidden absolute top-16 inset-x-0 z-40 bg-white shadow-lg border-t border-gray-200"
          id="mobile-menu"
        >
          <div className="pt-2 pb-3 space-y-1">
            {isLoading ? (
              <div className="px-4 py-2">
                <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
              </div>
            ) : isAuthenticated ? (
              <div className="px-4 py-2 border-b border-gray-200 mb-2">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    {session?.user?.image ? (
                      <img
                        src={session.user.image}
                        alt="Perfil"
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <User className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">
                      {session?.user?.name || "Usuário"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {session?.user?.email || ""}
                    </div>
                  </div>
                </div>
                {getProfileMenuItems().map((item) => renderLink(item, true))}
              </div>
            ) : (
              getNavigationLinks().map((link) => renderLink(link, true))
            )}
          </div>
        </div>
      )}
    </header>
  );
}

