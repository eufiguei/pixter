'use client'

import Link from 'next/link'
import { useState } from 'react'
import Image from 'next/image'

export default function DashboardMotorista() {
  // Estados existentes...
  const [currentAvatar, setCurrentAvatar] = useState(0) // Índice do avatar atual
  const [showAvatarSelection, setShowAvatarSelection] = useState(false)
  
  // Array com os caminhos para as imagens dos avatares
  const avatars = Array.from({ length: 9 }, (_, i) => `/images/avatars/avatar_${i + 1}.png`)
  
  // Função para mudar o avatar
  const handleAvatarChange = (index: number) => {
    setCurrentAvatar(index)
  }
  
  // Função para salvar a mudança de avatar
  const saveAvatarChange = () => {
    // Implementação futura: salvar no Supabase
    console.log('Avatar alterado para:', currentAvatar)
    setShowAvatarSelection(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <Link href="/" className="text-2xl font-bold text-black flex items-center">
            <div className="w-10 h-10 bg-purple-700 rounded-md flex items-center justify-center mr-2">
              <span className="text-white font-bold">P</span>
            </div>
            Pixter
          </Link>
        </header>
        
        <h1 className="text-4xl font-bold mb-10">Olá, João!</h1>
        
        {/* Conteúdo existente do dashboard... */}
        
        {/* Seção Meus Dados */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6">Meus Dados</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <p className="mb-2 font-medium">Nome</p>
              <p className="text-gray-700 mb-4">João</p>
              
              <p className="mb-2 font-medium">Email</p>
              <p className="text-gray-700 mb-4">joao@exemplo.com</p>
              
              <p className="mb-2 font-medium">Telefone</p>
              <p className="text-gray-700 mb-4">+55 11 98769-4321</p>
              
              <p className="mb-2 font-medium">Conta Bancária/Pix</p>
              <p className="text-gray-700 mb-4">Cadastrada</p>
              
              <button
                className="bg-purple-600 text-white py-2 px-4 rounded-md font-medium hover:bg-purple-700 transition"
              >
                Atualizar informações
              </button>
            </div>
            
            <div>
              <p className="mb-2 font-medium">Seu Avatar</p>
              <div className="flex items-center mb-4">
                <div className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden mr-4">
                  <Image 
                    src={avatars[currentAvatar]} 
                    alt="Seu avatar" 
                    width={96} 
                    height={96}
                    unoptimized
                    className="w-full h-auto"
                  />
                </div>
                <button
                  onClick={() => setShowAvatarSelection(!showAvatarSelection)}
                  className="bg-gray-200 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-300 transition"
                >
                  Alterar avatar
                </button>
              </div>
              
              {showAvatarSelection && (
                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-4">Escolha seu novo avatar</h3>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {avatars.map((avatar, index) => (
                      <div 
                        key={index}
                        onClick={() => handleAvatarChange(index)}
                        className={`
                          cursor-pointer rounded-lg overflow-hidden border-4 p-1 transition-all
                          ${currentAvatar === index ? 'border-purple-600 bg-purple-50' : 'border-gray-200'}
                        `}
                      >
                        <Image 
                          src={avatar} 
                          alt={`Avatar ${index + 1}`} 
                          width={80} 
                          height={80}
                          unoptimized
                          className="w-full h-auto"
                        />
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={saveAvatarChange}
                    className="mt-4 bg-purple-600 text-white py-2 px-4 rounded-md font-medium hover:bg-purple-700 transition"
                  >
                    Salvar alteração
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
        
        {/* Resto do conteúdo existente... */}
      </div>
    </main>
  )
}
