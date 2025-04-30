'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import CurrencyInput from 'react-currency-input-field';

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
          // Make sure to change this to your payment completion page
          return_url: `${window.location.origin}/payment-success`, 
        },
        redirect: 'if_required', // Only redirect for 3D Secure or similar
      });

      if (error) {
        // This point will only be reached if there is an immediate error when
        // confirming the payment. Otherwise, your customer will be redirected to
        // your `return_url`. For some payment methods like iDEAL, your customer will
        // be redirected to an intermediate site first to authorize the payment, then
        // redirected to the `return_url`.
        setPaymentError(error.message || 'Ocorreu um erro ao processar o pagamento.');
        onError(error);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment succeeded, handle it here (e.g., show success message)
        // This part might not be reached if redirect happens first
        onSuccess(paymentIntent);
      } else {
        // Handle other statuses if needed
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
  const [amount, setAmount] = useState(''); // Store raw string value from CurrencyInput
  const [driverInfo, setDriverInfo] = useState(null);
  const [loading, setLoading] = useState(true); // Combined loading state
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);

  // Fetch driver info
  useEffect(() => {
    const fetchDriverInfo = async () => {
      setLoading(true); // Start loading
      setError(''); // Clear previous errors
      try {
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
        // Keep loading true until payment intent is also attempted (if applicable)
        // setLoading(false); // We manage final loading state in the payment intent effect
      }
    };

    if (phoneNumber) {
      fetchDriverInfo();
    }
  }, [phoneNumber]);

  // Function to create payment intent (now separate)
  const handleCreatePayment = async () => {
    // Use the raw string amount for parsing
    const numericAmount = parseFloat(String(amount || '').replace(/[^\d,-]/g, '').replace(",", "."));
    
    if (isNaN(numericAmount) || numericAmount < 1) { // Check if >= 1 BRL
      // Don't set error here, just ensure no clientSecret
      setClientSecret(''); 
      return; // Exit if amount is invalid
    }

    setLoading(true); // Indicate loading for payment setup
    setError(''); // Clear previous errors

    try {
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Send amount in cents to Stripe
          amount: Math.round(numericAmount * 100), 
          driverPhoneNumber: phoneNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao iniciar pagamento');
      }

      const data = await response.json();
      setClientSecret(data.clientSecret);
    } catch (err) {
      console.error('Payment intent creation error:', err);
      setError(err.message || 'Erro ao iniciar pagamento');
      setClientSecret(''); // Clear secret on error
    } finally {
      setLoading(false); // Finish loading after attempt
    }
  };

  // Automatically create payment intent when amount is valid (debounced)
  useEffect(() => {
    const debounce = (func, delay) => {
      let timeoutId;
      return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
        }, delay);
      };
    };

    const debouncedCreateIntent = debounce(handleCreatePayment, 500); // 500ms debounce

    // Trigger intent creation if amount is potentially valid (>= R$ 1,00)
    const numericAmount = parseFloat(String(amount || '').replace(/[^\d,-]/g, '').replace(",", "."));
    if (!isNaN(numericAmount) && numericAmount >= 1) {
      debouncedCreateIntent();
    } else {
      // If amount becomes invalid or empty, clear the client secret immediately
      setClientSecret('');
      setError(''); // Clear any previous payment setup errors
    }

    // Cleanup function for debounce
    return () => {
      clearTimeout(debouncedCreateIntent);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]); // Rerun only when amount changes

  const handlePaymentSuccess = (paymentIntent) => {
    setPaymentSuccess(true);
    setPaymentDetails(paymentIntent);
    // Optionally clear amount or disable input
    // setAmount(''); 
  };

  const handlePaymentError = (error) => {
    // Error state is managed within PaymentForm, but log here if needed
    console.error('PaymentForm reported error:', error);
  };


  // Initial loading state (only for driver info)
  if (loading && !driverInfo && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando informações...</p>
        </div>
      </div>
    );
  }

  // Error state if driver info failed to load
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
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full overflow-hidden mb-4 relative">
                  <Image
                    src={driverInfo.avatar_url || defaultAvatar} // Use avatar_url directly, fallback to default
                    alt={driverInfo.nome || 'Avatar'}
                    fill // Use fill for responsive sizing within the container
                    sizes="96px" // Provide sizes hint
                    style={{ objectFit: 'cover' }} // Ensure image covers the area
                    onError={(e) => { e.currentTarget.src = defaultAvatar; }} // Fallback on image load error
                  />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{driverInfo.nome}</h1>
                {/* Display profession only if it exists */}
                {driverInfo.profissao && (
                  <p className="text-gray-600">{driverInfo.profissao}</p>
                )}
                {/* Format phone number: Remove non-digits, strip leading 55 if present, format as (XX) XXXXX-XXXX */}
                <p className="text-gray-600 mt-1">
                  {(() => {
                    const digits = String(phoneNumber || "").replace(/\D/g, ""); // Ensure phoneNumber is treated as string
                    const localDigits = digits.startsWith("55") && digits.length === 13 ? digits.substring(2) : digits;
                    // Ensure it matches the expected 11-digit format for Brazil mobile
                    if (localDigits.length === 11) {
                        return localDigits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
                    }
                    return phoneNumber; // Fallback to original if format is unexpected
                  })()}
                </p>
              </div>

              {/* Payment Section - Render based on paymentSuccess state */} 
              {!paymentSuccess ? (
                <> 
                  {/* Amount Input Section */} 
                  <div className="mt-8">
                    <h2 className="text-center text-3xl font-semibold text-gray-800 mb-6">Qual valor pago?</h2> {/* Increased size and margin */}
                    <label htmlFor="amount" className="sr-only"> {/* Visually hidden label */}
                      Digite o valor (R$)
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <CurrencyInput
                        id="amount"
                        name="amount"
                        placeholder="R$ 0,00"
                        value={amount} // Bind to state
                        onValueChange={(value) => setAmount(value || "")} // Update state with raw value (string)
                        intlConfig={{ locale: "pt-BR", currency: "BRL" }}
                        decimalScale={2}
                        allowNegativeValue={false}
                        // Use type="tel" for better mobile numeric keyboard compatibility with masking
                        // Hide default number input spinners using CSS (add CSS rule globally or via styled-jsx)
                        className="block w-full rounded-md border-gray-300 py-3 px-4 text-center text-3xl focus:border-indigo-500 focus:ring-indigo-500 sm:text-2xl appearance-none" // Increased font size, added appearance-none
                        inputMode="decimal" // Hint for numeric-like input
                        type="tel" // Use tel for better numeric keyboard compatibility with masking libraries
                      />
                    </div>
                    
                    {/* Optional Tip Suggestion */} 
                    {/* <p className="text-sm text-gray-500 mt-2">
                      Adicione R$1 ou R$2 para pagar mais rápido e evitar espera
                    </p> */} 
                    
                    {/* Display general errors or payment setup errors */} 
                    {error && (
                      <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
                    )}
                  </div>

                  {/* Stripe Elements Section (Conditionally rendered) */} 
                  {clientSecret ? (
                    <div className="mt-6">
                      <Elements stripe={stripePromise} options={{ clientSecret }}>
                        <PaymentForm
                          amount={amount} // Pass amount for potential display/validation if needed
                          phoneNumber={phoneNumber}
                          clientSecret={clientSecret} // Pass clientSecret
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                        />
                      </Elements>
                    </div>
                  ) : (
                    // Show loading indicator only when amount is valid and loading is true
                    amount && parseFloat(String(amount || '').replace(/[^\d,-]/g, '').replace(",", ".")) >= 1 && loading && (
                      <div className="mt-6 text-center text-gray-500">Carregando opções de pagamento...</div>
                    )
                  )}
                </>
              ) : (
                // Post-Payment Success Message
                <div className="mt-6 p-6 bg-white rounded-lg shadow-md text-center">
                  {/* Success Icon */}
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                    <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Pagamento concluído</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    {/* Display formatted amount from payment details if available */} 
                    O seu pagamento{paymentDetails?.amount ? ` de R$ ${(paymentDetails.amount / 100) .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''} foi realizado com sucesso.
                  </p>
                  
                  {/* Signup/Login Prompt */} 
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Cadastre-se para pagamentos mais rápidos</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Crie uma conta para pagamentos mais rápidos e histórico de pagamentos.
                    </p>
                    <div className="space-y-3">
                      <Link href="/cadastro"> {/* Assuming /cadastro is client signup */}
                        <span className="block w-full text-center py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md shadow-sm cursor-pointer">
                          Criar conta
                        </span>
                      </Link>
                      <Link href="/login"> {/* Assuming /login is client login */}
                        <span className="block w-full text-center py-2 px-4 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-md shadow-sm border border-gray-300 cursor-pointer">
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
      <footer className="bg-white border-t border-gray-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Pixter. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

