// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

import { AuthProvider } from '@/lib/auth/session'
import NavBar from '@/components/NavBar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Pixter - Pagamento rápido para motoristas',
  description:
    'Receba pagamentos via QR code sem maquininha. Pix, Apple Pay e cartão de crédito.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {/* Contexto de autenticação */}
        <AuthProvider>
          {/* Barra de navegação com logo P + dropdown */}
          <NavBar />

          {/* Conteúdo das rotas */}
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}