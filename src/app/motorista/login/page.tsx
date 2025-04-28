'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LoginMotorista() {
  const router = useRouter()
  
  // Estados para as etapas do login
  const [step, setStep] = useState('phone') // 'phone', 'verify'
  
  // Estados para verificação de telefone
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('55')
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  
  // Estados para UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Contador regressivo para reenvio de código
  useEffect(() => {
    if (countdown <= 0) return
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [countdown])
  
  // Enviar código de verificação
  const enviarCodigoVerificacao = async () => {
    if (!phone) {
      setError('Por favor, informe seu número de WhatsApp')
      return
    }
    
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          countryCode
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar código de verificação')
      }
      
      setCodeSent(true)
      setCountdown(60) // 60 segundos para reenvio
      setSuccess('Código enviado com sucesso! Verifique seu WhatsApp.')
      
    } catch (err) {
      console.error('Erro ao enviar código:', err)
      setError(err.message || 'Falha ao enviar código de verificação')
    } finally {
      setLoading(false)
    }
  }
  
  // Verificar código
  const verificarCodigo = async () => {
    if (!verificationCode) {
      setError('Por favor, informe o código de verificação')
      return
    }
    
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          code: verificationCode,
          countryCode
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Código inválido ou expirado')
      }
      
      // Verificar se o usuário existe e fazer login
      const loginResponse = await fetch('/api/auth/login-driver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: data.phone
        }),
      })
      
      const loginData = await loginResponse.json()
      
      if (!loginResponse.ok) {
        throw new Error(loginData.error || 'Motorista não encontrado')
      }
      
      // Redirecionar para o dashboard
      router.push('/motorista/dashboard')
      
    } catch (err) {
      console.error('Erro ao verificar código:', err)
      setError(err.message || 'Falha ao verificar código')
    } finally {
      setLoading(false)
    }
  }

  // Renderização condicional baseada na etapa atual
  const renderStepContent = () => {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center">Login de Motorista</h2>
        <p className="text-center text-gray-600">
          Informe seu número de WhatsApp para acessar sua conta
        </p>
        
        <div>
          <label htmlFor="celular" className="block text-sm font-medium text-gray-700 mb-1">
            WhatsApp (com DDD)
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-gray-500">
              +{countryCode}
            </span>
            <input
              id="celular"
              name="celular"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="11 98765-4321"
            />
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
            {success}
          </div>
        )}
        
        <button
          type="button"
          onClick={enviarCodigoVerificacao}
          disabled={loading || !phone}
          className={`w-full bg-purple-600 text-white py-3 px-4 rounded-md font-medium transition ${
            loading || !phone ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'
          }`}
        >
          {loading && !codeSent ? 'Enviando...' : 'Enviar código de verificação'}
        </button>
        
        {codeSent && (
          <div className="mt-4">
            <div className="flex space-x-4">
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Digite o código"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              
              <button
                type="button"
                onClick={verificarCodigo}
                disabled={loading || !verificationCode}
                className={`bg-blue-600 text-white px-4 py-2 rounded-md font-medium transition ${
                  loading || !verificationCode ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
                }`}
              >
                {loading ? 'Verificando...' : 'Entrar'}
              </button>
            </div>
            
            {countdown > 0 ? (
              <p className="text-sm text-gray-500 mt-2">
                Reenviar código em {countdown}s
              </p>
            ) : (
              <button
                type="button"
                onClick={enviarCodigoVerificacao}
                disabled={loading}
                className="text-sm text-purple-600 hover:text-purple-800 mt-2"
              >
                Reenviar código
              </button>
            )}
          </div>
        )}
        
        <div className="text-center text-sm text-gray-500">
          Não tem uma conta? <Link href="/motorista/cadastro" className="text-purple-600 hover:text-purple-800">Cadastre-se aqui</Link>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="mb-6 text-center">
          <Link href="/" className="text-3xl font-bold text-gray-900">
            Pixter
          </Link>
        </div>
        
        {renderStepContent()}
      </div>
    </main>
  )
}
