// src/app/motorista/dashboard/pagamentos/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Define Payment type (should match the one from API)
type Payment = {
  id: string;
  data: string; // ISO string date
  valor: string; // Formatted currency string (e.g., "R$ 50,00")
  metodo: string;
  recibo_id: string; // Charge ID for receipt link
  status: string;
  cliente?: string; // Optional client info
};

export default function MeusPagamentosPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch payments data based on date range
  const fetchPayments = async (start?: string, end?: string) => {
    setLoading(true);
    setError("");
    try {
      let url = "/api/motorista/payments";
      const params = new URLSearchParams();
      if (start) params.append("startDate", start);
      if (end) params.append("endDate", end);
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const paymentsRes = await fetch(url);
      if (!paymentsRes.ok) {
        if (paymentsRes.status === 401) {
          router.push("/motorista/login");
          return;
        }
        const errorData = await paymentsRes.json();
        throw new Error(errorData.error || `Erro ao carregar pagamentos (${paymentsRes.status})`);
      }
      const paymentsData = await paymentsRes.json();
      setPayments(paymentsData.payments || []);
    } catch (err: any) {
      console.error("Erro ao carregar pagamentos:", err);
      setError(err.message || "Não foi possível carregar os dados de pagamento.");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchPayments();
  }, []);

  // Handle date filter application
  const handleFilter = () => {
    fetchPayments(startDate, endDate);
  };

  // --- Render Logic ---
  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Meus Pagamentos</h1>

      {/* Date Filter Section */} 
      <div className="bg-white p-4 rounded-lg shadow-md flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1">
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <div className="mt-2 md:mt-5">
          <button
            onClick={handleFilter}
            disabled={loading}
            className="w-full md:w-auto inline-flex justify-center py-2 px-5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? "Filtrando..." : "Filtrar"}
          </button>
        </div>
      </div>

      {/* Payments List Section */} 
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
        {loading && <p className="text-center text-gray-500">Carregando pagamentos...</p>}
        {error && <p className="text-center text-red-500">Erro: {error}</p>}
        {!loading && !error && (
          payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    {/* <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th> */} 
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Recibo</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{new Date(payment.data).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{payment.valor}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{payment.metodo}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 capitalize">{payment.status}</td>
                      {/* <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{payment.cliente || "-"}</td> */} 
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        {/* Task 3.4: Add download link */}
                        <Link href={`/api/receipts/${payment.recibo_id}?type=driver`} target="_blank" className="text-indigo-600 hover:text-indigo-900">
                          Baixar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500">Nenhum pagamento encontrado para o período selecionado.</p>
          )
        )}
      </div>
    </div>
  );
}

