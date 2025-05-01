// src/app/motorista/dashboard/overview/page.tsx
// Redesigned based on user feedback (A3BE9B45)
// Added Payment Page section content
// Updated to use NextAuth useSession for auth check

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react"; // Import useSession
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import QRCode from "qrcode"; // Import QR code library

// Define Payment type (should match the one from API)
type Payment = {
  id: string;
  data: string; // ISO string date
  valor: string; // Formatted currency string (e.g., "R$ 50,00")
  valor_original?: string; // Optional original value
  metodo: string;
  recibo_id: string; // Charge ID for receipt link
  status: string;
  cliente?: string; // Assuming API might provide client name
};

// Define Profile type
type Profile = {
    id: string;
    nome?: string;
    email?: string;
    telefone?: string;
    stripe_account_id?: string;
    // Add other fields as needed
};

export default function DriverDashboardPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { data: session, status: sessionStatus } = useSession(); // Use NextAuth session

  const [payments, setPayments] = useState<Payment[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingData, setLoadingData] = useState(true); // Separate loading state for data
  const [error, setError] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [paymentPageLink, setPaymentPageLink] = useState<string>("");
  const qrCodeRef = useRef<HTMLCanvasElement>(null); // Ref for canvas QR code

  // Fetch payments and profile data
  useEffect(() => {
    // Only run if session is authenticated and user is motorista
    if (sessionStatus === "authenticated" && session?.user?.tipo === "motorista") {
      const userId = session.user.id;

      const fetchData = async () => {
        setLoadingData(true);
        setError("");
        try {
          // Fetch profile using Supabase (RLS should allow based on authenticated user ID)
          const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("id, nome, email, telefone, stripe_account_id") // Fetch needed profile fields
              .eq("id", userId)
              .eq("tipo", "motorista") // Double check type here, though session should have it
              .single();

          if (profileError) {
              if (profileError.code === "PGRST116") {
                  // This case should ideally not happen if session.user.tipo is correct
                  throw new Error("Perfil de motorista não encontrado. Verifique seus dados.");
              } else {
                  throw new Error(profileError.message || "Erro ao buscar perfil.");
              }
          }
          setProfile(profileData);

          // Construct payment page link (assuming it uses profile ID)
          const link = `${window.location.origin}/pagamento/${profileData.id}`;
          setPaymentPageLink(link);

          // Generate QR Code URL
          QRCode.toDataURL(link, { errorCorrectionLevel: 'H', margin: 2, scale: 6 }, (err, url) => {
              if (err) console.error("QR Code generation error:", err);
              else setQrCodeUrl(url);
          });
          // Also draw to canvas for download
          QRCode.toCanvas(qrCodeRef.current, link, { errorCorrectionLevel: 'H', margin: 2, width: 200 }, (err) => {
              if (err) console.error("QR Code canvas error:", err);
          });

          // Fetch payments (adjust date range if needed, maybe last 30 days?)
          const paymentsRes = await fetch(`/api/motorista/payments`); // Fetch all for now
          if (!paymentsRes.ok) {
            const errorData = await paymentsRes.json();
            // Handle specific errors from the API if needed
            throw new Error(errorData.error || `Erro ao carregar pagamentos (${paymentsRes.status})`);
          }
          const paymentsData = await paymentsRes.json();
          setPayments(paymentsData.payments || []);

        } catch (err: any) {
          console.error("Erro ao carregar dados do dashboard do motorista:", err);
          setError(err.message || "Não foi possível carregar os dados do dashboard.");
        } finally {
          setLoadingData(false);
        }
      };
      fetchData();
    } else if (sessionStatus === "unauthenticated") {
        // Redirect if not authenticated
        router.push("/motorista/login");
    } else if (sessionStatus === "authenticated" && session?.user?.tipo !== "motorista") {
        // Handle case where user is logged in but not a driver
        setError("Acesso negado. Esta área é apenas para motoristas.");
        setLoadingData(false);
        // Optionally redirect to a different page
        // router.push("/");
    }
    // If sessionStatus is 'loading', do nothing and wait

  }, [sessionStatus, session, router, supabase]); // Depend on sessionStatus and session

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentPageLink)
      .then(() => alert("Link copiado!"))
      .catch(err => console.error("Erro ao copiar link:", err));
  };

  const handleDownloadQR = () => {
    if (qrCodeRef.current) {
        const link = document.createElement("a");
        link.download = `pixter_qr_${profile?.id || 'code'}.png`;
        link.href = qrCodeRef.current.toDataURL('image/png');
        link.click();
    }
  };

  // --- Render Logic ---
  // Show loading state while session is loading
  if (sessionStatus === "loading" || (sessionStatus === "authenticated" && loadingData)) {
      return <div className="p-6 text-center">Carregando dashboard...</div>;
  }

  // Show error message if any error occurred or user is not a driver
  if (error) {
      return <div className="p-6 text-red-500">Erro: {error}</div>;
  }

  // If authenticated and profile is loaded, show dashboard
  if (sessionStatus === "authenticated" && profile) {
    return (
      <div className="p-4 md:p-8 space-y-8">
        {/* Greeting */}
        <h1 className="text-3xl font-bold text-gray-800">
          Olá, {profile?.nome || "Motorista"}!
        </h1>

        {/* Pagamentos Recebidos Section */}
        <section id="pagamentos" className="bg-white p-4 md:p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Pagamentos Recebidos</h2>
          {payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Comprovante</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{new Date(payment.data).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{payment.valor}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{payment.cliente || "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{payment.metodo}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/api/receipts/${payment.recibo_id}?type=driver`} target="_blank" className="text-indigo-600 hover:text-indigo-900">
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

        {/* Meus Dados & Minha Página de Pagamento Sections (Grid Layout) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Meus Dados Section */}
          <section id="dados" className="bg-white p-4 md:p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Meus Dados</h2>
            <div className="space-y-2 text-gray-700 mb-4">
              <p><span className="font-medium">Nome:</span> {profile?.nome || "-"}</p>
              <p><span className="font-medium">Email:</span> {profile?.email || "-"}</p>
              <p><span className="font-medium">Telefone:</span> {profile?.telefone || "-"}</p>
              {/* TODO: Add display for bank/pix info if available in profile */}
              <p><span className="font-medium">Conta Bancária/Pix:</span> Cadastrada</p> {/* Placeholder */}
            </div>
            <Link href="/motorista/dashboard/dados">
              <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2">
                Atualizar informações
              </button>
            </Link>
          </section>

          {/* Minha Página de Pagamento Section */}
          <section id="pagina-pagamento" className="bg-white p-4 md:p-6 rounded-lg shadow-md flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Minha Página de Pagamento</h2>
            <div className="mb-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Link da sua página:</p>
              <input
                  type="text"
                  readOnly
                  value={paymentPageLink}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-gray-700 bg-gray-50"
              />
            </div>
            <button
              onClick={handleCopyLink}
              className="w-full mb-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              Copiar link
            </button>

            <div className="mb-4">
              {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code Pagamento" width={150} height={150} />
              ) : (
                  <div className="w-[150px] h-[150px] bg-gray-200 animate-pulse flex items-center justify-center text-gray-500">Gerando QR...</div>
              )}
              {/* Hidden canvas for download */}
              <canvas ref={qrCodeRef} style={{ display: 'none' }}></canvas>
            </div>

            <button
              onClick={handleDownloadQR}
              className="w-full px-4 py-2 bg-white text-purple-600 border border-purple-600 rounded-md hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              Baixar QR Code
            </button>
          </section>
        </div>

      </div>
    );
  }

  // Fallback for unexpected states (e.g., authenticated but no profile yet, though handled by error state now)
  return <div className="p-6 text-center">Redirecionando...</div>; // Or some other placeholder
}
