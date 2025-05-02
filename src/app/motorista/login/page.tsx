// src/app/motorista/login/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import OtpInput from '@/components/OtpInput'  // ← fixed import

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

  // 1) send SMS OTP
  const enviarCodigoVerificacao = async () => {
    if (!phone) {
      setError('Por favor, informe seu número de WhatsApp')
      return
    }
    try {
      setLoading(true); setError(''); setSuccess('')
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, countryCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar código')
      setCodeSent(true)
      setCountdown(60)
      setSuccess('Código enviado! Verifique seu WhatsApp.')

      // start countdown
      const timer = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(timer)
            return 0
          }
          return c - 1
        })
      }, 1000)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Falha ao enviar código')
    } finally {
      setLoading(false)
    }
  }

  // 2) verify OTP with NextAuth
  const verificarCodigo = async () => {
    if (verificationCode.length < 6) {
      setError('Por favor, insira o código completo')
      return
    }
    try {
      setLoading(true); setError(''); setSuccess('')
      const result = await signIn('phone-otp', {
        redirect: false,
        phone,
        code: verificationCode,
        countryCode,
      })
      if (result?.error) {
        setError(result.error)
      } else {
        router.push('/motorista/dashboard')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao verificar código')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <div className="text-center mb-6">
          <Link href="/" className="text-3xl font-bold">Pixter</Link>
          <h2 className="mt-4 text-2xl">Login de Motorista</h2>
          <p className="text-sm text-gray-600">Use seu WhatsApp para entrar</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded mb-4">
            {success}
          </div>
        )}

        {!codeSent ? (
          <>
            <label className="block text-sm font-medium text-gray-700">WhatsApp (com DDD)</label>
            <div className="flex mb-4">
              <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l">
                +{countryCode}
              </span>
              <input
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                disabled={loading}
                placeholder="11 98765-4321"
                className={`flex-1 border border-gray-300 rounded-r px-3 ${
                  loading ? 'bg-gray-100' : ''
                }`}
              />
            </div>
            <button
              onClick={enviarCodigoVerificacao}
              disabled={loading || !phone}
              className={`w-full py-2 rounded text-white ${
                loading || !phone
                  ? 'bg-purple-300 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {loading ? 'Enviando…' : 'Enviar código'}
            </button>
          </>
        ) : (
          <>
            <p className="text-center text-gray-700 mb-2">
              Insira o código de 6 dígitos que enviamos
            </p>
            <OtpInput
              length={6}
              onComplete={code => setVerificationCode(code)}
            />
            <button
              onClick={verificarCodigo}
              disabled={loading || verificationCode.length < 6}
              className={`w-full mt-4 py-2 rounded text-white ${
                loading || verificationCode.length < 6
                  ? 'bg-purple-300 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {loading ? 'Verificando…' : 'Entrar'}
            </button>

            {countdown > 0 ? (
              <p className="text-sm text-gray-500 mt-3 text-center">
                Reenviar em {countdown}s
              </p>
            ) : (
              <button
                onClick={enviarCodigoVerificacao}
                disabled={loading}
                className="mt-3 text-sm text-purple-600 hover:underline"
              >
                Reenviar código
              </button>
            )}
          </>
        )}

        <div className="mt-6 text-center text-sm text-gray-500">
          Não tem conta?{' '}
          <Link href="/motorista/cadastro" className="text-purple-600 hover:underline">
            Cadastre-se
          </Link>
        </div>
      </div>
    </main>
  )
}
