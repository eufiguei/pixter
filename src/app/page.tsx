'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Header Removed - Handled by Root Layout NavBar */}
      {/* 
      <header className="bg-white py-4 shadow-sm">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-black flex items-center">
              <div className="w-10 h-10 bg-purple-700 rounded-md flex items-center justify-center mr-2">
                <span className="text-white font-bold">P</span>
              </div>
              Pixter
            </Link>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/login" className="text-gray-700 hover:text-purple-700">Acessar Conta</Link>
            <Link href="/motorista/login" className="text-gray-700 hover:text-purple-700">Acessar Motoristas/Vendedores</Link>
          </nav>
        </div>
      </header>
      */}

      {/* Hero Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Receba Pagamentos em QR Code, Sem Maquininha.
              </h1>
              <p className="text-lg text-gray-700 mb-8">
                Com o Pixter, motoristas, feirantes e vendedores aceitam Pix, Cartão de Crédito e Apple Pay direto pelo celular. Rápido, seguro e sem mensalidade.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Link 
                  href="/motorista/cadastro" 
                  className="bg-purple-600 text-white py-3 px-6 rounded-md font-medium hover:bg-purple-700 transition text-center"
                >
                  Criar Conta Gratuita
                </Link>
              </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <div className="relative w-full max-w-md">
                <Image 
                  src="/images/homepage/driver.png" 
                  alt="Motorista usando Pixter"
                  width={500}
                  height={400}
                  unoptimized
                  className="w-full h-auto rounded-lg "
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">Como Funciona</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Crie sua conta Pixter</h3>
              <p className="text-gray-600">Cadastro rápido e gratuito</p>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Compartilhe seu QR Code</h3>
              <p className="text-gray-600">Seu cliente escaneia, digita o valor e já paga via Pix, Cartão ou Apple Pay</p>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Receba automaticamente</h3>
              <p className="text-gray-600">O valor cai direto na sua conta bancária, conectado ao Stripe com taxa reduzida de apenas 3%</p>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-8">Feito para quem vende na rua, na feira, ou dirige pelas cidades.</h2>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto mb-10">
            Pixter é a solução ideal para motoristas de táxi, vendedores de feira, ambulantes e pequenos negócios que precisam aceitar pagamentos de forma moderna, sem complicação, e sem precisar investir em maquininhas.
          </p>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Segurança de nível Stripe</h2>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto mb-10">
            Todos os pagamentos pelo Pixter são processados com a tecnologia da Stripe, líder global em pagamentos online. Proteção total dos dados e criptografia de ponta a ponta.
          </p>
          
          <div className="flex justify-center items-center space-x-8 mt-8">
            <Image src="/images/logos/stripe.png" alt="Stripe" width={80} height={30} unoptimized />
            <Image src="/images/logos/pix.png" alt="Pix" width={60} height={30} unoptimized />
            <Image src="/images/logos/apple-pay.png" alt="Apple Pay" width={60} height={30} unoptimized />
            <Image src="/images/logos/visa.png" alt="Visa" width={60} height={30} unoptimized />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-100">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-gray-600">Pixter © 2025 · Todos os direitos reservados.</p>
            </div>
            <div>
              <Link href="/suporte" className="text-sm text-gray-600 hover:text-purple-600 ml-4">Suporte</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  ) 
}
