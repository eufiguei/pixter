'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function CadastroMotorista() {
  const router = useRouter()

  /* ---------------------------- Estados do fluxo --------------------------- */
  const [step, setStep] = useState<'phone' | 'details'>('phone')

  /* --------------------- Estados – verificação de telefone -----------------*/
  const [phone, setPhone] = useState('')
  const [countryCode] = useState('55')
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)

  /* --------------------- Estados – dados pessoais --------------------------*/
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [profissao, setProfissao] = useState('Motorista de táxi')
  const [dataNascimento, setDataNascimento] = useState('')
  const [aceitaTermos, setAceitaTermos] = useState(false)

  /* --------------------- Estados – selfie / avatar -------------------------*/
  const [selfieCapturada, setSelfieCapturada] = useState(false)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState(0)
  const [showAvatarSelection, setShowAvatarSelection] = useState(false)
  const [cameraAtiva, setCameraAtiva] = useState(false)

  /* --------------------- UI -------------------------*/
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  /* --------------------- refs -----------------------*/
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  /* --------------------- assets ---------------------*/
  const avatars = Array.from({ length: 9 }, (_, i) => `/images/avatars/avatar_${i + 1}.png`)

  /* ---------------- countdown reenviar código ----------------*/
  useEffect(() => {
    if (countdown <= 0) return
    const t = setInterval(() => setCountdown((p) => (p <= 1 ? 0 : p - 1)), 1000)
    return () => clearInterval(t)
  }, [countdown])

  /* ---------------- cleanup camera on unmount --------------*/
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  /* ---------------- Twilio OTP ----------------*/
  const enviarCodigoVerificacao = async () => {
    if (!phone) return setError('Informe seu número de WhatsApp')
    try {
      setLoading(true)
      setError('')
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, countryCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar código')
      setCodeSent(true)
      setCountdown(60)
      setSuccess('Código enviado! Verifique seu WhatsApp.')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const verificarCodigo = async () => {
    if (!verificationCode) return setError('Informe o código')
    try {
      setLoading(true)
      setError('')
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: verificationCode, countryCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Código inválido ou expirado')
      setStep('details')
      setSuccess('Telefone verificado com sucesso!')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  /* ---------------- Camera ----------------*/
  const iniciarCamera = async () => {
    setCameraAtiva(true) // garante render do <video>
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (e) {
      console.error(e)
      setError('Não foi possível acessar a câmera. Verifique permissões.')
      setCameraAtiva(false)
    }
  }

  const capturarSelfie = () => {
    if (!videoRef.current || !canvasRef.current) return setError('Erro ao capturar selfie')
    const v = videoRef.current,
      c = canvasRef.current
    c.width = v.videoWidth || 640
    c.height = v.videoHeight || 480
    const ctx = c.getContext('2d')
    if (!ctx) return setError('Canvas inválido')
    ctx.drawImage(v, 0, 0, c.width, c.height)
    const url = c.toDataURL('image/jpeg', 0.8)
    if (url === 'data:,') return setError('Falha na captura')
    setSelfiePreview(url)
    setSelfieCapturada(true)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setCameraAtiva(false)
    setShowAvatarSelection(true)
  }

  const reiniciarCamera = () => {
    setSelfieCapturada(false)
    setSelfiePreview(null)
    setShowAvatarSelection(false)
    iniciarCamera()
  }

  const dataURLtoBlob = (dataURL: string) => {
    const [header, b64] = dataURL.split(',')
    const mime = /:(.*?);/.exec(header)?.[1] || 'image/jpeg'
    const bin = atob(b64)
    return new Blob([Uint8Array.from(bin, (ch) => ch.charCodeAt(0))], { type: mime })
  }

  /* ---------------- Submit ----------------*/
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // validações omitidas (iguais ao original)
  }

  /* ---------------- Render ----------------*/
  const renderStepContent = () => {
    if (step === 'phone') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">Cadastro de Motorista</h2>
          <p className="text-center text-gray-600">Informe seu número de WhatsApp para começar</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp (com DDD)</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-gray-500">
                +{countryCode}
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11 98765-4321"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{error}</div>}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">{success}</div>
          )}

          <button
            type="button"
            onClick={enviarCodigoVerificacao}
            disabled={loading || !phone}
            className={`w-full bg-purple-600 text-white py-3 px-4 rounded-md font-medium transition ${
