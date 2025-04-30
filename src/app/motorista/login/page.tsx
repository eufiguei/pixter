'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from "next-auth/react"; // Import signIn

export default function MotoristaLogin() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('55')
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Enviar código de verificação (Keep this function as is, assuming /api/auth/send-verification works)
  const enviarCodigoVerificacao = async () => {
    if (!phone) {
      setError('Por favor, informe seu número de WhatsApp')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('') // Clear success message on resend

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

      // Iniciar contador regressivo
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)

    } catch (err: any) { // Added type annotation
      console.error('Erro ao enviar código:', err)
      setError(err.message || 'Falha ao enviar código de verificação')
    } finally {
      setLoading(false)
    }
  }

  // Verificar código e fazer login using NextAuth signIn
  const verificarCodigo = async () => {
    if (!verificationCode) {
      setError('Por favor, informe o código de verificação')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('') // Clear success message

      // Use NextAuth signIn instead of fetch
      const result = await signIn("phone-otp", {
        redirect: false, // Handle redirect manually based on result
        phone: phone,
        code: verificationCode,
        countryCode: countryCode, // Pass countryCode if needed by your provider
      });

      if (result?.error) {
        console.error("NextAuth OTP Sign-in failed:", result.error);
        // Use the error message from NextAuth (which comes from the authorize function)
        setError(result.error || "Falha no login. Verifique o código ou tente novamente.");
      } else if (result?.ok && !result.error) {
        console.log("NextAuth OTP Sign-in successful, redirecting...");
        // Login bem-sucedido, redirecionar para o dashboard
        router.push('/motorista/dashboard');
        // No need to set success message here as we are redirecting
      } else {
        // Handle unexpected result
        console.error("Unexpected OTP sign-in result:", result);
        setError("Ocorreu um erro inesperado durante o login.");
      }

    } catch (err: any) { // Catch any unexpected errors during the signIn call itself
      console.error('Erro ao verificar código via NextAuth:', err)
      setError(err.message || 'Falha ao verificar código')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="mb-6 text-center">
          <Link href="/" className="text-3xl font-bold text-gray-900">
            Pixter
          </Link>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Login de Motorista</h2>
          <p className="mt-2 text-sm text-gray-600">
            Acesse sua conta usando seu número de WhatsApp
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
            {success}
          </div>
        )}

        <div className="space-y-6">
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
                disabled={codeSent} // Disable phone input after code is sent
                className={`flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${codeSent ? 'bg-gray-100' : ''}`}
                placeholder="11 98765-4321"
              />
            </div>
          </div>

          {!codeSent ? (
            <button
              type="button"
              onClick={enviarCodigoVerificacao}
              disabled={loading || !phone}
              className={`w-full bg-purple-600 text-white py-3 px-4 rounded-md font-medium transition ${
                loading || !phone ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'
              }`}
            >
              {loading ? 'Enviando...' : 'Enviar código de verificação'}
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="codigo" className="block text-sm font-medium text-gray-700 mb-1">
                  Código de verificação
                </label>
                <input
                  id="codigo"
                  name="codigo"
                  type="text"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Digite o código recebido"
                />
              </div>

              <button
                type="button"
                onClick={verificarCodigo} // This now calls the NextAuth signIn logic
                disabled={loading || !verificationCode}
                className={`w-full bg-purple-600 text-white py-3 px-4 rounded-md font-medium transition ${
                  loading || !verificationCode ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'
                }`}
              >
                {loading ? 'Verificando...' : 'Entrar'}
              </button>

              {countdown > 0 ? (
                <p className="text-sm text-gray-500 text-center">
                  Reenviar código em {countdown}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={enviarCodigoVerificacao}
                  disabled={loading}
                  className="w-full text-sm text-purple-600 hover:text-purple-800"
                >
                  Reenviar código
                </button>
              )}
            </div>
          )}

          <div className="text-center text-sm text-gray-500">
            Não tem uma conta? <Link href="/motorista/cadastro" className="text-purple-600 hover:text-purple-800">Cadastre-se aqui</Link>
          </div>

          <div className="text-center text-sm text-gray-500">
            É um cliente? <Link href="/login" className="text-purple-600 hover:text-purple-800">Acesse aqui</Link>
          </div>
        </div>
      </div>
    </main>
  )
}

