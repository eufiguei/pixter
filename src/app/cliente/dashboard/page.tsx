'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react' // Added for real data
import { useSession } from 'next-auth/react' // Assuming next-auth for session

// Placeholder for payment data structure
interface Payment {
  id: string;
  data: string;
  valor: string;
  vendedor: string; // Should be 'vendedor' after global replace
  metodo: string;
  chargeId?: string; // For receipt link
}

// Placeholder for client data structure
interface ClientData {
  nome: string;
  email: string;
  telefone: string;
}

export default function ClienteDashboard() {
  const { data: session, status } = useSession(); // Get session and status
  const [pagamentos, setPagamentos] = useState<Payment[]>([]);
  const [dadosCliente, setDadosCliente] = useState<ClientData | null>(null);
  const [loadingPagamentos, setLoadingPagamentos] = useState(true);
  const [loadingDadosCliente, setLoadingDadosCliente] = useState(true);

  useEffect(() => {
    async function fetchPagamentos() {
      if (session?.user?.id) { // Ensure user is logged in
        try {
          // TODO: Replace with actual API endpoint for fetching client payments
          // Example: /api/payments/client or similar based on actual backend routes
          const response = await fetch(`/api/cliente/dashboard/historico`); // Assuming API route based on folder structure
          if (!response.ok) {
            throw new Error('Failed to fetch payments');
          }
          const data = await response.json();
          // TODO: Adapt data mapping as per actual API response
          setPagamentos(data.payments.map((p: any) => ({
            id: p.id,
            data: new Date(p.createdAt || p.data).toLocaleDateString('pt-BR'), // Adjust field names as needed
            valor: `R$ ${parseFloat(p.amount || p.valor).toFixed(2).replace('.', ',')}`,
            vendedor: p.merchantName || p.vendedor || 'N/A', // Will be Vendedor
            metodo: p.paymentMethod || p.metodo || 'N/A',
            chargeId: p.chargeId
          })));
        } catch (error) {
          console.error("Error fetching payments:", error);
          setPagamentos([]); // Set to empty array on error
        } finally {
          setLoadingPagamentos(false);
        }
      } else {
        setLoadingPagamentos(false); // No user, no payments to fetch
        setPagamentos([]);
      }
    }

    async function fetchDadosCliente() {
      if (session?.user?.id) { // Ensure user is logged in
        try {
          // TODO: Replace with actual API endpoint for fetching client data
          // Example: /api/users/me or similar
          const response = await fetch(`/api/cliente/dashboard/dados`); // Assuming API route based on folder structure
          if (!response.ok) {
            throw new Error('Failed to fetch client data');
          }
          const data = await response.json();
          // TODO: Adapt data mapping as per actual API response
          setDadosCliente({
            nome: data.user.name || data.user.nome || 'N/A',
            email: data.user.email || 'N/A',
            telefone: data.user.phone || data.user.telefone || 'N/A'
          });
        } catch (error) {
          console.error("Error fetching client data:", error);
          setDadosCliente(null); // Set to null on error
        } finally {
          setLoadingDadosCliente(false);
        }
      } else {
        setLoadingDadosCliente(false); // No user, no data to fetch
        setDadosCliente(null);
      }
    }

    if (status === 'authenticated' && session) { // Only fetch if session is authenticated
        fetchPagamentos();
        fetchDadosCliente();
    } else if (status !== 'loading') { // If status is not loading (e.g. unauthenticated)
        setLoadingPagamentos(false);
        setLoadingDadosCliente(false);
        setPagamentos([]);
        setDadosCliente(null);
    }
  }, [session, status]); // Re-run if session or status changes

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white py-4 shadow-sm">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/cliente/dashboard" className="text-2xl font-bold text-black flex items-center">
              <div className="w-10 h-10 bg-purple-700 rounded-md flex items-center justify-center mr-2">
                <span className="text-white font-bold">P</span>
              </div>
              Pixter
            </Link>
          </div>
          {/* Navbar items will be handled by NavBar.tsx / NavBarWrapper.tsx later or translated here */}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {status === 'loading' || loadingDadosCliente ? (
          <h1 className="text-4xl font-bold mb-8">Olá! Carregando...</h1>
        ) : dadosCliente && session ? (
          <h1 className="text-4xl font-bold mb-8">Olá, {dadosCliente.nome}!</h1>
        ) : (
          <h1 className="text-4xl font-bold mb-8">Olá! <Link href="/login" className="text-purple-600 hover:underline">Faça login</Link> para ver seus dados.</h1>
        )}

        <section id="pagamentos" className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Seus Pagamentos</h2>
          {status === 'loading' || loadingPagamentos ? (
            <p>Carregando pagamentos...</p>
          ) : !session ? (
             <p>Você precisa estar logado para ver seus pagamentos. <Link href="/login" className="text-purple-600 hover:underline">Faça login</Link>.</p>
          ) : pagamentos.length > 0 ? (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendedor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Método
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comprovante
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pagamentos.map((pagamento) => (
                    <tr key={pagamento.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {pagamento.data}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {pagamento.valor}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {pagamento.vendedor} {/* This will be 'Vendedor' after global change */}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {pagamento.metodo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {pagamento.chargeId ? (
                           <Link href={`/api/receipts/${pagamento.chargeId}`} target="_blank" className="text-purple-600 hover:text-purple-900">
                             Baixar Comprovante
                           </Link>
                        ) : (
                          <span>N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Você ainda não realizou nenhum pagamento.</p>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
          <section id="dados" className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Meus Dados</h2>
            {status === 'loading' || loadingDadosCliente ? (
              <p>Carregando dados...</p>
            ) : !session ? (
                <p>Você precisa estar logado para ver seus dados. <Link href="/login" className="text-purple-600 hover:underline">Faça login</Link>.</p>
            ) : dadosCliente ? (
              <div className="space-y-4">
                <div>
                  <p className="text-gray-600">Nome</p>
                  <p className="font-medium">{dadosCliente.nome}</p>
                </div>
                <div>
                  <p className="text-gray-600">Email</p>
                  <p className="font-medium">{dadosCliente.email}</p>
                </div>
                <div>
                  <p className="text-gray-600">Telefone</p> {/* This will be 'Celular' after global change */}
                  <p className="font-medium">{dadosCliente.telefone}</p>
                </div>
              </div>
            ) : (
              <p>Não foi possível carregar os dados do cliente.</p>
            )}
            <div className="mt-6">
              <Link href="/cliente/dashboard/dados">
                <button className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition" disabled={!session || status === 'loading'}>
                  Ver e Atualizar Informações
                </button>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

