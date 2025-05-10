// src/app/motorista/dashboard/pagamentos/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays, subMonths, parseISO } from "date-fns";

type BalanceEntry = { amount: string; currency: string };
type Transaction = {
  id: string; // Balance Transaction ID
  chargeId: string | null; // Charge ID for receipt
  data: string; // Date (ISO string from backend)
  amount: string;
  metodo: string | null; // Payment method
  cliente: string | null; // Client email/identifier
  description?: string;
  type: string;
  fee?: string;
};

type ViewMode = "weekly" | "monthly";

export default function MeusPagamentosPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [balance, setBalance] = useState<{
    available: BalanceEntry[];
    pending: BalanceEntry[];
  } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("weekly"); // Default weekly view
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchPayments = async (start?: string, end?: string) => {
    setLoading(true);
    setError("");
    try {
      let url = "/api/motorista/payments";
      const params = new URLSearchParams();
      if (start) params.append("startDate", start);
      if (end)   params.append("endDate", end);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/motorista/login");
          return;
        }
        const body = await res.json();
        throw new Error(body.error || `Erro (${res.status})`);
      }

      const json = await res.json();
      setBalance(json.balance);
      setTransactions(json.transactions);
    } catch (err: any) {
      console.error("Erro ao carregar pagamentos:", err);
      setError(err.message || "Erro ao carregar pagamentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (sessionStatus === "unauthenticated") {
      router.push("/motorista/login");
    } else {
      // Set default to last 7 days
      setLastDaysRange(7);
    }
  }, [sessionStatus, router]);
  
  // Helper function to set date range for last N days
  const setLastDaysRange = (days: number) => {
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - (days - 1)); // Subtract days-1 to include today
    
    const start = pastDate.toISOString().split('T')[0];
    const end = today.toISOString().split('T')[0];
    
    setStartDate(start);
    setEndDate(end);
    fetchPayments(start, end);
  };
  
  // Helper function to set date range for last N months
  const setLastMonthsRange = (months: number) => {
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setMonth(today.getMonth() - (months - 1));
    pastDate.setDate(1); // Start of month
    
    const start = pastDate.toISOString().split('T')[0];
    const end = today.toISOString().split('T')[0];
    
    setStartDate(start);
    setEndDate(end);
    fetchPayments(start, end);
  };

  const handleFilter = () => {
    fetchPayments(startDate, endDate);
  };

  // Generate chart data based on transactions and view mode
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    const parseValue = (v: string) =>
      parseFloat(v.replace(/[^\d,-]/g, "").replace(",", "."));

    // Process all transactions
    transactions.forEach((t) => {
      const date = new Date(t.data);
      let label;
      
      // Format differently based on view mode
      if (viewMode === "weekly") {
        // For weekly view, use day/month format
        label = date.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
      } else {
        // For monthly view, use month/year format
        label = date.toLocaleDateString("pt-BR", { month: '2-digit', year: '2-digit' });
      }
      
      map[label] = (map[label] || 0) + parseValue(t.amount);
    });

    // Create appropriate date entries based on selected view mode
    const end = endDate ? new Date(endDate) : new Date();
    const finalMap: Record<string, number> = {};
    
    if (viewMode === "weekly") {
      // Last 7 days for weekly view
      for (let i = 6; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(end.getDate() - i);
        const label = d.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
        finalMap[label] = map[label] || 0;
      }
    } else {
      // Last 6 months for monthly view
      for (let i = 5; i >= 0; i--) {
        const d = new Date(end);
        d.setMonth(end.getMonth() - i);
        const label = d.toLocaleDateString("pt-BR", { month: '2-digit', year: '2-digit' });
        finalMap[label] = map[label] || 0;
      }
    }

    return Object.entries(finalMap).map(([label, value]) => ({ label, value }));
  }, [transactions, endDate, viewMode]);

  const totalLastMonths = useMemo(() => {
    // Placeholder for "Últimos Meses" - requires different API logic or calculation
    // For now, summing current transactions as a placeholder
    const total = transactions.reduce((sum, t) => {
        const value = parseFloat(t.amount.replace(/[^\d,-]/g, "").replace(",", "."));
        return sum + value;
    }, 0);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total);
  }, [transactions]);

  const formattedDateRange = useMemo(() => {
    if (!startDate || !endDate) return "";
    const start = new Date(startDate + 'T00:00:00'); // Ensure correct date parsing
    const end = new Date(endDate + 'T00:00:00');
    return `${start.toLocaleDateString("pt-BR")} → ${end.toLocaleDateString("pt-BR")}`;
  }, [startDate, endDate]);


  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header section - Assuming NavBar is handled in layout */}
      {/* <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Pixter</h1>
        <nav className="space-x-4">
          <Link href="/motorista/dashboard/dados" className="text-gray-600 hover:text-gray-900">Meus Dados</Link>
          <Link href="/motorista/dashboard/pagina-pagamento" className="text-gray-600 hover:text-gray-900">Minha Página de Pagamento</Link>
        </nav>
      </div> */} 

      {/* View Mode and Date Filter Controls */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <h2 className="text-xl font-semibold mb-2 sm:mb-0">Faturamento por {viewMode === "weekly" ? "Semana" : "Mês"}</h2>
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
        
        {/* Date Selection */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className="flex items-center mb-2 sm:mb-0">
            <span className="text-gray-600 mr-2">Período:</span>
            <span className="font-medium">{formattedDateRange}</span>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setLastDaysRange(7)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Última Semana
            </button>
            <button 
              onClick={() => setLastDaysRange(30)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Últimos 30 dias
            </button>
            <button 
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              Selecionar
            </button>
          </div>
        </div>
        
        {/* Date Picker (visible when showDatePicker is true) */}
        {showDatePicker && (
          <div className="mt-4 p-4 border rounded-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button 
                onClick={() => {
                  setShowDatePicker(false);
                  fetchPayments(startDate, endDate);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Widgets */} 
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Faturamento Chart */} 
        <div className="md:col-span-2 bg-white p-4 rounded-lg shadow">
          <div style={{ width: "100%", height: 170 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={12} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                <Tooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                <Bar dataKey="value" fill="#d8b4fe" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Saldo no Período */} 
        <div className="bg-white p-4 rounded-lg shadow flex flex-col justify-center">
          <h2 className="text-lg font-medium text-gray-700 mb-2">Saldo no Período</h2>
          <p className="text-3xl font-bold text-gray-800">{totalLastMonths}</p>
          <p className="text-sm text-gray-500 mt-1">{formattedDateRange}</p>
        </div>
      </div>

      {/* Pagamentos Section */} 
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Pagamentos</h2>
        {loading && <p className="text-center text-gray-500 py-4">Carregando…</p>}
        {error && <p className="text-center text-red-500 py-4">Erro: {error}</p>}
        {!loading && !error && (
          transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                {/* Use light gray background for header, remove uppercase, add padding */} 
                <thead className="bg-gray-50">
                  <tr>
                    {["Data", "Valor", "Método", "Cliente", ""].map((th, index) => (
                      <th 
                        key={th} 
                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 ${index === 4 ? 'text-right' : ''}`}
                      >
                        {th}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {new Date(t.data).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{t.amount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{t.metodo || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{t.cliente || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {t.chargeId && (
                          <Link
                            href={`/api/receipts/${t.chargeId}?type=driver`}
                            target="_blank"
                            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Baixar Recibo
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">Nenhuma movimentação encontrada para o período selecionado.</p>
          )
        )}
      </div>


    </div>
  );
}

