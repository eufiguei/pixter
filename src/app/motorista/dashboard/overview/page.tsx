// src/app/motorista/dashboard/overview/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import QRCode from "qrcode";

// Define Payment type (matches your API)
type Payment = {
  id: string;
  data: string;
  valor: string;
  valor_original?: string;
  metodo: string;
  recibo_id: string;
  status: string;
  cliente?: string;
};

// Define Profile type
type Profile = {
  id: string;
  nome?: string;
  email?: string;
  celular?: string;
  stripe_account_id?: string;
  tipo?: string;
};

export default function DriverDashboardPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [available, setAvailable] = useState("—");
  const [pending, setPending] = useState("—");
  const [paymentPageLink, setPaymentPageLink] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const qrCodeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      const fetchData = async () => {
        setLoadingData(true);
        setError("");

        try {
          // 1) PROFILE
          const profileRes = await fetch("/api/motorista/profile", {
            credentials: "include",
          });
          if (!profileRes.ok) {
            const err = await profileRes.json();
            throw new Error(err.error || `Erro ao carregar perfil (${profileRes.status})`);
          }
          const { profile: profileData } = await profileRes.json();
          if (profileData.tipo !== "motorista") {
            throw new Error(`Acesso negado: tipo inválido (${profileData.tipo}).`);
          }
          setProfile(profileData);

          // 2) BALANCE
          const balRes = await fetch("/api/motorista/balance", {
            credentials: "include",
          });
          if (balRes.ok) {
            const { available: av, pending: pd, currency } = await balRes.json();
            setAvailable(
              new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency,
              }).format(av / 100)
            );
            setPending(
              new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency,
              }).format(pd / 100)
            );
          } else {
            console.warn("Falha ao carregar saldo:", await balRes.text());
          }

          // 3) PAYMENTS
          // build your payment page link & QR
          const link = `${window.location.origin}/pagamento/${profileData.id}`;
          setPaymentPageLink(link);
          QRCode.toDataURL(link, { errorCorrectionLevel: "H", margin: 2, scale: 6 }, (err, url) => {
            if (!err && url) setQrCodeUrl(url);
          });
          QRCode.toCanvas(qrCodeRef.current, link, { errorCorrectionLevel: "H", margin: 2, width: 200 }, () => {});

          const paymentsRes = await fetch("/api/motorista/payments", {
            credentials: "include",
          });
          if (!paymentsRes.ok) {
            const err = await paymentsRes.json();
            throw new Error(err.error || `Erro ao carregar pagamentos (${paymentsRes.status})`);
          }
          const { payments: paymentsData } = await paymentsRes.json();
          setPayments(paymentsData || []);
        } catch (err: any) {
          console.error("[Dashboard] fetchData error:", err);
          setError(err.message || "Erro ao carregar dados do dashboard.");
        } finally {
          setLoadingData(false);
        }
      };

      fetchData();
    } else if (sessionStatus === "unauthenticated") {
      router.push("/motorista/login");
    }
    // if loading, do nothing
  }, [sessionStatus, session, router]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentPageLink);
    alert("Link copiado!");
  };

  const handleDownloadQR = () => {
    if (qrCodeRef.current) {
      const a = document.createElement("a");
      a.download = `pixter_qr_${profile?.id || "code"}.png`;
      a.href = qrCodeRef.current.toDataURL("image/png");
      a.click();
    }
  };

  // --- RENDER STATES ---
  if (sessionStatus === "loading" || (sessionStatus === "authenticated" && loadingData)) {
    return <div className="p-6 text-center">Carregando dashboard...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-500">
        <p className="font-semibold">Erro ao carregar dashboard:</p>
        <p>{error}</p>
        <p className="mt-2 text-sm text-gray-600">Verifique os dados ou contate o suporte.</p>
      </div>
    );
  }

  if (sessionStatus === "authenticated" && profile) {
    return (
      <div className="p-4 md:p-8 space-y-8">
        {/* Greeting */}
        <h1 className="text-3xl font-bold text-gray-800">Olá, {profile.nome || "Motorista"}!</h1>

        {/* BALANCE */}
        <section className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="font-semibold text-lg text-gray-700">Saldo disponível</h2>
          <p className="text-2xl">{available}</p>
          <p className="text-sm text-gray-500">Pendente: {pending}</p>
        </section>

        {/* Pagamentos Recebidos */}
        <section className="bg-white p-4 md:p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Pagamentos Recebidos</h2>
          {payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Comprovante</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">{new Date(p.data).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.valor}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{p.cliente || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{p.metodo}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        <Link
                          href={`/api/receipts/${p.recibo_id}?type=driver`}
                          target="_blank"
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Baixar Comprovante
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">Nenhum pagamento recebido encontrado.</p>
          )}
        </section>

        {/* Meus Dados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="bg-white p-4 md:p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Meus Dados</h2>
            <div className="space-y-2 text-gray-700 mb-4">
              <p><strong>Nome:</strong> {profile.nome || "-"}</p>
              <p><strong>Email:</strong> {profile.email || "-"}</p>
              <p><strong>Celular:</strong> {profile.celular || "-"}</p>
            </div>
            <Link href="/motorista/dashboard/dados">
              <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                Atualizar informações
              </button>
            </Link>
          </section>

          {/* Minha Página de Pagamento */}
          <section className="bg-white p-4 md:p-6 rounded-lg shadow-md flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Minha Página de Pagamento</h2>
            <input
              type="text"
              readOnly
              value={paymentPageLink}
              className="w-full mb-4 px-3 py-2 border rounded-md text-center bg-gray-50"
            />
            <button onClick={handleCopyLink} className="w-full mb-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
              Copiar link
            </button>
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="QR Code Pagamento" width={150} height={150} />
            ) : (
              <div className="w-[150px] h-[150px] bg-gray-200 animate-pulse" />
            )}
            <button onClick={handleDownloadQR} className="w-full mt-4 px-4 py-2 border border-purple-600 rounded-md hover:bg-purple-50">
              Baixar QR Code
            </button>
          </section>
        </div>
      </div>
    );
  }

  return <div className="p-6 text-center">Redirecionando...</div>;
}
