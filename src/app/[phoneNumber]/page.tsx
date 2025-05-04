// src/app/[phoneNumber]/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import CurrencyInput from 'react-currency-input-field';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// Fallback avatar
const defaultAvatar = "/images/avatars/avatar_1.png";

function PaymentForm({ onSuccess, onError }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setPaymentError('');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/pagamento/sucesso` },
        redirect: 'if_required',
      });

      if (error) {
        setPaymentError(error.message!);
        onError(error);
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntent);
      }
    } catch (err: any) {
      setPaymentError('Erro inesperado ao processar o pagamento.');
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
        className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md disabled:opacity-50"
      >
        {isProcessing ? 'Processando...' : 'Pagar com Pix, Apple Pay ou Cartão'}
      </button>
      <p className="text-center text-xs text-gray-500 mt-2">
        Pagamento processado com segurança via Stripe
      </p>
    </form>
  );
}

export default function DriverPaymentPage({ params }: { params: { phoneNumber: string } }) {
  const { phoneNumber } = params;
  const [amount, setAmount] = useState<number | undefined>(undefined);
  // driverInfo state will hold the entire API response, including the nested 'profile' object
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // fetch driver public info
  useEffect(() => {
    fetch(`/api/public/driver-info/${phoneNumber}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(setDriverInfo) // Store the whole response { profile: { ... } }
      .catch((err: any) => setError(err.error || err.message))
      .finally(() => setLoadingInfo(false));
  }, [phoneNumber]);

  // create PaymentIntent whenever `amount` ≥ R$1,00
  useEffect(() => {
    clearTimeout(debounceRef.current!);
    const num = amount; // Use the number state directly
    if (num !== undefined && !isNaN(num) && num >= 1) { // Check if amount is a valid number >= 1 BRL
      debounceRef.current = setTimeout(async () => {
        setError('');
        try {
          const res = await fetch('/api/stripe/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: Math.round(num * 100), driverPhoneNumber: phoneNumber }),
          });
          if (!res.ok) throw await res.json();
          const { clientSecret } = await res.json();
          setClientSecret(clientSecret);
        } catch (err: any) {
          setError(err.error || err.message || 'Erro ao iniciar pagamento');
        }
      }, 500);
    } else {
      setClientSecret('');
      setError('');
    }
  }, [amount, phoneNumber]);

  const handleSuccess = (pi: any) => {
    setPaymentSuccess(true);
    setPaymentDetails(pi);
  };

  if (loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-b-2 border-purple-600 rounded-full"></div>
      </div>
    );
  }

  // Check for error OR if driverInfo exists but driverInfo.profile does not
  if (error || !driverInfo?.profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-6 bg-white rounded shadow text-center">
          <h1 className="text-red-600 font-semibold mb-4">Erro</h1>
          {/* Display specific error or a generic one if profile is missing */}
          <p>{error || 'Informações do motorista não encontradas.'}</p>
          <Link href="/" className="text-indigo-600 hover:underline mt-4 block">Voltar</Link>
        </div>
      </div>
    );
  }

  // Now we can safely access driverInfo.profile properties
  const profile = driverInfo.profile;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Ensure NavBar is rendered *before* main content if it's part of the layout */}
      {/* <NavBar /> Assumed to be in RootLayout */}
      <main className="flex-grow flex flex-col items-center p-4 pt-8 md:pt-16">
        <div className="w-full max-w-md md:max-w-lg lg:max-w-xl bg-white rounded-lg shadow-md p-8 space-y-8">
          {/* Driver Info - Access via profile object */}
          <div className="flex flex-col items-center space-y-2">
            <div className="w-24 h-24 rounded-full overflow-hidden relative">
              <Image
                src={profile.avatar_url || defaultAvatar}
                alt={profile.nome || 'Driver Avatar'}
                fill
                style={{ objectFit: 'cover' }}
                onError={e => (e.currentTarget.src = defaultAvatar)}
              />
            </div>
            <h1 className="text-2xl font-bold">{profile.nome || 'Driver'}</h1>
            {profile.profissao && <p className="text-sm text-gray-600">{profile.profissao}</p>}
            {profile.celular && <p className="text-sm text-gray-500">{profile.celular}</p>}
          </div>

          {/* amount input */}
          {!paymentSuccess ? (
            <>
              <h2 className="text-center text-3xl font-semibold">Qual valor pago?</h2>
              <CurrencyInput
                placeholder="R$ 0,00"
                value={amount}
                onValueChange={(value, name, values) => setAmount(values?.float)}
                decimalSeparator=","
                groupSeparator="."
                intlConfig={{ locale: 'pt-BR', currency: 'BRL' }}
                allowNegativeValue={false}
                decimalScale={2}
                inputMode="decimal"
                className="w-full text-center text-3xl py-3 border rounded focus:ring-purple-500"
              />

              {error && <p className="text-sm text-red-600 text-center">{error}</p>}

              {clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm onSuccess={handleSuccess} onError={setError} />
                </Elements>
              ) : (
                amount && <p className="text-center text-gray-500">Carregando opções de pagamento...</p>
              )}
            </>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-green-600 font-semibold">Pagamento concluído!</p>
              <p>Valor: R$ {(paymentDetails.amount_received / 100).toFixed(2).replace('.', ',')}</p>
            </div>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Pixter. Todos os direitos reservados.
      </footer>
    </div>
  );
}
