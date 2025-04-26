'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import Image from 'next/image'

export default function CadastroMotorista() {
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [celular, setCelular] = useState('')
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [aceitaTermos, setAceitaTermos] = useState(false)
  const [selfieCapturada, setSelfieCapturada] = useState(false)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [showAvatarSelection, setShowAvatarSelection] = useState(true)

  // Array com os caminhos para as imagens dos avatares
  const avatars = Array.from({ length: 9 }, (_, i) => `/images/avatars/avatar_${i + 1}.png`)

  const iniciarCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraAtiva(true)
      }
    } catch (err) {
      console.error('Erro ao acessar a câmera:', err)
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
        const stream = video.srcObject as MediaStream
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
        }
        setCameraAtiva(false)
      }
    }
  }

  const reiniciarCamera = () => {
    setSelfieCapturada(false)
    setSelfiePreview(null)
    setSelectedAvatar(null)
    iniciarCamera()
  }

  // Função para selecionar um avatar
  const handleAvatarSelect = (index: number) => {
    setSelectedAvatar(index)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Implementação futura: integração com Supabase e Stripe Connect
    console.log('Cadastro de motorista:', {
      nomeCompleto,
      email,
      celular,
      cpf,
      senha,
      selfieCapturada,
      selectedAvatar
    })
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="flex justify-center mb-8">
          <Link href="/" className="text-2xl font-bold text-black flex items-center">
            <div className="w-10 h-10 bg-purple-700 rounded-md flex items-center justify-center mr-2">
              <span className="text-white font-bold">P</span>
            </div>
            Pixter
          </Link>
        </div>
        
        <h2 className="text-3xl font-bold text-center mb-2">Comece a receber pagamentos agora.</h2>
        <p className="text-center text-gray-600 mb-8">
          Crie sua conta gratuita para gerar seu QR Code e aceitar Pix, Cartão de Crédito e Apple Pay em segundos.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
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
              <label htmlFor="celular" className="block text-sm font-medium text-gray-700 mb-1">
                Celular (WhatsApp)
              </label>
              <input
                id="celular"
                name="celular"
                type="tel"
                autoComplete="tel"
                required
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
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
            {/* Seção de seleção de avatar - agora vem ANTES da selfie */}
            <div className="mb-10">
              <h3 className="text-lg font-medium mb-4">Escolha seu avatar</h3>
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
            
            {/* Seção da selfie - agora vem DEPOIS da seleção de avatar */}
            <h3 className="text-lg font-medium mb-4">Tire uma selfie para concluir seu cadastro</h3>
            <p className="text-sm text-gray-600 mb-4">
              Sua selfie será armazenada com segurança.
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
              disabled={!aceitaTermos || selectedAvatar === null}
              className={`w-full py-3 px-4 rounded-md font-medium transition ${
                aceitaTermos && selectedAvatar !== null
                  ? 'bg-purple-600 text-white hover:bg-purple-700' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Criar Conta
            </button>
          </div>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Já tem conta? <Link href="/motorista/login" className="text-purple-600 hover:text-purple-800 font-medium">Acesse aqui</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
