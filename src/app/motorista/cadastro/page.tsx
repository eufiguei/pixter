'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function CadastroMotorista () {
  const router = useRouter()

  /* ---------------------------- Estados de tela --------------------------- */
  const [step, setStep] = useState<'phone' | 'verify' | 'details'>('phone')

  /* --------------------- Estados – verificação de telefone ---------------- */
  const [phone, setPhone]                 = useState('')
  const [countryCode, setCountryCode]     = useState('55')
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent]           = useState(false)
  const [countdown, setCountdown]         = useState(0)

  /* ------------------------- Estados – dados pessoais --------------------- */
  const [nomeCompleto, setNomeCompleto]   = useState('')
  const [email, setEmail]                 = useState('')
  const [cpf, setCpf]                     = useState('')
  const [profissao, setProfissao]         = useState('Motorista de táxi')
  const [dataNascimento, setDataNascimento]= useState('')
  const [aceitaTermos, setAceitaTermos]   = useState(false)

  /* ----------------------- Estados – selfie e avatar ---------------------- */
  const [selfieCapturada, setSelfieCapturada] = useState(false)
  const [selfiePreview, setSelfiePreview]     = useState<string | null>(null)
  const [selectedAvatar, setSelectedAvatar]   = useState(0)
  const [showAvatarSelection, setShowAvatarSelection] = useState(false)
  const [cameraAtiva, setCameraAtiva]         = useState(false)

  /* ------------------------------ UI helper ------------------------------- */
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  /* ---------------------------- Refs câmera ------------------------------- */
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  /* ----------------------- Avatares (pasta public) ------------------------ */
  const avatars = Array.from({ length: 9 }, (_, i) => `/images/avatars/avatar_${i + 1}.png`)

  /* ------------------------------ Efeitos --------------------------------- */
  // countdown reenvio código
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // limpa câmera on‑unmount
  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
  }, [])

  /* ------------------------------------------------------------------------
   * Funções de câmera
   * --------------------------------------------------------------------- */
  const iniciarCamera = async () => {
    /* 1. já marca cameraAtiva=true para o <video> renderizar e ref existir */
    setCameraAtiva(true)
    try {
      // 2. Solicita permissão
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream

      // 3. Garante que temos <video>
      if (!videoRef.current) throw new Error('Elemento de vídeo não encontrado')
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    } catch (err) {
      console.error('Erro ao acessar câmera:', err)
      setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.')
      setCameraAtiva(false)
    }
  }

  const capturarSelfie = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Erro ao capturar selfie. Tente novamente.')
      return
    }
    const canvas = canvasRef.current
    const video  = videoRef.current
    canvas.width = video.videoWidth || 640
    canvas.height= video.videoHeight|| 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return setError('Não foi possível capturar imagem')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const dataURL = canvas.toDataURL('image/jpeg', 0.8)
    if (dataURL === 'data:,') return setError('Falha ao capturar imagem')

    setSelfiePreview(dataURL)
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

  /* ------------------------------------------------------------------------
   *  Restante do código (envio de código, verify, submit etc.) permanece igual
   *  …
   * --------------------------------------------------------------------- */

  /* ------------- Suas funções de enviar/verificar código aqui ------------- */
  // (copie daqui o restante do seu código original, pois só alteramos a parte da câmera)

  /* ------------------------------------------------------------------------ */
  const handleAvatarSelect = (index:number)=> setSelectedAvatar(index)

  /* ---------------------- renderStepContent permanece ---------------------- */
  /*           Cole aqui exatamente o bloco renderStepContent anterior         */

  // return principal
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        {renderStepContent()}
      </div>
    </main>
  )
}
