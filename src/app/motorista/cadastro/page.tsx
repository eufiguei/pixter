'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function CadastroMotorista() {
  const router = useRouter()

  /* ---------------------------- Estados de tela --------------------------- */
  const [step, setStep] = useState<'phone' | 'verify' | 'details'>('phone')

  /* --------------------- Estados – verificação de telefone ---------------- */
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('55')
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)

  /* ----------------------- Estados – dados pessoais ----------------------- */
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [profissao, setProfissao] = useState('Motorista de táxi')
  const [dataNascimento, setDataNascimento] = useState('')
  const [aceitaTermos, setAceitaTermos] = useState(false)

  /* ----------------------- Estados – selfie / avatar ---------------------- */
  const [selfieCapturada, setSelfieCapturada] = useState(false)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState(0)
  const [showAvatarSelection, setShowAvatarSelection] = useState(false)
  const [cameraAtiva, setCameraAtiva] = useState(false)

  /* ---------------------------------- UI --------------------------------- */
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  /* --------------------------------- Refs -------------------------------- */
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  /* ------------------------------ Avatares ------------------------------- */
  const avatars = Array.from({ length: 9 }, (_, i) => `/images/avatars/avatar_${i + 1}.png`)

  /* ------------------------- Contador do código -------------------------- */
  useEffect(() => {
    if (countdown === 0) return
    const timer = setInterval(() => setCountdown((c) => (c <= 1 ? 0 : c - 1)), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  /* ----------------- Limpa a câmera quando o comp. desmonta --------------- */
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  /* -------------------------------- Camera ------------------------------- */
  const iniciarCamera = async () => {
    setCameraAtiva(true) // garante que o <video> será renderizado
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => videoRef.current?.play()
      }
    } catch (err) {
      console.error(err)
      setError('Não foi possível acessar a câmera. Verifique permissões.')
      setCameraAtiva(false)
    }
  }

  const capturarSelfie = () => {
    if (!videoRef.current || !canvasRef.current) return setError('Elemento de vídeo não encontrado')
    const { videoWidth: w, videoHeight: h } = videoRef.current
    canvasRef.current.width = w
    canvasRef.current.height = h
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return setError('Canvas context inexistente')
    ctx.drawImage(videoRef.current, 0, 0, w, h)
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8)
    if (dataUrl === 'data:,') return setError('Falha ao capturar imagem')
    setSelfiePreview(dataUrl)
    setSelfieCapturada(true)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraAtiva(false)
    setShowAvatarSelection(true)
  }

  const reiniciarCamera = () => {
    setSelfieCapturada(false)
    setSelfiePreview(null)
    setShowAvatarSelection(false)
    iniciarCamera()
  }

  const handleAvatarSelect = (i: number) => setSelectedAvatar(i)

  /* ---------------------------- renderização ----------------------------- */
  const renderStepContent = () => {
    if (step === 'phone') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">Cadastro de Motorista</h2>
          <p className="text-center text-gray-600">Informe seu número de WhatsApp para começar</p>
          {/* ... inputs de telefone & envio de código (mesmo bloco que funcionava) ... */}
        </div>
      )
    }

    if (step === 'details') {
      return (
        <form /* onSubmit={handleSubmit} */ className="space-y-6">
          <h2 className="text-2xl font-bold text-center">Complete seu cadastro</h2>
          {/* ... campos de detalhes, câmera, avatar ... */}
        </form>
      )
    }

    return null // verify step pode ser incluído depois
  }

  /* ------------------------------- return -------------------------------- */
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        {renderStepContent()}
      </div>
    </main>
  )
}
