
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation' // Import useSearchParams
import { useSession } from 'next-auth/react'

export default function PaymentSuccess() {
  const router = useRouter()
  const searchParams = useSearchParams() // Use hook to get search params
  const { data: session, status } = useSession()
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)

  // Effect to handle redirection and get payment ID
  useEffect(() => {
    if (status === 'authenticated') {
      // If already logged in, redirect to dashboard
      router.push('/dashboard?tab=payments')
      return; // Stop further execution in this effect
    }

    // Get the Payment Intent ID from the URL
    const id = searchParams.get('payment_intent') // Standard Stripe param
    if (id) {
      setPaymentIntentId(id)
    } else {
        // Fallback or handle missing ID
        console.warn("Payment Intent ID not found in URL params.");
    }
  }, [status, router, searchParams])

  // Effect to log temporary payment info
  useEffect(() => {
    if (paymentIntentId && status !== 'authenticated') {
      // Only log if we have an ID and the user isn't already logged in
      fetch('/api/log-temporary-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentIntentId }),
      })
      .then(response => {
        if (!response.ok) {
          console.error('Failed to log temporary payment:', response.statusText);
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          console.log('Temporary payment logged successfully.');
        } else {
          console.error('API Error logging temporary payment:', data.message);
        }
      })
      .catch(error => {
        console.error('Network error logging temporary payment:', error);
      });
    }
  }, [paymentIntentId, status]); // Depend on paymentIntentId and status

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

        {/* Only show signup/login options if user is not authenticated */}
        {status !== 'authenticated' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-center text-gray-900 mb-4">
              Cadastre-se para pagamentos mais rápidos
            </h3>
            <p className="text-center text-gray-600 mb-6">
              Crie uma conta para pagamentos mais rápidos e histórico de pagamentos.
            </p>

            <div className="space-y-4">
              <Link
                href="/cadastro" // Assuming this is the client signup page
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Criar conta
              </Link>

              <Link
                href="/login" // Assuming this is the client login page
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Entrar
              </Link>
            </div>
          </div>
        )}

        <div className="text-center text-sm text-gray-500">
          <Link href="/" className="text-purple-600 hover:text-purple-800">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </main>
  )
}

