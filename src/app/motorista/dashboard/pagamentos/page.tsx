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

type Period = "day" | "week" | "month";

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
  const [period, setPeriod] = useState<Period>("week"); // Default to week as per image

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
      // Set initial date range for the last week
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 6);
      const initialStartDate = weekAgo.toISOString().split('T')[0];
      const initialEndDate = today.toISOString().split('T')[0];
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
      fetchPayments(initialStartDate, initialEndDate);
    }
  }, [sessionStatus, router]);

  const handleFilter = () => {
    fetchPayments(startDate, endDate);
  };

  // --- Chart Data Calculation (simplified for brevity, might need adjustment) ---
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    const parseValue = (v: string) =>
      parseFloat(v.replace(/[^\d,-]/g, "").replace(",", "."));

    transactions.forEach((t) => {
      const date = new Date(t.data);
      const label = date.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' }); // Format as DD/MM
      map[label] = (map[label] || 0) + parseValue(t.amount);
    });

    // Ensure we have entries for the last 7 days relative to endDate
    const end = endDate ? new Date(endDate) : new Date();
    const finalMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(end.getDate() - i);
        const label = d.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
        finalMap[label] = map[label] || 0; // Use existing value or 0
    }

    return Object.entries(finalMap).map(([label, value]) => ({ label, value }));
  }, [transactions, endDate]);

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

      {/* Top Widgets */} 
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Faturamento por Semana Chart */} 
        <div className="md:col-span-2 bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-700 mb-3">Faturamento por Semana</h2>
          <div style={{ width: "100%", height: 150 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 5, right: 0, left: -30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={12} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                <Tooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                <Bar dataKey="value" fill="#d8b4fe" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Últimos Meses Value */} 
        <div className="bg-white p-4 rounded-lg shadow flex flex-col justify-center">
          <h2 className="text-lg font-medium text-gray-700 mb-2">Últimos Meses</h2>
          {/* Note: This value needs proper calculation logic */} 
          <p className="text-3xl font-bold text-gray-800">{totalLastMonths}</p>
        </div>
      </div>

      {/* Date Filter Display */} 
      <div className="bg-white p-3 rounded-lg shadow flex justify-center items-center text-gray-700">
        <span>{formattedDateRange}</span>
        {/* Consider adding a date picker component here for interaction */} 
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

      {/* Hidden Date Filter Inputs (or replace with a proper date range picker component) */}
      <div className="hidden">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <button onClick={handleFilter}>Filter</button>
      </div>
    </div>
  );
}

