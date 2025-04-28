'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

export default function AddPaymentMethod() {
  const router = useRouter()
  const { data: session, status } = useSession()
  useEffect(() => {
    // código do useEffect...
  }, []);
  
  const [cardData, setCardData] = useState({
    number: '',
    exp_month: '',
    exp_year: '',
    cvc: '',
    name: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Verificar autenticação
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?redirect=/payment-methods/add')
    }
  }, [status, router])
  
  const handleChange = (e) => {
    const { name, value } = e.target
    setCardData(prev => ({
      ...prev,
      [name]: value
    }))
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validação básica
    if (!cardData.number || !cardData.exp_month || !cardData.exp_year || !cardData.cvc || !cardData.name) {
      setError('Por favor, preencha todos os campos')
      return
    }
    
    try {
      setLoading(true)
      setError('')
      
      // Criar token do cartão no Stripe
      const { token, error: stripeError } = await stripe.createToken({
        number: cardData.number,
        exp_month: cardData.exp_month,
        exp_year: cardData.exp_year,
        cvc: cardData.cvc,
        name: cardData.name
      })
      
      if (stripeError) {
        throw new Error(stripeError.message)
      }
      
      // Enviar token para o servidor
      const response = await fetch('/api/client/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token.id
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao adicionar cartão')
      }
      
      // Redirecionar para o dashboard
      router.push('/dashboard?tab=payment-methods')
      
    } catch (err) {
      console.error('Erro ao adicionar cartão:', err)
      setError(err.message || 'Falha ao adicionar cartão')
    } finally {
      setLoading(false)
    }
  }
  
  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-md mx-auto">
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
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="mb-6">
            <Link href="/dashboard" className="text-purple-600 hover:text-purple-800">
              &larr; Voltar para o Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-4">Adicionar Cartão</h1>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nome no Cartão
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="cc-name"
                required
                value={cardData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Nome como aparece no cartão"
              />
            </div>
            
            <div>
              <label htmlFor="number" className="block text-sm font-medium text-gray-700 mb-1">
                Número do Cartão
              </label>
              <input
                id="number"
                name="number"
                type="text"
                autoComplete="cc-number"
                required
                value={cardData.number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="1234 5678 9012 3456"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label htmlFor="exp_month" className="block text-sm font-medium text-gray-700 mb-1">
                  Mês
                </label>
                <select
                  id="exp_month"
                  name="exp_month"
                  required
                  value={cardData.exp_month}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">MM</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {month.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="col-span-1">
                <label htmlFor="exp_year" className="block text-sm font-medium text-gray-700 mb-1">
                  Ano
                </label>
                <select
                  id="exp_year"
                  name="exp_year"
                  required
                  value={cardData.exp_year}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">AA</option>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="col-span-1">
                <label htmlFor="cvc" className="block text-sm font-medium text-gray-700 mb-1">
                  CVC
                </label>
                <input
                  id="cvc"
                  name="cvc"
                  type="text"
                  autoComplete="cc-csc"
                  required
                  value={cardData.cvc}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="123"
                />
              </div>
            </div>
            
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-purple-600 text-white py-3 px-4 rounded-md font-medium transition ${
                  loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'
                }`}
              >
                {loading ? 'Adicionando...' : 'Adicionar Cartão'}
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Seus dados de cartão são armazenados de forma segura pelo Stripe.</p>
            <p>Não armazenamos os dados completos do seu cartão em nossos servidores.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
