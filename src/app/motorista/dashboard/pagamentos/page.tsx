// src/app/motorista/dashboard/pagamentos/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

// Define Payment type (matches your API)
type Payment = {
  id: string;
  data: string;       // ISO date
  valor: string;      // e.g. "R$ 50,00"
  metodo: string;
  recibo_id: string;  // Stripe charge ID
  status: string;
  cliente?: string;
};

export default function MeusPagamentosPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch payments with optional date filters
  const fetchPayments = async (start?: string, end?: string) => {
    setLoading(true);
    setError("");

    try {
      let url = "/api/motorista/payments";
      const params = new URLSearchParams();
      if (start) params.append("startDate", start);
      if (end)   params.append("endDate",   end);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        credentials: "include"
      });

      if (!res.ok) {
        // if 401, kick back to login
        if (res.status === 401) {
          router.push("/motorista/login");
          return;
        }
        const body = await res.json();
        throw new Error(body.error || `Erro (${res.status})`);
      }

      const { payments: data } = await res.json();
      setPayments(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar pagamentos:", err);
      setError(err.message || "Erro ao carregar pagamentos.");
    } finally {
      setLoading(false);
    }
  };

  // on mount & session ready
  useEffect(() => {
    if (sessionStatus === "loading") return;

    if (sessionStatus === "unauthenticated") {
      router.push("/motorista/login");
    } else {
      // authenticated
      fetchPayments();
    }
  }, [sessionStatus, router]);

  // apply date filter
  const handleFilter = () => {
    fetchPayments(startDate, endDate);
  };

  // --- RENDER ---
  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Meus Pagamentos</h1>

      {/* Date Filter */}
      <div className="bg-white p-4 rounded-lg shadow-md flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
            Data Início
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
            Data Fim
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <button
          onClick={handleFilter}
          disabled={loading}
          className="inline-flex items-center justify-center px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Filtrando..." : "Filtrar"}
        </button>
      </div>

      {/* Payments Table */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
        {loading && <p className="text-center text-gray-500">Carregando pagamentos...</p>}
        {error &&   <p className="text-center text-red-500">Erro: {error}</p>}

        {!loading && !error && (
          payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recibo</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(p.data).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.valor}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{p.metodo}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 capitalize">{p.status}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        <Link
                          href={`/api/receipts/${p.recibo_id}?type=driver`}
                          target="_blank"
                          className="text-indigo-600 hover:text-indigo-900"
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
            <p className="text-center text-gray-500">
              Nenhum pagamento encontrado para o período selecionado.
            </p>
          )
        )}
      </div>
    </div>
  );
}
