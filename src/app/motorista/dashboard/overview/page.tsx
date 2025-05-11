// src/app/motorista/dashboard/overview/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import QRCode from "qrcode";
import { format, subDays, subMonths, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// The API returns payment information
type Payment = {
  id: string;
  amount: number;     // in cents
  currency: string;
  status: string;
  paid: boolean;
  created: string;    // ISO date
  description: string;
  payment_method: string;
  receipt_url?: string;
};

type PaymentData = {
  total_paid: number;  // in cents
  currency: string;
  payments: Payment[];
  count: number;
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
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentPageLink, setPaymentPageLink] = useState("");
  const qrCodeRef = useRef<HTMLCanvasElement>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{ status: string | null; accountLink: string | null; }>({ status: null, accountLink: null });
  
  // Date selection and view mode states
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7)); // Default to 7 days ago
  const [endDate, setEndDate] = useState<Date>(new Date()); // Default to today
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Define fetchAll outside useEffect so it can be called from date picker
  const fetchAll = async () => {
    if (sessionStatus !== "authenticated") {
      if (sessionStatus === "unauthenticated") {
        router.push("/motorista/login");
      }
      return;
    }
    
    setLoading(true);
    setError("");
    setShowDatePicker(false);

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
        //    e.g. https://yourdomain.com/5511999999999
        const rawPhone = profileData.celular?.replace(/\D/g, "") || "";
        const link = `${window.location.origin}/${rawPhone}`;
        setPaymentPageLink(link);

        // Generate QR code once
        QRCode.toDataURL(link, { errorCorrectionLevel: "H", margin: 2, scale: 6 }, (_, url) => {
          if (url) setQrCodeUrl(url);
        });
        QRCode.toCanvas(qrCodeRef.current!, link, { errorCorrectionLevel: "H", margin: 2, width: 200 }, () => {});

        // 3) Fetch balance and transactions with date range
        try {
          const dateParams = new URLSearchParams({
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(endDate, 'yyyy-MM-dd')
          }).toString();
          
          const resp = await fetch(`/api/motorista/payments?${dateParams}`, { credentials: "include" });
          const data = await resp.json();
          
          // Check if the response has an error message (could be 200 OK with error details)
          if (data.error) {
            console.error("Payment API error:", data.error, data.code);
            // Don't throw, just set an error message and continue with default values
            setError(`Erro de pagamentos: ${data.error}`);
            setPaymentData({
              total_paid: 0,
              currency: "BRL",
              payments: [],
              count: 0
            });
          }
          // Handle response when Stripe account is not connected
          else if (data.needsConnection) {
            console.log("Stripe connection needed:", data.message);
            // Set default empty values but continue rendering the page
            setPaymentData({
              total_paid: 0,
              currency: "BRL",
              payments: [],
              count: 0
            });
            
            // Set stripe status explicitly based on needsConnection flag
            setStripeStatus(prevStatus => ({
              ...prevStatus,
              status: "needs_connection",
            }));
          } else {
            // Normal case: Stripe is connected
            setPaymentData({
              total_paid: data.total_paid,
              currency: data.currency,
              payments: data.payments,
              count: data.count
            });
            
            // Mark as verified if we got payment data successfully
            setStripeStatus(prevStatus => ({
              ...prevStatus,
              status: "verified",
            }));
          }
        } catch (error) {
          console.error("Error fetching payment data:", error);
          setError("Erro ao carregar dados de pagamento. Por favor, tente novamente.");
          setPaymentData({
            total_paid: 0,
            currency: "BRL",
            payments: [],
            count: 0
          });
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
  }, [sessionStatus]); // Remove router dependency to avoid lint warnings

  if (loading) {
    return <div className="p-6 text-center">Carregando dashboard...</div>;
  }
  if (error || !profile || !paymentData) {
    return (
      <div className="p-6 text-red-500">
        <p className="font-semibold">Erro ao carregar dashboard:</p>
        <p>{error || "Dados incompletos"}</p>
      </div>
    );
  }

  // Format balance from cents to reais
  const formatFromCents = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  // Format the total paid amount
  const formattedTotal = paymentData ? new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: paymentData.currency || 'BRL',
  }).format(paymentData.total_paid / 100) : 'R$ 0,00';

  return (
    <div className="p-4 md:p-8 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">
        Olá, {profile.nome || "Motorista"}!
      </h1>

      {/* Total Recebido */}
      <section className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold mb-2">Total Recebido</h2>
            <p className="text-4xl font-bold text-gray-900">{formattedTotal}</p>
            {paymentData?.payments?.length > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                {paymentData.count} pagamento{paymentData.count !== 1 ? 's' : ''} no total
              </p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-semibold mb-2">Últimos Pagamentos</h2>
            <p className="text-2xl font-bold text-gray-900">{paymentData?.payments?.length || 0}</p>
            <p className="mt-1 text-xs text-gray-500">Últimos 10 pagamentos</p>
          </div>
        </div>
      </section>

      {/* Faturamento Chart */}
      <section className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Faturamento por {viewMode === "weekly" ? "Semana" : "Mês"}</h2>
          <div className="flex space-x-2">
            <button 
              onClick={() => setViewMode("weekly")} 
              className={`px-3 py-1 text-sm rounded-md ${viewMode === "weekly" ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-700"}`}
            >
              Semanal
            </button>
            <button 
              onClick={() => setViewMode("monthly")} 
              className={`px-3 py-1 text-sm rounded-md ${viewMode === "monthly" ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-700"}`}
            >
              Mensal
            </button>
          </div>
        </div>
        
        {/* Simple Chart Placeholder */}
        <div className="h-40 w-full bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400">
          {viewMode === "weekly" ? "Gráfico de faturamento semanal" : "Gráfico de faturamento mensal"}
        </div>
      </section>
      
      {/* Date Range Selector */}
      <section className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">Período</h2>
          <button 
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            Selecionar Datas
          </button>
        </div>
        
        <div className="flex justify-center my-2">
          <div className="text-center bg-gray-100 py-2 px-4 rounded-lg">
            {format(startDate, 'dd/MM/yyyy')} → {format(endDate, 'dd/MM/yyyy')}
          </div>
        </div>
        
        {showDatePicker && (
          <div className="bg-white border rounded-md p-4 shadow-lg mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
                <input 
                  type="date" 
                  value={format(startDate, 'yyyy-MM-dd')}
                  onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : subDays(new Date(), 7))}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
                <input 
                  type="date" 
                  value={format(endDate, 'yyyy-MM-dd')}
                  onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : new Date())}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button 
                onClick={() => {
                  // Set to last 7 days
                  setStartDate(subDays(new Date(), 7));
                  setEndDate(new Date());
                }}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Última Semana
              </button>
              <button 
                onClick={() => {
                  // Set to last 30 days
                  setStartDate(subDays(new Date(), 30));
                  setEndDate(new Date());
                }}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Último Mês
              </button>
              <button 
                onClick={() => {
                  setShowDatePicker(false);
                  // Reload data with new date range
                  fetchAll();
                }}
                className="px-3 py-1 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-md"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}
      </section>
      
      {/* Últimos Pagamentos */}
      <section className="bg-white p-4 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Últimos Pagamentos</h2>
        {paymentData?.payments?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Data", "Valor", "Status", "Método", "Recibo"].map((th) => (
                    <th
                      key={th}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      {th}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paymentData.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {new Date(payment.created).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: payment.currency || 'BRL',
                      }).format(payment.amount / 100)}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        payment.status === 'succeeded' ? 'bg-green-100 text-green-800' : 
                        payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {payment.status === 'succeeded' ? 'Pago' : 
                         payment.status === 'pending' ? 'Pendente' : 'Falha'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 capitalize">
                      {payment.payment_method}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {payment.receipt_url ? (
                        <a 
                          href={payment.receipt_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:underline"
                        >
                          Ver recibo
                        </a>
                      ) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">Nenhum pagamento encontrado.</p>
        )}
      </section>

      {/* Meus Dados & Minha Página de Pagamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Stripe Account Status */}
        <div className="p-4 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Minha Página de Pagamento</h3>
          {!profile?.stripe_account_id ? (
            <div>
              <p className="text-red-600 mb-4">Para começar a receber pagamentos, você precisa conectar sua conta Stripe</p>
              <button
                onClick={() => fetch("/api/motorista/stripe", { method: "POST" })
                  .then(r => r.json())
                  .then(data => {
                    if (data.url) window.location.href = data.url;
                  })}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 w-full"
              >
                Conectar Stripe para Receber Pagamentos
              </button>
            </div>
          ) : (
            <div>
              {stripeStatus.status === "verified" ? (
                <div>
                  <div className="flex items-center text-green-600 mb-4">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Sua página de pagamento está ativa!
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <p className="text-sm text-gray-600 mb-2">Compartilhe este link com seus clientes:</p>
                    <input
                      readOnly
                      value={paymentPageLink}
                      className="w-full mb-2 px-3 py-2 border rounded text-center bg-white"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(paymentPageLink)}
                      className="w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                      Copiar link
                    </button>
                  </div>
                  {qrCodeUrl && (
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-2">Ou use o QR Code:</p>
                      <img src={qrCodeUrl} alt="QR Code" className="mx-auto" width={150} height={150} />
                    </div>
                  )}
                </div>
              ) : stripeStatus.status === "restricted" ? (
                <div>
                  <div className="flex items-center text-red-600 mb-4">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Atenção: Sua página de pagamento está temporariamente suspensa
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Para reativar sua página, acesse sua conta Stripe e resolva as pendências.</p>
                </div>
              ) : (
                <div>
                  {profile?.stripe_account_id ? (
                    <>
                      <div className="flex items-center text-green-600 mb-4">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Sua página de pagamento está ativa!
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg mb-4">
                        <p className="text-sm text-gray-600 mb-2">Compartilhe este link com seus clientes:</p>
                        <input
                          readOnly
                          value={paymentPageLink}
                          className="w-full mb-2 px-3 py-2 border rounded text-center bg-white"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center text-yellow-600 mb-4">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        Sua página está quase pronta!
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Complete a verificação da sua conta Stripe para começar a receber pagamentos.</p>
                    </>
                  )}
                </div>
              )}
              {stripeStatus.accountLink && (
                <a
                  href={stripeStatus.accountLink}
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {stripeStatus.status === "verified" ? "Acessar Dashboard Stripe" : "Completar verificação"}
                </a>
              )}
            </div>
          )}
        </div>
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
      </div>
    </div>
  );
}
