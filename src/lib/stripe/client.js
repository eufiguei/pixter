import { loadStripe } from '@stripe/stripe-js'
import { Stripe } from 'stripe'

// Inicializa o cliente Stripe para o frontend
export const getStripe = async () => {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
  const stripePromise = loadStripe(publishableKey)
  return stripePromise
}

// Função para criar uma sessão de checkout
export const createCheckoutSession = async (params: {
  amount: number,
  tip?: number,
  driverId: string,
  successUrl: string,
  cancelUrl: string
}) => {
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  const session = await response.json()
  return session
}

// Função para obter o QR code de um vendedor
export const getDriverQRCode = async (driverId: string) => {
  const response = await fetch(`/api/driver-qr-code?driverId=${driverId}`)
  const data = await response.json()
  return data
}

// Função para processar pagamento com Pix
export const createPixPayment = async (params: {
  amount: number,
  driverId: string,
  customerEmail?: string
}) => {
  const response = await fetch('/api/create-pix-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  const paymentData = await response.json()
  return paymentData
}
