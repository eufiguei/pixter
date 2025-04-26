'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function PaginaPagamento() {
  const [valor, setValor] = useState('')
  const [gorjeta, setGorjeta] = useState(0)
  const [processando, setProcessando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessando(true)
    
    // Simulação de processamento de pagamento
    // Futuramente será integrado com Stripe
    setTimeout(() => {
      window.location.href = '/pagamento/sucesso'
    }, 1500)
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="flex flex-col items-center mb-6">
          <h2 className="text-2xl font-bold mb-2">PayQuick</h2>
          
          {/* Avatar do motorista estilo Ghibli */}
          <div className="w-32 h-32 bg-gray-200 rounded-full overflow-hidden mb-4">
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-gray-500">Avatar Ghibli</span>
            </div>
          </div>
          
          <h3 className="text-xl font-medium">João</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="valor" className="block text-sm font-medium text-gray-700 mb-1">
              Enter fare amount (R$)
            </label>
            <input
              id="valor"
              name="valor"
              type="number"
              step="0.01"
              required
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full px-3 py-3 text-lg border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="0.00"
            />
          </div>
          
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Adicionar gorjeta:</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setGorjeta(0)}
                className={`py-2 px-4 rounded-md transition ${
                  gorjeta === 0 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Sem gorjeta
              </button>
              <button
                type="button"
                onClick={() => setGorjeta(1)}
                className={`py-2 px-4 rounded-md transition ${
                  gorjeta === 1 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                + R$1
              </button>
              <button
                type="button"
                onClick={() => setGorjeta(2)}
                className={`py-2 px-4 rounded-md transition ${
                  gorjeta === 2 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                + R$2
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              + Adicione R$1 ou R$2 para pagar antes de chegar e evitar a espera na saída.
            </p>
          </div>
          
          <button
            type="submit"
            disabled={!valor || processando}
            className={`w-full bg-blue-900 text-white py-4 px-4 rounded-md font-medium text-lg transition ${
              !valor || processando ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-800'
            }`}
          >
            {processando ? 'Processando...' : 'Pay with Pix, Apple Pay, or Card'}
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">
            Payments are secure via Stripe.
          </p>
          <p className="text-sm text-gray-600">
            Apple Pay & Pix accepted
          </p>
        </div>
      </div>
    </main>
  )
}
