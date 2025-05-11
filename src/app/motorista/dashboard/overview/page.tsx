// src/app/motorista/dashboard/overview/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import QRCode from "qrcode";
import { format, subDays } from "date-fns";
// import { ptBR } from "date-fns/locale"; // Not used in the provided snippet, can be removed if not used elsewhere

// Type for individual transaction/payment item
interface TransactionItem {
  id: string;
  chargeId: string | null;
  amount: string; // Formatted string e.g., "R$ 10,00"
  currency: string;
  description: string;
  created: string; // ISO date string
  type: string;
  metodo: string | null;
  cliente: string | null;
  fee?: string; // Formatted string
  status: "completed" | "pending" | string;
  receipt_url?: string; // Added for consistency, though API might not provide it yet
}

// Type for driver profile data
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentPageLink, setPaymentPageLink] = useState("");
  const qrCodeRef = useRef<HTMLCanvasElement>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{ status: string | null; accountLink: string | null; }>({ status: null, accountLink: null });
  
  // State for Stripe balance
  const [availableBalance, setAvailableBalance] = useState<string>("R$ 0,00");
  const [pendingBalance, setPendingBalance] = useState<string>("R$ 0,00");
  // const [balanceCurrency, setBalanceCurrency] = useState<string>("BRL"); // Currency is part of the formatted string

  // State for transactions
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  // Date selection and view mode states
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7)); // Default to 7 days ago
  const [endDate, setEndDate] = useState<Date>(new Date()); // Default to today
  const [showDatePicker, setShowDatePicker] = useState(false);

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

        const rawPhone = profileData.celular?.replace(/\D/g, "") || "";
        const link = `${window.location.origin}/${rawPhone}`;
        setPaymentPageLink(link);

        QRCode.toDataURL(link, { errorCorrectionLevel: "H", margin: 2, scale: 6 }, (_, url) => {
          if (url) setQrCodeUrl(url);
        });
        if (qrCodeRef.current) {
            QRCode.toCanvas(qrCodeRef.current, link, { errorCorrectionLevel: "H", margin: 2, width: 200 }, () => {});
        }
        
        const dateParams = new URLSearchParams({
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd')
        }).toString();
        
        const resp = await fetch(`/api/motorista/payments?${dateParams}`, { credentials: "include" });
        const data = await resp.json();
        
        if (data.error && !data.balance) { // If there's an error and no balance data, it's a full fetch error
          console.error("Payment API error:", data.error, data.code);
          setError(`Erro de pagamentos: ${data.error}`);
          setAvailableBalance("Erro");
          setPendingBalance("Erro");
          setTransactions([]);
        } else if (data.needsConnection) {
          console.log("Stripe connection needed:", data.message);
          setAvailableBalance("N/A");
          setPendingBalance("N/A");
          setTransactions([]);
          setStripeStatus(prevStatus => ({ ...prevStatus, status: "needs_connection" }));
        } else {
          // Populate balance
          if (data.balance) {
            if (data.balance.available && data.balance.available.length > 0) {
              setAvailableBalance(data.balance.available[0].amount);
            } else {
              setAvailableBalance("R$ 0,00");
            }
            if (data.balance.pending && data.balance.pending.length > 0) {
              setPendingBalance(data.balance.pending[0].amount);
            } else {
              setPendingBalance("R$ 0,00");
            }
          } else {
            setAvailableBalance("N/A"); // Or some error/default value
            setPendingBalance("N/A");
          }
          // Populate transactions
          setTransactions(data.transactions || []);
          setStripeStatus(prevStatus => ({ ...prevStatus, status: "verified" }));
        }

        const stripeResp = await fetch("/api/motorista/stripe", { credentials: "include" });
        if (stripeResp.ok) {
          const stripeData = await stripeResp.json();
          setStripeStatus(prevStatus => ({ // Merge with previous status if already set by payments API
            ...prevStatus,
            status: stripeData.status || prevStatus.status, 
            accountLink: stripeData.accountLink || stripeData.loginLink
          }));
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Erro inesperado");
        setAvailableBalance("Erro");
        setPendingBalance("Erro");
        setTransactions([]);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchAll();
    } else if (sessionStatus === "unauthenticated") {
      router.push("/motorista/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]); // fetchAll will be called when session is authenticated

  // Removed router from dependencies of main useEffect to prevent multiple calls if fetchAll is memoized or stable.
  // If fetchAll itself needs to be a dependency (e.g., if it changes based on other state not just sessionStatus), 
  // then it should be wrapped in useCallback.

  if (sessionStatus === "loading" || loading) {
    return <div className="p-6 text-center">Carregando dashboard...</div>;
  }
  
  // Check for error after loading is complete
  if (error && !profile) { // If profile also failed to load, show main error
    return (
      <div className="p-6 text-red-500">
        <p className="font-semibold">Erro ao carregar dashboard:</p>
        <p>{error}</p>
      </div>
    );
  }
  
  // If profile is missing but no major error, could be an edge case or still loading profile parts
  if (!profile) {
      return <div className="p-6 text-center">Carregando perfil do motorista...</div>; 
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">
        Olá, {profile.nome || "Motorista"}!
      </h1>

      {error && (
        <div className="p-4 text-red-500 bg-red-100 border border-red-300 rounded-md">
          <p className="font-semibold">Aviso:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Saldo Disponível e Pendente */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-2 text-gray-700">Saldo Disponível</h2>
          <p className="text-4xl font-bold text-green-600">{availableBalance}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-2 text-gray-700">Saldo Pendente</h2>
          <p className="text-4xl font-bold text-yellow-600">{pendingBalance}</p>
        </div>
      </section>

      {/* Faturamento Chart Placeholder */}
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
        <div className="h-40 w-full bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400">
          {/* Placeholder for chart */}
          Gráfico de faturamento (implementação futura)
        </div>
      </section>
      
      {/* Date Range Selector */}
      <section className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">Período das Transações</h2>
          <button 
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
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
                <input type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : subDays(new Date(), 7))} className="w-full border rounded-md px-3 py-2"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
                <input type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : new Date())} className="w-full border rounded-md px-3 py-2"/>
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button onClick={() => { setStartDate(subDays(new Date(), 7)); setEndDate(new Date()); }} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md">Última Semana</button>
              <button onClick={() => { setStartDate(subDays(new Date(), 30)); setEndDate(new Date()); }} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md">Último Mês</button>
              <button onClick={() => { setShowDatePicker(false); fetchAll(); }} className="px-3 py-1 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-md">Aplicar</button>
            </div>
          </div>
        )}
      </section>
      
      {/* Transações Recentes */}
      <section className="bg-white p-4 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Transações Recentes</h2>
        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Data", "Valor", "Status", "Método", "Cliente", "Descrição"].map((th) => (
                    <th key={th} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{format(new Date(tx.created), "dd/MM/yyyy HH:mm")}</td>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{tx.amount}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                        tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {tx.status === 'completed' ? 'Pago' : tx.status === 'pending' ? 'Pendente' : tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 capitalize whitespace-nowrap">{tx.metodo || 'N/A'}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{tx.cliente || 'N/A'}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{tx.description}</td>
                    {/* Add receipt_url if available and needed */}
                    {/* <td className="px-4 py-2 text-sm">
                      {tx.receipt_url ? (
                        <a href={tx.receipt_url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Ver recibo</a>
                      ) : 'N/A'}
                    </td> */}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">Nenhuma transação encontrada para o período selecionado.</p>
        )}
      </section>

      {/* Meus Dados & Minha Página de Pagamento - Placeholder, assuming this part is okay */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Meus Dados</h2>
          <Link href="/motorista/dashboard/dados" className="text-purple-600 hover:underline">
            Ver ou editar meus dados
          </Link>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Minha Página de Pagamento</h2>
          {paymentPageLink && (
            <div className="space-y-3">
              <input type="text" value={paymentPageLink} readOnly className="w-full p-2 border rounded-md bg-gray-50" />
              <button onClick={() => navigator.clipboard.writeText(paymentPageLink)} className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm">Copiar Link</button>
              {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code da Página de Pagamento" className="mx-auto mt-2 border rounded-md"/>}
            </div>
          )}
        </div>
      </section>

      {/* Stripe Account Management */}
      {stripeStatus.status && (
        <section className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Gerenciamento da Conta Stripe</h2>
          {stripeStatus.status === "needs_connection" && (
            <p className="text-orange-600 mb-2">Sua conta Stripe precisa ser configurada ou verificada.</p>
          )}
          {stripeStatus.status === "pending" && (
            <p className="text-yellow-600 mb-2">Sua conta Stripe está com verificação pendente.</p>
          )}
          {stripeStatus.status === "restricted" && (
            <p className="text-red-600 mb-2">Sua conta Stripe está restrita. Verifique seu email ou o painel Stripe para mais detalhes.</p>
          )}
          {stripeStatus.status === "verified" && (
            <p className="text-green-600 mb-2">Sua conta Stripe está ativa e verificada.</p>
          )}
          {stripeStatus.accountLink && (
            <a href={stripeStatus.accountLink} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              {stripeStatus.status === "needs_connection" ? "Configurar Conta Stripe" : "Acessar Painel Stripe"}
            </a>
          )}
        </section>
      )}
    </div>
  );
}