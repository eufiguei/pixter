// /src/app/motorista/cadastro/page.tsx (versão modificada)
'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function CadastroMotorista() {
  const router = useRouter()
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [celular, setCelular] = useState('')
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [aceitaTermos, setAceitaTermos] = useState(false)
  const [selfieCapturada, setSelfieCapturada] = useState(false)
  const [selfiePreview, setSelfiePreview] = useState(null)
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [showAvatarSelection, setShowAvatarSelection] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Novas variáveis para verificação por SMS
  const [step, setStep] = useState('phone') // 'phone', 'verify', 'details'
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  
  const avatars = Array.from({ length: 9 }, (_, i) => `/images/avatars/avatar_${i + 1}.png`)
  
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
    if (!celular) {
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
          phone: celular,
          countryCode: '55' // Brasil
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar código de verificação')
      }
      
      setCodeSent(true)
      setCountdown(60) // 60 segundos para reenvio
      
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
          phone: celular,
          code: verificationCode
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Código inválido ou expirado')
      }
      
      // Avança para a próxima etapa
      setStep('details')
      
    } catch (err) {
      console.error('Erro ao verificar código:', err)
      setError(err.message || 'Falha ao verificar código')
    } finally {
      setLoading(false)
    }
  }

  // Funções de câmera (mantidas do código original)
  const iniciarCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraAtiva(true)
      }
    } catch (err) {
      console.error('Erro ao acessar a câmera:', err)
      setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.')
    }
  }

  const capturarSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        const selfieDataUrl = canvas.toDataURL('image/png')
        setSelfiePreview(selfieDataUrl)
        setSelfieCapturada(true)
        
        // Parar a câmera
        const stream = video.srcObject
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
        }
        setCameraAtiva(false)
        
        // Mostrar seleção de avatar
        setShowAvatarSelection(true)
      }
    }
  }

  const reiniciarCamera = () => {
    setSelfieCapturada(false)
    setSelfiePreview(null)
    setShowAvatarSelection(false)
    setSelectedAvatar(null)
    iniciarCamera()
  }

  const handleAvatarSelect = (index) => {
    setSelectedAvatar(index)
  }
  
  // Função para converter dataURL para Blob
  const dataURLtoBlob = (dataURL) => {
    const arr = dataURL.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  }

  // Envio final do formulário
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    // Validações
    if (!nomeCompleto) {
      setError('Nome completo é obrigatório')
      setLoading(false)
      return
    }
    
    if (senha !== confirmarSenha) {
      setError('As senhas não coincidem')
      setLoading(false)
      return
    }
    
    if (!selfieCapturada || selectedAvatar === null) {
      setError('É necessário capturar uma selfie e selecionar um avatar')
      setLoading(false)
      return
    }
    
    if (!aceitaTermos) {
      setError('Você precisa aceitar os termos de uso e política de privacidade')
      setLoading(false)
      return
    }
    
    try {
      // Dados do motorista para o cadastro
      const userData = {
        nome: nomeCompleto,
        email: email || null, // Email é opcional agora
        celular,
        cpf,
        tipo: 'motorista',
        avatarIndex: selectedAvatar
      }
      
      // Finaliza o cadastro com os dados completos
      const response = await fetch('/api/auth/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: celular,
          userData,
          password: senha // Opcional, pode ser usado para login por email também
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao finalizar cadastro')
      }
      
      // Upload da selfie se o cadastro for bem-sucedido
      if (data.userId && selfiePreview) {
        const userId = data.userId
        const selfieBlob = dataURLtoBlob(selfiePreview)
        const selfieFile = new File([selfieBlob], `selfie-${userId}.png`, { type: 'image/png' })
        
        const formData = new FormData()
        formData.append('file', selfieFile)
        formData.append('userId', userId)
        
        const uploadResponse = await fetch('/api/upload/selfie', {
          method: 'POST',
          body: formData
        })
        
        if (!uploadResponse.ok) {
          console.error('Erro ao fazer upload da selfie, mas continuando...')
        }
      }
      
      // Redirecionar para o dashboard do motorista
      router.push('/motorista/dashboard')
    } catch (err) {
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
                  +55
                </span>
                <input
                  id="celular"
                  name="celular"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="11 98765-4321"
                />
              </div>
            </div>
            
            <button
              type="button"
              onClick={enviarCodigoVerificacao}
              disabled={loading || !celular}
              className={`w-full bg-purple-600 text-white py-3 px-4 rounded-md font-medium transition ${
                loading || !celular ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'
              }`}
            >
              {loading ? 'Enviando...' : 'Enviar código de verificação'}
            </button>
            
            {codeSent && (
              <div className="mt-4">
                <p className="text-sm text-green-600 mb-2">
                  Código enviado com sucesso! Verifique seu WhatsApp.
                </p>
                
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
          </div>
        );
        
      case 'details':
        return (
          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Complete seu cadastro</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  required
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1">
                  Criar Senha
                </label>
                <input
                  id="senha"
                  name="senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label htmlFor="confirmarSenha" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Senha
                </label>
                <input
                  id="confirmarSenha"
                  name="confirmarSenha"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4">Tire uma selfie para concluir seu cadastro, e escolha abaixo qual seu avatar</h3>
              <p className="text-sm text-gray-600 mb-4">
                Sua selfie será armazenada com segurança e usada para personalizar sua experiência.
              </p>
              
              <div className="flex flex-col items-center">
                {!selfieCapturada ? (
                  <>
                    <div className="w-64 h-64 bg-gray-200 rounded-lg overflow-hidden mb-4 relative">
                      {cameraAtiva ? (
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-gray-500">Câmera desativada</span>
                        </div>
                      )}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {cameraAtiva ? (
                      <button
                        type="button"
                        onClick={capturarSelfie}
                        className="bg-purple-600 text-white py-2 px-4 rounded-md font-medium hover:bg-purple-700 transition"
                      >
                        Capturar Selfie
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={iniciarCamera}
                        className="bg-purple-600 text-white py-2 px-4 rounded-md font-medium hover:bg-purple-700 transition"
                      >
                        Ativar Câmera
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-64 h-64 bg-gray-200 rounded-lg overflow-hidden mb-4">
                      {selfiePreview && (
                        <img 
                          src={selfiePreview} 
                          alt="Selfie capturada" 
                          className="w-full h-full object-cover" 
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={reiniciarCamera}
                      className="bg-gray-600 text-white py-2 px-4 rounded-md font-medium hover:bg-gray-700 transition mb-4"
                    >
                      Tirar outra selfie
                    </button>
                  </>
                )}
              </div>
              
              {showAvatarSelection && (
                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-4">Escolha seu avatar estilo Ghibli</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Este avatar será exibido na sua página de pagamento para os clientes.
                  </p>
                  
                  <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                    {avatars.map((avatar, index) => (
                      <div 
                        key={index}
                        onClick={() => handleAvatarSelect(index)}
                        className={`
                          cursor-pointer rounded-lg overflow-hidden border-4 p-2 transition-all transform hover:scale-105
                          ${selectedAvatar === index ? 'border-purple-600 bg-purple-50 scale-105' : 'border-gray-200'}
                        `}
                      >
                        <Image 
                          src={avatar} 
                          alt={`Avatar ${index + 1}`} 
                          width={120} 
                          height={120}
                          unoptimized
                          className="w-full h-auto"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-start mt-6">
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
                Aceito os <Link href="/termos-de-uso" className="text-purple-600 hover:text-purple-800">Termos de Uso</Link> e a <Link href="/privacidade" className="text-purple-600 hover:text-purple-800">Política de Privacidade</Link>
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || !selfieCapturada || !aceitaTermos || selectedAvatar === null}
                className={`w-full py-3 px-4 rounded-md font-medium transition ${
                  loading ? 'opacity-70 cursor-not-allowed bg-purple-600 text-white' :
                  selfieCapturada && aceitaTermos && selectedAvatar !== null
                    ? 'bg-purple-600 text-white hover:bg-purple-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {loading ? 'Criando conta...' : 'Criar Conta'}
              </button>
            </div>
          </form>
        );
        
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <div className="flex justify-center mb-8">
          <Link href="/" className="text-2xl font-bold text-black flex items-center">
            <div className="w-10 h-10 bg-purple-700 rounded-md flex items-center justify-center mr-2">
              <span className="text-white font-bold">P</span>
            </div>
            Pixter
          </Link>
        </div>
        
        {renderStepContent()}
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Já tem conta? <Link href="/motorista/login" className="text-purple-600 hover:text-purple-800 font-medium">Acesse aqui</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
