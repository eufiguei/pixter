'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function MotoristaPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [paymentUrl, setPaymentUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Carregar dados do perfil e pagamentos
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Buscar perfil do motorista
        const profileRes = await fetch('/api/motorista/profile')
        if (!profileRes.ok) {
          // Se não estiver autenticado, redireciona para login
          if (profileRes.status === 401) {
            router.push('/motorista/login')
            return
          }
          throw new Error('Erro ao carregar perfil')
        }
        
        const profileData = await profileRes.json()
        setProfile(profileData)
        
        // Buscar pagamentos recebidos
        const paymentsRes = await fetch('/api/motorista/payments')
        if (!paymentsRes.ok) {
          throw new Error('Erro ao carregar pagamentos')
        }
        
        const paymentsData = await paymentsRes.json()
        setPayments(paymentsData.payments || [])
        
        // Buscar QR code para pagamentos
        const qrRes = await fetch(`/api/stripe/driver-qr-code?driverId=${profileData.id}`)
        if (qrRes.ok) {
          const qrData = await qrRes.json()
          setQrCode(qrData.qrCode)
          setPaymentUrl(qrData.paymentUrl)
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
        setError('Não foi possível carregar seus dados. Tente novamente mais tarde.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [router])
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const handleDownloadQR = () => {
    const link = document.createElement('a')
    link.href = qrCode
    link.download = 'pixter-qrcode.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST'
      })
      router.push('/motorista/login')
    } catch (err) {
      console.error('Erro ao fazer logout:', err)
    }
  }
  
  if (loading) {
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

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white shadow-sm rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">PIXTER</h1>
            <nav className="flex space-x-4 mt-4 sm:mt-0">
              <a href="#pagamentos" className="text-gray-600 hover:text-purple-600">Pagamentos Recebidos</a>
              <a href="#dados" className="text-gray-600 hover:text-purple-600">Meus Dados</a>
              <a href="#pagina" className="text-gray-600 hover:text-purple-600">Minha Página de Pagamento</a>
              <button 
                onClick={handleLogout}
                className="text-red-600 hover:text-red-800"
              >
                Sair
              </button>
            </nav>
          </div>
        </header>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}
        
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Olá, {profile?.nome || 'Motorista'}!</h2>
        </div>
        
        <section id="pagamentos" className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Pagamentos Recebidos</h2>
          
          {payments.length === 0 ? (
            <p className="text-gray-500">Você ainda não recebeu nenhum pagamento.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
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
                        {payment.client_name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.payment_method === 'card' ? 'Cartão' : 
                         payment.payment_method === 'pix' ? 'Pix' : 
                         payment.payment_method === 'apple_pay' ? 'Apple Pay' : 
                         payment.payment_method}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <a 
                          href={`/api/motorista/receipt?paymentId=${payment.id}`} 
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section id="dados" className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Meus Dados</h2>
            
            {profile && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Nome</p>
                  <p className="text-base text-gray-900">{profile.nome}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-base text-gray-900">{profile.email || '—'}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">WhatsApp</p>
                  <p className="text-base text-gray-900">{profile.celular}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Profissão</p>
                  <p className="text-base text-gray-900">{profile.profissao || 'Motorista'}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Conta Bancária/Pix</p>
                  <p className="text-base text-gray-900">
                    {profile.stripe_account_id ? 'Cadastrada' : 'Não cadastrada'}
                  </p>
                </div>
                
                <button
                  className="bg-purple-600 text-white py-2 px-4 rounded-md font-medium hover:bg-purple-700"
                  onClick={() => router.push('/motorista/perfil/editar')}
                >
                  Atualizar informações
                </button>
              </div>
            )}
          </section>
          
          <section id="pagina" className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Minha Página de Pagamento</h2>
            
            {paymentUrl && (
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Link para pagamento</p>
                  <div className="flex">
                    <input
                      type="text"
                      readOnly
                      value={paymentUrl}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="bg-purple-600 text-white px-4 py-2 rounded-r-md font-medium hover:bg-purple-700"
                    >
                      {copied ? 'Copiado!' : 'Copiar link'}
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <p className="text-sm font-medium text-gray-500 mb-2">QR Code para pagamento</p>
                  
                  {qrCode && (
                    <div className="mb-4">
                      <img src={qrCode} alt="QR Code de pagamento" className="w-48 h-48" />
                    </div>
                  )}
                  
                  <button
                    onClick={handleDownloadQR}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700"
                  >
                    Baixar QR Code
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
