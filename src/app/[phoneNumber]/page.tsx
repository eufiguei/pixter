'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import CurrencyInput from 'react-currency-input-field';

// … your loadStripe / Elements / PaymentForm imports here if you’re doing Stripe integration …

export default function DriverPaymentPage({
  params,
}: {
  params: { phoneNumber: string };
}) {
  const { phoneNumber } = params;

  const [driverProfile, setDriverProfile] = useState<{
    id: string;
    nome?: string;
    avatar_url?: string;
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState('');

  // fetch driver, but first verify we got JSON back
  useEffect(() => {
    const fetchDriver = async () => {
      setLoadingProfile(true);
      setError('');
      try {
	const res = await fetch(`/api/public/driver-info/${phoneNumber}`);
        if (!res.ok) {
          throw new Error(`Erro ${res.status}`);
        }
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Resposta inválida do servidor.');
        }
        const json = await res.json();
        setDriverProfile(json.profile);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchDriver();
  }, [phoneNumber]);

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error && !driverProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/">Voltar à página inicial</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* NavBar will now show only “Entrar/Criar Conta” here */}
      {/* <NavBar /> */}

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white shadow-md rounded-lg p-8">
          {/* Driver info */}
          <div className="flex flex-col items-center mb-8">
            <Image
              src={driverProfile!.avatar_url ?? '/images/avatars/avatar_1.png'}
              alt={driverProfile!.nome || 'Motorista'}
              width={96}
              height={96}
              className="rounded-full"
            />
            <h2 className="mt-4 text-xl font-bold">
              {driverProfile!.nome}
            </h2>
            <p className="text-gray-600">
              {phoneNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
            </p>
          </div>

          {/* Your currency input & Stripe Elements go here… */}

        </div>
      </main>
    </div>
  );
}
