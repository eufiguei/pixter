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
  id: string;
  data: string;
  amount: string;
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
  const [period, setPeriod] = useState<Period>("day");

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
      fetchPayments();
    }
  }, [sessionStatus, router]);

  const handleFilter = () => {
    fetchPayments(startDate, endDate);
  };

  const chartData = useMemo(() => {
    const now = new Date();
    const map: Record<string, number> = {};
    const parseValue = (v: string) =>
      parseFloat(v.replace(/[R$\.\s]/g, "").replace(",", "."));

    if (period === "day") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        map[d.toLocaleDateString("pt-BR")] = 0;
      }
      transactions.forEach((t) => {
        const label = new Date(t.data).toLocaleDateString("pt-BR");
        if (label in map) map[label] += parseValue(t.amount);
      });
    }

    if (period === "week") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const start = new Date(d);
        start.setDate(d.getDate() - d.getDay() + 1);
        map[start.toLocaleDateString("pt-BR")] = 0;
      }
      transactions.forEach((t) => {
        const d = new Date(t.data);
        const start = new Date(d);
        start.setDate(d.getDate() - d.getDay() + 1);
        const label = start.toLocaleDateString("pt-BR");
        if (label in map) map[label] += parseValue(t.amount);
      });
    }

    if (period === "month") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        });
        map[label] = 0;
      }
      transactions.forEach((t) => {
        const d = new Date(t.data);
        const label = d.toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        });
        if (label in map) map[label] += parseValue(t.amount);
      });
    }

    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [transactions, period]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Meus Pagamentos</h1>

      {/* Balance widget */}
      {balance && (
        <section className="bg-white p-4 rounded-lg shadow-md flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium text-gray-700">Saldo Disponível</h2>
            <p className="text-3xl font-bold">
              {balance.available[0]?.amount || "R$ 0,00"}
            </p>
            {balance.pending[0] && (
              <p className="text-sm text-gray-500">
                Pendente: {balance.pending[0].amount}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Chart */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium text-gray-700">Faturamento</h2>
          <div className="space-x-2">
            {(["day", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded ${
                  period === p ? "bg-purple-600 text-white" : "bg-gray-100"
                }`}
              >
                {p === "day" ? "Dia" : p === "week" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ width: "100%", height: 150 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-white p-4 rounded-lg shadow-md flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data Início
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data Fim
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        <button
          onClick={handleFilter}
          disabled={loading}
          className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Filtrando..." : "Filtrar"}
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        {loading && <p className="text-center text-gray-500">Carregando…</p>}
        {error && <p className="text-center text-red-500">Erro: {error}</p>}
        {!loading && !error && (
          transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {["Data","Valor","Descrição","Taxa","Tipo","Recibo"].map((th) => (
                      <th key={th} className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                        {th}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-2 text-sm">{new Date(t.data).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-2 text-sm font-medium">{t.amount}</td>
                      <td className="px-4 py-2 text-sm">{t.description||"-"}</td>
                      <td className="px-4 py-2 text-sm">{t.fee||"-"}</td>
                      <td className="px-4 py-2 text-sm">{t.type}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        <Link
                          href={`/api/receipts/${t.id}?type=driver`}
                          target="_blank"
                          className="text-indigo-600 hover:underline"
                        >
                          Baixar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500">Nenhuma movimentação.</p>
          )
        )}
      </div>
    </div>
  );
}
