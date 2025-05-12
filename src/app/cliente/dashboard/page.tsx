'use client'

import Link from 'next/link'

export default function ClienteDashboard() {

  
  // Dados simulados para o dashboard
  const pagamentos = [
    { data: '22/04/2025', valor: 'R$ 32,50', motorista: 'João', metodo: 'Pix' },
    { data: '18/04/2025', valor: 'R$ 45,00', motorista: 'Maria', metodo: 'Apple Pay' },
    { data: '15/04/2025', valor: 'R$ 27,00', motorista: 'Pedro', metodo: 'Cartão -1234' },
  ]

  const dadosCliente = {
    nome: 'Ana Silva',
    email: 'ana@exemplo.com',
    telefone: '+55 11 98765-4321'
  }

  const cartoesSalvos = [
    { tipo: 'Visa', final: '4321', validade: '12/27' },
    { tipo: 'Mastercard', final: '8765', validade: '08/26' }
  ]

  return (
    <main className="min-h-screen bg-gray-50">
     

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Olá, Ana!</h1>

        {/* Pagamentos */}
        <section id="pagamentos" className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Seus Pagamentos</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
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
                    Motorista
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
                {pagamentos.map((pagamento, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pagamento.data}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pagamento.valor}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pagamento.motorista}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pagamento.metodo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <a href="#" className="text-purple-600 hover:text-purple-900">
                        Baixar Comprovante
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Meus Dados */}
          <section id="dados" className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Meus Dados</h2>
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
                <p className="text-gray-600">Telefone</p>
                <p className="font-medium">{dadosCliente.telefone}</p>
              </div>
            </div>
            <div className="mt-6">
              <button className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition">
                Atualizar informações
              </button>
            </div>
          </section>

          {/* Cartões Salvos */}
          <section id="cartoes" className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Cartões Salvos</h2>
            <div className="space-y-4">
              {cartoesSalvos.map((cartao, index) => (
                <div key={index} className="flex justify-between items-center p-3 border border-gray-200 rounded-md">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-md flex items-center justify-center mr-3">
                      <span className="text-blue-800 font-bold text-xs">{cartao.tipo}</span>
                    </div>
                    <div>
                      <p className="font-medium">•••• •••• •••• {cartao.final}</p>
                      <p className="text-sm text-gray-500">Válido até {cartao.validade}</p>
                    </div>
                  </div>
                  <button className="text-red-600 hover:text-red-800">
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <button className="bg-gray-100 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-200 transition flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Adicionar novo cartão
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
