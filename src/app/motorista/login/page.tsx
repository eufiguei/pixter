'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function LoginMotorista() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Implementação futura: integração com Supabase
    console.log('Login de motorista:', { email, senha })
  }
  
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="flex justify-center mb-8">
          <Link href="/" className="text-2xl font-bold text-black flex items-center">
            <div className="w-10 h-10 bg-purple-700 rounded-md flex items-center justify-center mr-2">
              <span className="text-white font-bold">P</span>
            </div>
            Pixter
          </Link>
        </div>
        
        <h2 className="text-3xl font-bold text-center mb-6">Acesse sua conta</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <button
              type="submit"
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-md font-medium hover:bg-purple-700 transition"
            >
              Entrar
            </button>
          </div>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Não tem uma conta? <Link href="/motorista/cadastro" className="text-purple-600 hover:text-purple-800 font-medium">Crie agora</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
