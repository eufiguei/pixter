'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function CadastroMotorista() {
  const router = useRouter()
  
  // Estados para as etapas do cadastro
  const [step, setStep] = useState('phone') // 'phone', 'verify', 'details'
  
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
  
  // Caminhos dos avatares - usando URLs absolutas para garantir que funcionem em produção
  const avatars = [
    '/images/avatars/avatar_1.png',
    '/images/avatars/avatar_2.png',
    '/images/avatars/avatar_3.png',
    '/images/avatars/avatar_4.png',
    '/images/avatars/avatar_5.png',
    '/images/avatars/avatar_6.png',
    '/images/avatars/avatar_7.png',
    '/images/avatars/avatar_8.png',
    '/images/avatars/avatar_9.png'
  ]
  
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
  
  // Limpar recursos da câmera quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])
  
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
      
    } catch (err: any) {
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
      
      // Avança para a próxima etapa
      setStep('details')
      setSuccess('Telefone verificado com sucesso!')
      
    } catch (err: any) {
      console.error('Erro ao verificar código:', err)
      setError(err.message || 'Falha ao verificar código')
    } finally {
      setLoading(false)
    }
  }

  // Funções de câmera
  const iniciarCamera = async () => {
    try {
      // Parar qualquer stream anterior
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      
      console.log('Solicitando acesso à câmera...')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } 
      })
      
      streamRef.current = stream
      
      if (videoRef.current) {
        console.log('Atribuindo stream ao elemento de vídeo...')
        videoRef.current.srcObject = stream
        
        // Garantir que o vídeo seja exibido corretamente
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log('Vídeo iniciado com sucesso')
                setCameraAtiva(true)
              })
              .catch(err => {
                console.error('Erro ao iniciar vídeo:', err)
                setError('Erro ao iniciar câmera. Tente novamente.')
              })
          }
        }
      } else {
        console.error('Elemento de vídeo não encontrado')
        setError('Erro ao iniciar câmera. Elemento de vídeo não encontrado.')
      }
    } catch (err) {
      console.error('Erro ao acessar a câmera:', err)
      setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.')
    }
  }

  const capturarSelfie = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Erro ao capturar selfie. Tente novamente.')
      return
    }
    
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      
      // Definir dimensões do canvas para corresponder ao vídeo
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Não foi possível obter o contexto do canvas')
      }
      
      // Desenhar o frame atual do vídeo no canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      // Obter a imagem como data URL
      const selfieDataUrl = canvas.toDataURL('image/jpeg', 0.8)
      
      // Verificar se a imagem não está vazia
      if (selfieDataUrl === 'data:,') {
        throw new Error('Não foi possível capturar a imagem')
      }
      
      setSelfiePreview(selfieDataUrl)
      setSelfieCapturada(true)
      
      // Parar a câmera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      
      setCameraAtiva(false)
      
      // Mostrar seleção de avatar
      setShowAvatarSelection(true)
    } catch (err: any) {
      console.error('Erro ao capturar selfie:', err)
      setError('Erro ao capturar selfie. Tente novamente.')
    }
  }

  const reiniciarCamera = () => {
    setSelfieCapturada(false)
    setSelfiePreview(null)
    setShowAvatarSelection(false)
    iniciarCamera()
  }

  const handleAvatarSelect = (index: number) => {
    setSelectedAvatar(index)
  }
  
  // Função para converter dataURL para Blob
  const dataURLtoBlob = (dataURL: string) => {
    const arr = dataURL.split(',')
    if (arr.length < 2) {
      throw new Error('DataURL inválido')
    }
    
    const mimeMatch = arr[0].match(/:(.*?);/)
    if (!mimeMatch) {
      throw new Error('Formato MIME não encontrado')
    }
    
    const mime = mimeMatch[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  }

  // Envio final do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    // Validações
    if (!nomeCompleto) {
      setError('Nome completo é obrigatório')
      setLoading(false)
      return
    }
    
    if (!cpf) {
      setError('CPF é obrigatório')
      setLoading(false)
      return
    }
    
    if (!dataNascimento) {
      setError('Data de nascimento é obrigatória')
      setLoading(false)
      return
    }
    
    if (!selfieCapturada) {
      setError('É necessário capturar uma selfie')
      setLoading(false)
      return
    }
    
    if (!aceitaTermos) {
      setError('Você precisa aceitar os termos de uso e política de privacidade')
      setLoading(false)
      return
    }
    
    try {
      // Preparar FormData para envio
      const formData = new FormData()
      formData.append('phone', phone)
      formData.append('countryCode', countryCode)
      formData.append('nome', nomeCompleto)
      formData.append('profissao', profissao)
      formData.append('dataNascimento', dataNascimento)
      formData.append('cpf', cpf)
      
      if (email) {
        formData.append('email', email)
      }
      
      formData.append('avatarIndex', selectedAvatar.toString())
      
      // Adicionar selfie se capturada
      if (selfiePreview) {
        try {
          const selfieBlob = dataURLtoBlob(selfiePreview)
          formData.append('selfie', new File([selfieBlob], 'selfie.jpg', { type: 'image/jpeg' }))
        } catch (err) {
          console.error('Erro ao processar selfie:', err)
          setError('Erro ao processar selfie. Tente capturar novamente.')
          setLoading(false)
          return
        }
      }
      
      // Enviar dados para API
      const response = await fetch('/api/auth/complete-registration', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao finalizar cadastro')
      }
      
      // Redirecionar para o dashboard do motorista
      router.push('/motorista/dashboard')
    } catch (err: any) {
      console.error('Erro no cadastro:', err)
      setError(err.message || 'Falha ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Renderização condicional baseada na etapa atual
  const renderStepContent = () => {
    switch (step) {
      case 'phone':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Cadastro de Motorista</h2>
            <p className="text-center text-gray-600">
              Informe seu número de WhatsApp para começar
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
              {loading ? 'Enviando...' : 'Enviar código de verificação'}
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
                    {loading ? 'Verificando...' : 'Verificar'}
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
              Já tem uma conta? <Link href="/motorista/login" className="text-purple-600 hover:text-purple-800">Acesse aqui</Link>
            </div>
          </div>
        );
        
      case 'details':
        return (
          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Complete seu cadastro</h2>
            
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
            
            <div className="space-y-4">
              <div>
                <label htmlFor="nomeCompleto" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome completo
                </label>
                <input
                  id="nomeCompleto"
                  name="nomeCompleto"
                  type="text"
                  autoComplete="name"
                  required
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email (opcional)
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">
                  CPF
                </label>
                <input
                  id="cpf"
                  name="cpf"
                  type="text"
                  autoComplete="off"
                  required
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="000.000.000-00"
                />
              </div>
              
              <div>
                <label htmlFor="profissao" className="block text-sm font-medium text-gray-700 mb-1">
                  Profissão
                </label>
                <input
                  id="profissao"
                  name="profissao"
                  type="text"
                  required
                  value={profissao}
                  onChange={(e) => setProfissao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label htmlFor="dataNascimento" className="block text-sm font-medium text-gray-700 mb-1">
                  Data de nascimento
                </label>
                <input
                  id="dataNascimento"
                  name="dataNascimento"
                  type="date"
                  required
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Selfie e Avatar</h3>
              
              {!selfieCapturada ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Precisamos de uma selfie para verificar sua identidade
                  </p>
                  
                  {!cameraAtiva ? (
                    <button
                      type="button"
                      onClick={iniciarCamera}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700"
                    >
                      Iniciar câmera
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative w-full h-64 bg-gray-100 rounded-md overflow-hidden">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                      
                      <button
                        type="button"
                        onClick={capturarSelfie}
                        className="w-full bg-green-600 text-white py-2 px-4 rounded-md font-medium hover:bg-green-700"
                      >
                        Capturar selfie
                      </button>
                    </div>
                  )}
                  
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="relative w-48 h-48 bg-gray-100 rounded-full overflow-hidden">
                      {selfiePreview && (
                        <img
                          src={selfiePreview}
                          alt="Selfie"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={reiniciarCamera}
                    className="w-full bg-gray-600 text-white py-2 px-4 rounded-md font-medium hover:bg-gray-700"
                  >
                    Tirar nova selfie
                  </button>
                </div>
              )}
              
              {showAvatarSelection && (
                <div className="space-y-4">
                  <h4 className="text-md font-medium">Escolha seu avatar</h4>
                  <p className="text-sm text-gray-600">
                    Este avatar será exibido na sua página de pagamento
                  </p>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {avatars.map((avatar, index) => (
                      <div
                        key={index}
                        onClick={() => handleAvatarSelect(index)}
                        className={`relative rounded-full overflow-hidden border-4 cursor-pointer ${
                          selectedAvatar === index ? 'border-purple-500' : 'border-transparent'
                        }`}
                      >
                        <img
                          src={avatar}
                          alt={`Avatar ${index + 1}`}
                          className="w-full h-auto"
                          onError={(e) => {
                            console.error(`Erro ao carregar avatar ${index + 1}:`, e);
                            const target = e.target as HTMLImageElement;
                            target.src = '/images/avatar-placeholder.png'; // Imagem de fallback
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-start">
              <input
                id="aceitaTermos"
                name="aceitaTermos"
                type="checkbox"
                checked={aceitaTermos}
                onChange={(e) => setAceitaTermos(e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded mt-1"
                required
              />
              <label htmlFor="aceitaTermos" className="ml-2 block text-sm text-gray-700">
                Aceito os <a href="/termos" className="text-purple-600 hover:text-purple-800">Termos de Uso</a> e a <a href="/privacidade" className="text-purple-600 hover:text-purple-800">Política de Privacidade</a>
              </label>
            </div>
            
            <button
              type="submit"
              disabled={loading || !aceitaTermos || !selfieCapturada}
              className={`w-full bg-purple-600 text-white py-3 px-4 rounded-md font-medium transition ${
                loading || !aceitaTermos || !selfieCapturada ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'
              }`}
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>
        );
        
      default:
        return null;
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        {renderStepContent()}
      </div>
    </main>
  )
}
