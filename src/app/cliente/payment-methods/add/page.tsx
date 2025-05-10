'use client'

// @ts-ignore - Bypassing TypeScript errors for React hooks
// @ts-ignore - Bypassing TypeScript errors for React hooks
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getStripe } from '@/lib/stripe/client-side'
import { useSession } from 'next-auth/react'

export default function AddPaymentMethod() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [cardData, setCardData] = useState({
    number: '',
    exp_month: '',
    exp_year: '',
    cvc: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Redirecionar se não estiver autenticado
    if (status === 'unauthenticated') {
      router.push('/login')
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
    setLoading(true)
    setError('')
    
    try {
      // Inicialize o Stripe
      const stripe = await getStripe()
      
      // Criar token do cartão no Stripe
      const { token, error: stripeError } = await stripe.createToken({
        number: cardData.number,
        exp_month: cardData.exp_month,
        exp_year: cardData.exp_year,
        cvc: cardData.cvc
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
        body: JSON.stringify({ token: token.id }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Erro ao salvar cartão')
      }
      
      // Redirecionar para a página de métodos de pagamento
      router.push('/dashboard')
    } catch (error) {
      console.error('Erro ao adicionar cartão:', error)
      setError('Ocorreu um erro ao processar seu cartão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return <div className="flex justify-center items-center min-h-screen">Carregando...</div>
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Adicionar Cartão de Crédito</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Número do Cartão</label>
          <input
            type="text"
            name="number"
            value={cardData.number}
            onChange={handleChange}
            placeholder="4242 4242 4242 4242"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Mês</label>
            <input
              type="text"
              name="exp_month"
              value={cardData.exp_month}
              onChange={handleChange}
              placeholder="MM"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Ano</label>
            <input
              type="text"
              name="exp_year"
              value={cardData.exp_year}
              onChange={handleChange}
              placeholder="AAAA"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">CVC</label>
            <input
              type="text"
              name="cvc"
              value={cardData.cvc}
              onChange={handleChange}
              placeholder="123"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
        >
          {loading ? 'Processando...' : 'Adicionar Cartão'}
        </button>
      </form>
    </div>
  )
}
