'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe with your publishable key
// Make sure to set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your .env.local
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// Default avatar - use a generic one if avatar_url is missing
const defaultAvatar = 
  "/images/avatars/avatar_1.png"; // Or a more generic placeholder path

// Payment Form Component (Child component used within Elements)
function PaymentForm({ amount, phoneNumber, clientSecret, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't loaded yet
      return;
    }

    setIsProcessing(true);
    setPaymentError('');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`, // Create this page for successful payments
        },
        redirect: 'if_required', // Only redirect for 3D Secure or similar
      });

      if (error) {
        // Show error to your customer
        setPaymentError(error.message || 'Ocorreu um erro ao processar o pagamento.');
        onError(error);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment succeeded
        onSuccess(paymentIntent);
      } else {
        // Other status - might need to check status on server
        setPaymentError('Status do pagamento: ' + (paymentIntent?.status || 'desconhecido'));
      }
    } catch (err) {
      console.error('Payment error:', err);
      setPaymentError('Erro inesperado ao processar pagamento.');
      onError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {paymentError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {paymentError}
        </div>
      )}
      
      <PaymentElement />
      
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processando...' : `Pagar com Pix, Apple Pay ou Cartão`}
      </button>
      
      <p className="text-center text-xs text-gray-500 mt-2">
        Pagamento processado com segurança via Stripe
      </p>
    </form>
  );
}

// Main Page Component
export default function DriverPaymentPage({ params }) {
  const { phoneNumber } = params;
  const [amount, setAmount] = useState('');
  const [driverInfo, setDriverInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);

  // Fetch driver info
  useEffect(() => {
    const fetchDriverInfo = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/public/driver-info/${phoneNumber}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Motorista não encontrado');
        }
        
        const data = await response.json();
        setDriverInfo(data);
      } catch (err) {
        console.error('Error fetching driver info:', err);
        setError(err.message || 'Erro ao carregar informações do motorista');
      } finally {
        setLoading(false);
      }
    };

    if (phoneNumber) {
      fetchDriverInfo();
    }
  }, [phoneNumber]);

  // Create payment intent when amount changes
  const handleCreatePayment = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError('Por favor, insira um valor válido.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          driverPhoneNumber: phoneNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao iniciar pagamento');
      }

      const data = await response.json();
      setClientSecret(data.clientSecret);
      setError('');
    } catch (err) {
      console.error('Payment intent creation error:', err);
      setError(err.message || 'Erro ao iniciar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (paymentIntent) => {
    setPaymentSuccess(true);
    setPaymentDetails(paymentIntent);
    // You could redirect to a success page or show a success message
  };

  const handlePaymentError = (error) => {
    console.error('Payment error:', error);
    // Error is already displayed in the PaymentForm component
  };


  if (loading && !driverInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando informações...</p>
        </div>
      </div>
    );
  }

  if (error && !driverInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <h1 className="text-2xl font-semibold text-red-600 mb-4">Erro</h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <Link href="/">
            <span className="text-indigo-600 hover:underline cursor-pointer">
              Voltar para a página inicial
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/">
            <span className="text-xl font-bold text-gray-800 cursor-pointer">Pixter</span>
          </Link>
          <div className="flex space-x-4">
            <Link href="/entrar">
              <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Entrar</span>
            </Link>
            <Link href="/criar-conta">
              <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Criar conta</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md overflow-hidden max-w-md w-full">
          {driverInfo && (
            <div className="p-6">
              {/* Driver Info */}
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full overflow-hidden mb-4">
                  <Image
                    src={driverInfo.avatar_url || defaultAvatar} // Use avatar_url directly, fallback to default
                    alt={driverInfo.nome || 'Avatar'}
                    width={96}
                    height={96}
                    className="object-cover"
                    onError={(e) => { e.currentTarget.src = defaultAvatar; }} // Fallback on image load error
                  />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{driverInfo.nome}</h1>
                <p className="text-gray-600">{driverInfo.profissao}</p>
                <p className="text-gray-600 mt-1">({phoneNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')})</p>
              </div>

              {/* Payment Section */}
              {!clientSecret ? (
                <div className="mt-8">
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                    Digite o valor (R$)
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      id="amount"
                      name="amount"
                      step="0.01"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  
                  <p className="text-sm text-gray-500 mt-2">
                    Adicione R$1 ou R$2 para pagar mais rápido e evitar espera
                  </p>
                  
                  {error && (
                    <p className="mt-2 text-sm text-red-600">{error}</p>
                  )}
                  
                  <button
                    onClick={handleCreatePayment}
                    disabled={loading || !amount}
                    className="w-full mt-4 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    {loading ? 'Processando...' : 'Continuar para pagamento'}
                  </button>
                </div>
              ) : (
                <div className="mt-6">
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <PaymentForm
                      amount={amount}
                      phoneNumber={phoneNumber}
                      clientSecret={clientSecret}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  </Elements>
                </div>
              )}
              
              {paymentSuccess && (
                <div className="mt-6 p-6 bg-white rounded-lg shadow-md text-center">
                  {/* Success Icon */}
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                    <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Pagamento concluído</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    O seu pagamento de R${amount} foi realizado com sucesso.
                  </p>
                  
                  {/* Signup/Login Prompt */}
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Cadastre-se para pagamentos mais rápidos</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Crie uma conta para pagamentos mais rápidos e histórico de pagamentos.
                    </p>
                    <div className="space-y-3">
                      <Link href="/cadastro"> {/* Assuming /cadastro is client signup */}
                        <span className="block w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md shadow-sm cursor-pointer">
                          Criar conta
                        </span>
                      </Link>
                      <Link href="/login"> {/* Assuming /login is client login */}
                        <span className="block w-full py-2 px-4 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-md shadow-sm border border-gray-300 cursor-pointer">
                          Entrar
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Pixter. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
