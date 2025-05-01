// src/app/motorista/dashboard/overview/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Define Payment type (should match the one from API)
type Payment = {
  id: string;
  data: string; // ISO string date
  valor: string; // Formatted currency string (e.g., "R$ 50,00")
  valor_original?: string; // Optional original value
  metodo: string;
  recibo_id: string; // Charge ID for receipt link
  status: string;
  // Add client info if available from API
  cliente?: string;
};

// Helper to parse currency string to number
function parseCurrency(value: string): number {
  if (!value) return 0;
  // Remove currency symbol, thousands separators, and replace comma with dot
  const numericString = value.replace(/R\$\s?/, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(numericString) || 0;
}

// Helper to group payments by week
function groupPaymentsByWeek(payments: Payment[]): { [weekStart: string]: number } {
  const weeklyTotals: { [weekStart: string]: number } = {};
  payments.forEach(payment => {
    const paymentDate = new Date(payment.data);
    const dayOfWeek = paymentDate.getDay(); // 0 = Sunday, 6 = Saturday
    const diff = paymentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const weekStartDate = new Date(paymentDate.setDate(diff));
    weekStartDate.setHours(0, 0, 0, 0); // Normalize to start of the day
    const weekStartString = weekStartDate.toISOString().split("T")[0]; // YYYY-MM-DD

    const amount = parseCurrency(payment.valor); // Use the received amount
    weeklyTotals[weekStartString] = (weeklyTotals[weekStartString] || 0) + amount;
  });
  return weeklyTotals;
}

export default function OverviewPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch payments data
  useEffect(() => {
    const fetchPayments = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch payments from the last few months for the graph
        // Adjust date range as needed
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const startDate = threeMonthsAgo.toISOString().split("T")[0];

        const paymentsRes = await fetch(`/api/motorista/payments?startDate=${startDate}`);
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
        console.error("Erro ao carregar pagamentos para overview:", err);
        setError(err.message || "Não foi possível carregar os dados de pagamento.");
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, [router]);

  // --- Calculate Metrics ---
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const currentMonthPayments = payments.filter(p => {
    const paymentDate = new Date(p.data);
    return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
  });

  const currentMonthEarnings = currentMonthPayments.reduce((sum, p) => sum + parseCurrency(p.valor), 0);

  const recentPayments = payments.slice(0, 5); // Get the 5 most recent payments

  // --- Prepare Chart Data ---
  const weeklyTotals = groupPaymentsByWeek(payments);
  const sortedWeeks = Object.keys(weeklyTotals).sort();
  const chartLabels = sortedWeeks.map(weekStart => {
      const start = new Date(weekStart);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} - ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  });
  const chartDataValues = sortedWeeks.map(weekStart => weeklyTotals[weekStart]);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Faturamento Semanal (R$)",
        data: chartDataValues,
        backgroundColor: "rgba(90, 45, 130, 0.6)", // Pixter purple
        borderColor: "rgba(90, 45, 130, 1)",
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false, // Hide legend as per image
      },
      title: {
        display: false, // Hide title as per image
      },
      tooltip: {
          callbacks: {
              label: function(context: any) {
                  let label = context.dataset.label || "";
                  if (label) {
                      label += ": ";
                  }
                  if (context.parsed.y !== null) {
                      label += new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(context.parsed.y);
                  }
                  return label;
              }
          }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
           callback: function(value: any) {
               return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
           }
        }
      },
    },
  };

  // --- Render Logic ---
  if (loading) return <div className="p-6 text-center">Carregando visão geral...</div>;
  if (error) return <div className="p-6 text-red-500">Erro: {error}</div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Top Row: Graph and Monthly Earnings */} 
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Earnings Graph */} 
        <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Faturamento por Semana</h2>
          {payments.length > 0 ? (
             <Bar options={chartOptions} data={chartData} />
          ) : (
             <p className="text-gray-500">Sem dados de faturamento para exibir.</p>
          )}
          {/* Optional: Add date range selector here later */}
        </div>

        {/* Current Month Earnings */} 
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
          <h2 className="text-lg font-semibold mb-2 text-gray-700">Este Mês</h2>
          <p className="text-3xl font-bold text-gray-800">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(currentMonthEarnings)}
          </p>
        </div>
      </div>

      {/* Recent Payments Section */} 
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
           <h2 className="text-lg font-semibold text-gray-700">Pagamentos Recentes</h2>
           <Link href="/motorista/dashboard/pagamentos" className="text-sm text-indigo-600 hover:text-indigo-800">
             Ver Todos
           </Link>
        </div>
        {recentPayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                  {/* <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th> */} 
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Recibo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{new Date(payment.data).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{payment.valor}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{payment.metodo}</td>
                    {/* <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{payment.cliente || "-"}</td> */} 
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
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
          <p className="text-gray-500">Nenhum pagamento recente encontrado.</p>
        )}
      </div>
    </div>
  );
}

