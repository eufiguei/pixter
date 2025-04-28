# Redirecionamento após Pagamento

Este arquivo implementa a página de sucesso após o pagamento, com opções para criar conta ou fazer login.

```jsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function PaymentSuccess() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [paymentId, setPaymentId] = useState('')
  
  // Verificar se o usuário já está logado
  useEffect(() => {
    if (status === 'authenticated') {
      // Se já estiver logado, redirecionar para o dashboard
      router.push('/dashboard?tab=payments')
    }
    
    // Obter o ID do pagamento da URL
    const urlParams = new URLSearchParams(window.location.search)
    const id = urlParams.get('payment_id')
    if (id) {
      setPaymentId(id)
    }
  }, [status, router])
  
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <svg className="h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Pagamento concluído</h2>
          <p className="mt-2 text-lg text-gray-600">
            O seu pagamento foi realizado com sucesso.
          </p>
        </div>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-center text-gray-900 mb-4">
            Cadastre-se para pagamentos mais rápidos
          </h3>
          <p className="text-center text-gray-600 mb-6">
            Crie uma conta para pagamentos mais rápidos e histórico de pagamentos.
          </p>
          
          <div className="space-y-4">
            <Link 
              href="/cadastro"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Criar conta
            </Link>
            
            <Link 
              href="/login"
              className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Entrar
            </Link>
          </div>
        </div>
        
        <div className="text-center text-sm text-gray-500">
          <Link href="/" className="text-purple-600 hover:text-purple-800">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </main>
  )
}
```
