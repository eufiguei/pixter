// src/app/motorista/dashboard/overview/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import QRCode from "qrcode";

type BalanceEntry = {
  amount: string;     // e.g. "R$ 500,00"
  currency: string;   // "brl"
};

type Profile = {
  id: string;
  nome?: string;
  email?: string;
  celular?: string;   // phone number (e.g. "+5511999999999")
  tipo?: string;
  stripe_account_id?: string | null;
  stripe_account_status?: "pending" | "verified" | "restricted" | null;
};

export default function DriverDashboardPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [balance, setBalance] = useState<{ available: BalanceEntry[]; pending: BalanceEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentPageLink, setPaymentPageLink] = useState("");
  const qrCodeRef = useRef<HTMLCanvasElement>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{ status: string | null; accountLink: string | null; }>({ status: null, accountLink: null });

  // Simplified fetch function focused only on what we need
  const fetchAll = async () => {
    if (sessionStatus !== "authenticated") {
      if (sessionStatus === "unauthenticated") {
        router.push("/motorista/login");
      }
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      // 1) Load driver profile
      const pr = await fetch("/api/motorista/profile", { credentials: "include" });
      if (!pr.ok) {
        const err = await pr.json();
        throw new Error(err.error || `Erro ao carregar perfil (${pr.status})`);
      }
      const profileData: Profile = await pr.json();
      if (profileData.tipo !== "motorista") {
        throw new Error("Acesso negado: não é motorista");
      }
      setProfile(profileData);

      // 2) Build public payment link from phone number
      const rawPhone = profileData.celular?.replace(/\D/g, "") || "";
      const link = `${window.location.origin}/${rawPhone}`;
      setPaymentPageLink(link);

      // Generate QR code once
      QRCode.toDataURL(link, { errorCorrectionLevel: "H", margin: 2, scale: 6 }, (_, url) => {
        if (url) setQrCodeUrl(url);
      });
      QRCode.toCanvas(qrCodeRef.current!, link, { errorCorrectionLevel: "H", margin: 2, width: 200 }, () => {});

      // 3) Fetch balance data
      try {
        const resp = await fetch(`/api/motorista/payments`, { credentials: "include" });
          const data = await resp.json();
          
          // Check if the response has an error message (could be 200 OK with error details)
          if (data.error) {
            console.error("Payment API error:", data.error, data.code);
            // Don't throw, just set an error message and continue with default values
            setError(`Erro de pagamentos: ${data.error}`);
            setBalance({
              available: [{ amount: "R$ 0,00", currency: "brl" }],
              pending: [{ amount: "R$ 0,00", currency: "brl" }]
            });
          }
          // Handle response when Stripe account is not connected
          else if (data.needsConnection) {
            console.log("Stripe connection needed:", data.message);
            // Set default empty values but continue rendering the page
            setBalance({
              available: [{ amount: "R$ 0,00", currency: "brl" }],
              pending: [{ amount: "R$ 0,00", currency: "brl" }]
            });
            
            // Set stripe status explicitly based on needsConnection flag
            setStripeStatus(prevStatus => ({
              ...prevStatus,
              status: "needs_connection",
            }));
          } else {
            // Normal case: Stripe is connected
        }

        // Set balance data
        if (data.balance) setBalance(data.balance);
      } catch (paymentErr: any) {
        console.error("Failed to load payments:", paymentErr);
        // Don't throw - let's still show profile info even if payments fail
        setError(paymentErr.message);
      }

      // 4) Fetch Stripe status
      const stripeResp = await fetch("/api/motorista/stripe", { credentials: "include" });
      if (stripeResp.ok) {
        const stripeData = await stripeResp.json();
        setStripeStatus({
          status: stripeData.status,
          accountLink: stripeData.accountLink || stripeData.loginLink
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  if (loading) {
    return <div className="p-6 text-center">Carregando dashboard...</div>;
  }
  if (error || !profile || !balance) {
    return (
      <div className="p-6 text-red-500">
        <p className="font-semibold">Erro ao carregar dashboard:</p>
        <p>{error || "Dados incompletos"}</p>
      </div>
    );
  }

  // Show only the first available bucket (usually there's just one)
  const formattedAvailable = balance.available[0]?.amount || "R$ 0,00";
  const formattedPending   = balance.pending[0]?.amount;

  // Calculate status display
  let statusDisplay = { text: "Não conectado", color: "text-red-600" };
  if (profile.stripe_account_id) {
    switch (stripeStatus.status) {
      case "verified":
        statusDisplay = { text: "Conta verificada", color: "text-green-600" };
        break;
      case "pending":
        statusDisplay = { text: "Pendente de verificação", color: "text-yellow-600" };
        break;
      case "restricted":
        statusDisplay = { text: "Conta restrita", color: "text-red-600" };
        break;
      default:
        statusDisplay = { text: "Status desconhecido", color: "text-gray-600" };
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">
        Olá, {profile.nome || "Motorista"}!
      </h1>

      {/* Saldo Disponível */}
      <section className="bg-white p-6 rounded-lg shadow-md">
        <div>
          <h2 className="text-xl font-semibold mb-2">Saldo Disponível</h2>
          <p className="text-4xl font-bold text-gray-900">{formattedAvailable}</p>
          {formattedPending && (
            <p className="mt-1 text-sm text-gray-500">
              (Pendente: {formattedPending})
            </p>
          )}
          <div className="mt-4 text-right">
            <Link href="/motorista/dashboard/pagamentos" className="text-purple-600 hover:underline">
              Ver histórico de pagamentos →
            </Link>
          </div>
        </div>
      </section>

      {/* Meus Dados */}
      <section className="bg-white p-4 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Meus Dados</h2>
        <p><strong>Nome:</strong> {profile.nome}</p>
        <p><strong>Email:</strong> {profile.email}</p>
        <p><strong>Celular:</strong> {profile.celular}</p>
        <Link href="/motorista/dashboard/dados">
          <button className="mt-4 w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
            Atualizar informações
          </button>
        </Link>
      </section>

      {/* Minha Página de Pagamento */}
      <section className="bg-white p-4 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">
          Minha Página de Pagamento
        </h2>
        
        {stripeStatus.status === "verified" ? (
          <div>
            <div className="flex items-center text-green-600 mb-3">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Sua página de pagamento está ativa!</span>
            </div>
            
            <div className="mb-4">
              <input
                readOnly
                value={paymentPageLink}
                className="w-full mb-2 px-3 py-2 border rounded text-center bg-gray-50"
              />
              <div className="flex justify-between gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(paymentPageLink)}
                  className="flex-1 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Copiar link
                </button>
              </div>
            </div>
            
            {qrCodeUrl && (
              <div className="mt-4 flex flex-col items-center">
                <p className="text-sm text-gray-600 mb-2">Compartilhe usando QR Code:</p>
                <img src={qrCodeUrl} alt="QR Code" width={150} height={150} className="mb-2" />
                <canvas ref={qrCodeRef} style={{ display: "none" }} />
                <button
                  onClick={() => {
                    const a = document.createElement("a");
                    a.download = `qr_${profile.id}.png`;
                    a.href = qrCodeRef.current!.toDataURL();
                    a.click();
                  }}
                  className="mt-2 px-4 py-1 text-sm border border-purple-600 text-purple-600 rounded hover:bg-purple-50"
                >
                  Baixar QR Code
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-center text-yellow-700 mb-2">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>Sua página está quase pronta!</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">Complete a verificação da sua conta Stripe para começar a receber pagamentos.</p>
            {stripeStatus.accountLink && (
              <a
                href={stripeStatus.accountLink}
                className="inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                target="_blank"
                rel="noopener noreferrer"
              >
                Completar verificação
              </a>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
