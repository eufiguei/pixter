'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

export default function ClientDashboard() {
  const router = useRouter()
  const { data: session, status } = useSession()
  
  const [activeTab, setActiveTab] = useState('payments')
  const [payments, setPayments] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Verificar autenticação
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])
  
  // Carregar dados do usuário
  useEffect(() => {
    if (status === 'authenticated') {
      fetchUserData()
    }
  }, [status])
  
  const fetchUserData = async () => {
    try {
      setLoading(true)
      
      // Buscar histórico de pagamentos
      const paymentsRes = await fetch('/api/client/payments')
      if (!paymentsRes.ok) {
        throw new Error('Erro ao carregar pagamentos')
      }
      
      const paymentsData = await paymentsRes.json()
      setPayments(paymentsData.payments || [])
      
      // Buscar métodos de pagamento
      const paymentMethodsRes = await fetch('/api/client/payment-methods')
      if (!paymentMethodsRes.ok) {
        throw new Error('Erro ao carregar métodos de pagamento')
      }
      
      const paymentMethodsData = await paymentMethodsRes.json()
      setPaymentMethods(paymentMethodsData.paymentMethods || [])
      
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Não foi possível carregar seus dados. Tente novamente mais tarde.')
    } finally {
      setLoading(false)
    }
  }
  
  const handleDeletePaymentMethod = async (paymentMethodId) => {
    if (!confirm('Tem certeza que deseja remover este método de pagamento?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/client/payment-methods/${paymentMethodId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Erro ao remover método de pagamento')
      }
      
      // Atualizar lista de métodos de pagamento
      setPaymentMethods(paymentMethods.filter(method => method.id !== paymentMethodId))
      
    } catch (err) {
      console.error('Erro ao remover método de pagamento:', err)
      setError('Não foi possível remover o método de pagamento. Tente novamente mais tarde.')
    }
  }
  
  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700"></div>
          </div>
        </div>
      </main>
    )
  }
  
  if (status === 'unauthenticated') {
    return null // Redirecionando para login
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white shadow-sm rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">PIXTER</h1>
            <nav className="flex space-x-4 mt-4 sm:mt-0">
              <button 
                onClick={() => setActiveTab('payments')}
                className={`${activeTab === 'payments' ? 'text-purple-600' : 'text-gray-600 hover:text-purple-600'}`}
              >
                Histórico de Pagamentos
              </button>
              <button 
                onClick={() => setActiveTab('payment-methods')}
                className={`${activeTab === 'payment-methods' ? 'text-purple-600' : 'text-gray-600 hover:text-purple-600'}`}
              >
                Métodos de Pagamento
              </button>
              <button 
                onClick={() => setActiveTab('profile')}
                className={`${activeTab === 'profile' ? 'text-purple-600' : 'text-gray-600 hover:text-purple-600'}`}
              >
                Meu Perfil
              </button>
              <Link href="/api/auth/signout" className="text-red-600 hover:text-red-800">
                Sair
              </Link>
            </nav>
          </div>
        </header>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}
        
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Olá, {session?.user?.name || 'Cliente'}!</h2>
        </div>
        
        {activeTab === 'payments' && (
          <section className="bg-white shadow-sm rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Histórico de Pagamentos</h2>
            
            {payments.length === 0 ? (
              <p className="text-gray-500">Você ainda não realizou nenhum pagamento.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motorista</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comprovante</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(payment.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          R$ {payment.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payment.driver_name || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payment.payment_method === 'card' ? 'Cartão' : 
                           payment.payment_method === 'pix' ? 'Pix' : 
                           payment.payment_method === 'apple_pay' ? 'Apple Pay' : 
                           payment.payment_method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <a 
                            href={`/api/client/receipt?paymentId=${payment.id}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:text-purple-800"
                          >
                            Baixar Comprovante
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        
        {activeTab === 'payment-methods' && (
          <section className="bg-white shadow-sm rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Métodos de Pagamento</h2>
            
            {paymentMethods.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-4">Você ainda não possui métodos de pagamento cadastrados.</p>
                <button
                  onClick={() => router.push('/payment-methods/add')}
                  className="bg-purple-600 text-white py-2 px-4 rounded-md font-medium hover:bg-purple-700"
                >
                  Adicionar Cartão
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-md">
                    <div className="flex items-center">
                      {method.card_brand === 'visa' && (
                        <svg className="w-10 h-10 mr-3" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24Z" fill="#1A1F71"/>
                          <path d="M17.0578 28.5986H13.8L15.9726 19.4014H19.2304L17.0578 28.5986Z" fill="white"/>
                          <path d="M27.7255 19.6522C27.0453 19.4014 26.3652 19.2761 25.5595 19.2761C22.8074 19.2761 20.8857 20.7795 20.8857 22.9113C20.8857 24.5401 22.3017 25.2923 23.3409 25.7939C24.3801 26.2954 24.7202 26.6716 24.7202 27.1731C24.7202 27.9253 23.8126 28.2761 22.9731 28.2761C21.7575 28.2761 21.1455 28.1508 20.1744 27.7746L19.8343 27.6493L19.4942 30.4823C20.3019 30.8585 21.7575 31.1093 23.2417 31.1093C26.1652 31.1093 28.0188 29.6312 28.0188 27.2984C28.0188 26.0457 27.2746 25.0427 25.6264 24.2905C24.6553 23.789 24.0433 23.4128 24.0433 22.9113C24.0433 22.4097 24.5872 21.9082 25.8028 21.9082C26.8421 21.9082 27.5903 22.1591 28.1342 22.4097L28.3743 22.5351L28.7144 19.7775L27.7255 19.6522Z" fill="white"/>
                          <path d="M32.9725 19.4014H30.4005C29.7203 19.4014 29.2445 19.5267 28.9044 20.1536L24.9604 28.5986H28.2863C28.2863 28.5986 28.7044 27.4212 28.8264 27.0451C29.1665 27.0451 32.0648 27.0451 32.5407 27.0451C32.6627 27.5466 32.8847 28.5986 32.8847 28.5986H35.8763L32.9725 19.4014ZM29.7203 24.5401C29.9604 23.9132 30.8681 21.6561 30.8681 21.6561C30.8681 21.6561 31.1401 21.0292 31.2621 20.6531L31.5022 21.5304C31.5022 21.5304 32.0648 24.0386 32.1868 24.5401H29.7203Z" fill="white"/>
                        </svg>
                      )}
                      {method.card_brand === 'mastercard' && (
                        <svg className="w-10 h-10 mr-3" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24Z" fill="#F7F7F7"/>
                          <path d="M24 31.9999C21.2311 34.6542 17.5242 36.1999 13.5 36.1999C5.76801 36.1999 0 30.4319 0 22.6999C0 14.9679 5.76801 9.19995 13.5 9.19995C17.5242 9.19995 21.2311 10.7456 24 13.3999C26.7689 10.7456 30.4758 9.19995 34.5 9.19995C42.232 9.19995 48 14.9679 48 22.6999C48 30.4319 42.232 36.1999 34.5 36.1999C30.4758 36.1999 26.7689 34.6542 24 31.9999Z" fill="#F7F7F7"/>
                          <path d="M24 13.3999C26.7689 10.7456 30.4758 9.19995 34.5 9.19995C42.232 9.19995 48 14.9679 48 22.6999C48 30.4319 42.232 36.1999 34.5 36.1999C30.4758 36.1999 26.7689 34.6542 24 31.9999V13.3999Z" fill="#EB001B"/>
                          <path d="M24 13.3999C21.2311 10.7456 17.5242 9.19995 13.5 9.19995C5.76801 9.19995 0 14.9679 0 22.6999C0 30.4319 5.76801 36.1999 13.5 36.1999C17.5242 36.1999 21.2311 34.6542 24 31.9999V13.3999Z" fill="#0099DF"/>
                          <path d="M24 13.3999V31.9999C26.7689 34.6542 30.4758 36.1999 34.5 36.1999C42.232 36.1999 48 30.4319 48 22.6999C48 14.9679 42.232 9.19995 34.5 9.19995C30.4758 9.19995 26.7689 10.7456 24 13.3999Z" fill="#FF5F00"/>
                        </svg>
                      )}
                      {method.card_brand === 'amex' && (
                        <svg className="w-10 h-10 mr-3" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24Z" fill="#016FD0"/>
                          <path d="M26.2622 24.9393H29.1459L27.7041 21.8393L26.2622 24.9393Z" fill="white"/>
                          <path d="M32.1459 28.0393H35.8459L33.4459 24.4393L32.1459 22.4393L30.8459 24.4393L28.4459 28.0393H32.1459Z" fill="white"/>
                          <path d="M33.4459 24.4393L35.8459 28.0393H32.1459L33.4459 24.4393Z" fill="#D9222A"/>
                          <path d="M12.1459 28.0393H16.1459L16.8459 26.4393H19.8459L20.5459 28.0393H24.5459L21.1459 20.0393H15.5459L12.1459 28.0393ZM17.5459 24.4393L18.3459 22.4393L19.1459 24.4393H17.5459Z" fill="white"/>
                          <path d="M14.1459 20.0393H20.1459V22.0393H14.1459V20.0393Z" fill="white"/>
                          <path d="M14.1459 26.0393H20.1459V28.0393H14.1459V26.0393Z" fill="white"/>
                          <path d="M26.1459 20.0393H32.1459V22.0393H26.1459V20.0393Z" fill="white"/>
                          <path d="M26.1459 26.0393H32.1459V28.0393H26.1459V26.0393Z" fill="white"/>
                        </svg>
                      )}
                      <div>
                        <p className="font-medium">•••• •••• •••• {method.last4}</p>
                        <p className="text-sm text-gray-500">Expira em {method.exp_month}/{method.exp_year}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePaymentMethod(method.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remover
                    </button>
                  </div>
                ))}
                
                <div className="mt-4">
                  <button
                    onClick={() => router.push('/payment-methods/add')}
                    className="bg-purple-600 text-white py-2 px-4 rounded-md font-medium hover:bg-purple-700"
                  >
                    Adicionar Novo Cartão
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
        
        {activeTab === 'profile' && (
          <section className="bg-white shadow-sm rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Meu Perfil</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Nome</p>
                <p className="text-base text-gray-900">{session?.user?.name}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-base text-gray-900">{session?.user?.email}</p>
              </div>
              
              <div className="pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Alterar Senha</h3>
                <form className="space-y-4">
                  <div>
                    <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Senha Atual
                    </label>
                    <input
                      id="current-password"
                      name="current-password"
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Nova Senha
                    </label>
                    <input
                      id="new-password"
                      name="new-password"
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirmar Nova Senha
                    </label>
                    <input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="bg-purple-600 text-white py-2 px-4 rounded-md font-medium hover:bg-purple-700"
                  >
                    Atualizar Senha
                  </button>
                </form>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
