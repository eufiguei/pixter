'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function CadastroMotorista() {
  const router = useRouter()

  // Estados para as etapas do cadastro
  const [step, setStep] = useState<'phone' | 'verify' | 'details'>('phone')

  // Estados para verificação de telefone
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('55')
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Estados para dados do motorista
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [profissao, setProfissao] = useState('Motorista de táxi')
  const [dataNascimento, setDataNascimento] = useState('')
  const [aceitaTermos, setAceitaTermos] = useState(false)

  // Estados para selfie e avatar
  const [selfieCapturada, setSelfieCapturada] = useState(false)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState(0)
  const [showAvatarSelection, setShowAvatarSelection] = useState(false)
  const [cameraAtiva, setCameraAtiva] = useState(false)

  // Estados para UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Caminhos dos avatares (coloque os arquivos em public/images/avatars/)
  const avatars = Array.from({ length: 9 }, (_, i) => `/images/avatars/avatar_${i + 1}.png`)

  /* ------------------------------ Efeitos ------------------------------ */
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // Limpa a câmera ao desmontar
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  /* --------------------------- Funções Twilio -------------------------- */
  const enviarCodigoVerificacao = async () => {
    if (!phone) return setError('Por favor, informe seu número de WhatsApp')
    try {
      setLoading(true)
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, countryCode })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar código')
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
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: verificationCode, countryCode })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Código inválido')
      setStep('details')
      setSuccess('Telefone verificado!')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  /* ---------------------------- Câmera ---------------------------- */
  const iniciarCamera = async () => {
    // garante que o vídeo exista antes de atribuir o stream
    setCameraAtiva(true)
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
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
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return setError('Canvas context inexistente')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    if (dataUrl === 'data:,') return setError('Falha na captura')
    setSelfiePreview(dataUrl)
    setSelfieCapturada(true)
    streamRef.current?.getTracks().forEach(t => t.stop())
    setCameraAtiva(false)
    setShowAvatarSelection(true)
  }

  const reiniciarCamera = () => {
    setSelfieCapturada(false)
    setSelfiePreview(null)
    setShowAvatarSelection(false)
    iniciarCamera()
  }

  /* ------------------- Conversão dataURL -> Blob ------------------- */
  const dataURLtoBlob = (dataURL: string) => {
    const [header, base64] = dataURL.split(',')
    const mime = /:(.*?);/.exec(header)?.[1] || 'image/jpeg'
    const binary = atob(base64)
    const array = Uint8Array.from(binary, c => c.charCodeAt(0))
    return new Blob([array], { type: mime })
  }

  /* --------------------------- Submit final --------------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // …validações mantidas…
    // envio final igual ao seu código original
  }

  /* --------------------- Renderização por etapa --------------------- */
  const renderStepContent = () => {
    // mesmo switch completo (phone / details) do seu código original
    // mantive sem mudanças exceto camera fix
```
