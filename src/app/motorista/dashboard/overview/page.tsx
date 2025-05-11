// src/app/vendedor/dashboard/overview/page.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react"; // Added React import
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import QRCode from "qrcode";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

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
  receipt_url?: string;
}

// Type for driver profile data
type Profile = {
  id: string;
  nome?: string;
  email?: string;
  celular?: string;
  tipo?: string;
  stripe_account_id?: string | null;
  stripe_account_status?: "pending" | "verified" | "restricted" | null;
};

const parseCurrencyToFloat = (value: string): number => {
  if (!value) return 0;
  return parseFloat(value.replace(/R\$\s?/, "").replace(/\./g, "").replace(",", "."));
};

export default function VendedorDashboardPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentPageLink, setPaymentPageLink] = useState("");
  const qrCodeRef = useRef<HTMLCanvasElement>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{ status: string | null; accountLink: string | null; }>({ status: null, accountLink: null });
  
  const [availableBalance, setAvailableBalance] = useState<string>("R$ 0,00");
  const [pendingBalance, setPendingBalance] = useState<string>("R$ 0,00");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 6)); 
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchAll = async (currentStartDate: Date, currentEndDate: Date) => {
    if (sessionStatus !== "authenticated") {
      if (sessionStatus === "unauthenticated") {
        router.push("/vendedor/login");
      }
      return;
    }
    
    setLoading(true);
    setError("");

      try {
        const pr = await fetch("/api/vendedor/profile", { credentials: "include" });
        if (!pr.ok) {
          const err = await pr.json();
          throw new Error(err.error || `Erro ao carregar perfil (${pr.status})`);
        }
        const profileData: Profile = await pr.json();
        if (profileData.tipo !== "vendedor") {
          throw new Error("Acesso negado: não é vendedor");
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
          startDate: format(currentStartDate, "yyyy-MM-dd"),
          endDate: format(currentEndDate, "yyyy-MM-dd")
        }).toString();
        
        const resp = await fetch(`/api/vendedor/payments?${dateParams}`, { credentials: "include" });
        const data = await resp.json();
        
        if (data.error && !data.balance) {
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
          if (data.balance) {
            setAvailableBalance(data.balance.available?.[0]?.amount || "R$ 0,00");
            setPendingBalance(data.balance.pending?.[0]?.amount || "R$ 0,00");
          }
          setTransactions(data.transactions || []);
          setStripeStatus(prevStatus => ({ ...prevStatus, status: "verified" }));
        }

        const stripeResp = await fetch("/api/vendedor/stripe", { credentials: "include" });
        if (stripeResp.ok) {
          const stripeData = await stripeResp.json();
          setStripeStatus(prevStatus => ({
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
      let initialStartDate = subDays(new Date(), 6);
      let initialEndDate = new Date();
      if (viewMode === "monthly") {
        initialStartDate = startOfMonth(new Date());
        initialEndDate = endOfMonth(new Date());
      }
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
      fetchAll(initialStartDate, initialEndDate);
    } else if (sessionStatus === "unauthenticated") {
      router.push("/vendedor/login");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, viewMode]);

  const handleDateFilterApply = () => {
    setShowDatePicker(false);
    fetchAll(startDate, endDate);
  }

  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const dailySums: { [key: string]: number } = {};
    transactions.forEach(tx => {
      if (tx.status === "completed" || tx.status === "succeeded") {
        const date = format(parseISO(tx.created), "yyyy-MM-dd");
        dailySums[date] = (dailySums[date] || 0) + parseCurrencyToFloat(tx.amount);
      }
    });

    let intervalDays: Date[] = [];
    try {
        intervalDays = eachDayOfInterval({ start: startDate, end: endDate });
    } catch (e) {
        console.error("Error creating date interval for chart:", e);
        const today = new Date();
        intervalDays = eachDayOfInterval({ start: subDays(today, 6), end: today });
    }

    if (viewMode === "weekly") {
      return intervalDays.map(day => ({
        name: format(day, "dd/MM", { locale: ptBR }),
        Faturamento: dailySums[format(day, "yyyy-MM-dd")] || 0,
      }));
    } else {
        return intervalDays.map(day => ({
            name: format(day, "dd/MM", { locale: ptBR }),
            Faturamento: dailySums[format(day, "yyyy-MM-dd")] || 0,
        }));
    }
  }, [transactions, startDate, endDate, viewMode]);

  if (sessionStatus === "loading" || (loading && !profile)) {
    return <div className="p-6 text-center">Carregando dashboard...</div>;
  }
  
  if (error && !profile) {
    return (
      <div className="p-6 text-red-500">
        <p className="font-semibold">Erro ao carregar dashboard:</p>
        <p>{error}</p>
      </div>
    );
  }
  
  if (!profile) {
      return <div className="p-6 text-center">Carregando perfil do vendedor...</div>; 
  }

  return (
    <div className="p-4 md:p-8 space-y-8 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800">
        Olá, {profile.nome || "Vendedor"}!
      </h1>

      {error && !loading && (
        <div className="p-4 text-red-500 bg-red-100 border border-red-300 rounded-md">
          <p className="font-semibold">Aviso:</p>
          <p>{error}</p>
        </div>
      )}

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

      <section className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <h2 className="text-xl font-semibold mb-2 sm:mb-0">Faturamento ({viewMode === "weekly" ? "Últimos 7 dias" : "Período Selecionado"})</h2>
          <div className="flex space-x-2">
            <button 
              onClick={() => setViewMode("weekly")} 
              className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === "weekly" ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
            >
              Semanal
            </button>
            <button 
              onClick={() => setViewMode("monthly")} 
              className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === "monthly" ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
            >
              Mensal
            </button>
          </div>
        </div>
        {loading ? (
            <div className="h-64 w-full bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                Carregando gráfico...
            </div>
        ) : chartData.length > 0 ? (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `R$${value}`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)} />
                <Legend />
                <Bar dataKey="Faturamento" fill="#8884d8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
            <div className="h-64 w-full bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                Sem dados de faturamento para o período selecionado.
            </div>
        )}
      </section>
      
      <section className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">Período das Transações</h2>
          <button 
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Selecionar Datas
          </button>
        </div>
        <div className="flex justify-center my-2">
          <div className="text-center bg-gray-100 py-2 px-4 rounded-lg text-sm">
            {format(startDate, "dd/MM/yyyy", { locale: ptBR })} → {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
          </div>
        </div>
        {showDatePicker && (
          <div className="bg-white border rounded-md p-4 shadow-lg mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDateOverview" className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
                <input id="startDateOverview" type="date" value={format(startDate, "yyyy-MM-dd")} onChange={(e) => setStartDate(e.target.value ? parseISO(e.target.value) : subDays(new Date(), 6))} className="w-full border-gray-300 rounded-md shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="endDateOverview" className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
                <input id="endDateOverview" type="date" value={format(endDate, "yyyy-MM-dd")} onChange={(e) => setEndDate(e.target.value ? parseISO(e.target.value) : new Date())} className="w-full border-gray-300 rounded-md shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"/>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2">
              <button onClick={() => { const today = new Date(); setStartDate(subDays(today, 6)); setEndDate(today); }} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md w-full sm:w-auto transition-colors">Últimos 7 dias</button>
              <button onClick={() => { const today = new Date(); setStartDate(startOfMonth(today)); setEndDate(endOfMonth(today)); }} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md w-full sm:w-auto transition-colors">Este Mês</button>
              <button onClick={() => { const today = new Date(); const prevMonthStart = startOfMonth(subDays(today, 30)); const prevMonthEnd = endOfMonth(subDays(today, 30)); setStartDate(prevMonthStart); setEndDate(prevMonthEnd);}} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md w-full sm:w-auto transition-colors">Mês Anterior</button>
              <button onClick={handleDateFilterApply} className="px-4 py-1.5 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-md w-full sm:w-auto transition-colors">Aplicar</button>
            </div>
          </div>
        )}
      </section>
      
      <section className="bg-white p-4 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Transações Recentes (Período Selecionado)</h2>
        {loading ? (
            <p className="text-gray-500 text-center py-4">Carregando transações...</p>
        ) : transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{format(parseISO(tx.created), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{tx.amount}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        tx.status === "completed" || tx.status === "succeeded" ? "bg-green-100 text-green-800" :
                        tx.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {tx.status === "completed" || tx.status === "succeeded" ? "Pago" : tx.status === "pending" ? "Pendente" : tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 capitalize whitespace-nowrap">{tx.metodo || "N/A"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{tx.cliente || "N/A"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={tx.description}>{tx.description || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">Nenhuma transação encontrada para o período selecionado.</p>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Meus Dados</h2>
          <Link href="/vendedor/dashboard/dados" className="text-purple-600 hover:text-purple-700 font-medium transition-colors">
            Ver ou editar meus dados
          </Link>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Minha Página de Pagamento</h2>
          {paymentPageLink && (
            <div className="space-y-3">
              <input type="text" value={paymentPageLink} readOnly className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-sm" />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(paymentPageLink);
                  // Add visual feedback here if needed for Task 11
                }}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                Copiar Link
              </button>
            </div>
          )}
          {qrCodeUrl && (
            <div className="mt-4 flex flex-col items-center">
                <h3 className="text-md font-medium text-gray-700 mb-2">QR Code para Pagamento</h3>
                <Image src={qrCodeUrl} alt="QR Code Pagamento" width={180} height={180} />
                <canvas ref={qrCodeRef} style={{ display: "none" }} /> 
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

