'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function PagamentoSucesso() {
  const [email, setEmail] = useState('')
  const [cadastrado, setCadastrado] = useState(false)
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Futuramente: integração com Supabase para cadastro de cliente
    setCadastrado(true)
  }
  
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Pagamento Realizado!</h1>
        <p className="text-gray-600 mb-6">
          Seu pagamento foi processado com sucesso.
        </p>
        
        {!cadastrado ? (
          <div className="mb-6">
            <p className="mb-4">Receba o recibo por e-mail:</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Seu e-mail"
                required
              />
              <button
                type="submit"
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition"
              >
                Receber recibo
              </button>
            </form>
          </div>
        ) : (
          <div className="mb-6">
            <p className="text-green-600 mb-4">
              Recibo enviado para {email}
            </p>
            <p className="text-gray-600">
              Crie uma conta para acessar seu histórico de pagamentos e salvar seus métodos de pagamento.
            </p>
            <div className="mt-4">
              <Link href="/cadastro" className="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition inline-block">
                Criar conta
              </Link>
            </div>
          </div>
        )}
        
        <div className="border-t pt-6">
          <p className="mb-4">Detalhes do pagamento:</p>
          <div className="text-left space-y-2">
            <div className="flex justify-between">
              <span>Valor:</span>
              <span>R$ 25,00</span>
            </div>
            <div className="flex justify-between">
              <span>Gorjeta:</span>
              <span>R$ 2,00</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>R$ 27,00</span>
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <Link href="/" className="text-purple-600 hover:underline">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </main>
  )
}
