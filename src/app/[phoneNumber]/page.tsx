'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function DriverPaymentPage({
  params,
}: {
  params: { phoneNumber: string };
}) {
  const { phoneNumber } = params;
  const [driver, setDriver] = useState<{ nome?: string; avatar_url?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [valor, setValor] = useState('');

  useEffect(() => {
    async function fetchDriver() {
      try {
        const res = await fetch(`/api/public-profile?celular=${phoneNumber}`);
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const { profile } = await res.json();
        setDriver(profile);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDriver();
  }, [phoneNumber]);

  // Brazilian BRL formatting: replace dots with commas, allow up to 2 decimals
  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value
      .replace(/\./g, ',')
      .replace(/[^\d,]/g, '');

    const [intPart, decPart] = v.split(',');
    if (decPart && decPart.length > 2) {
      v = intPart + ',' + decPart.slice(0, 2);
    }
    setValor(v);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Motorista não encontrado'}</p>
          <Link href="/">Voltar à página inicial</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          {/* Driver info */}
          <div className="flex flex-col items-center mb-8">
            <Image
              src={driver.avatar_url ?? '/images/avatars/avatar_1.png'}
              alt={driver.nome || 'Motorista'}
              width={96}
              height={96}
              className="rounded-full"
              priority
            />
            <h2 className="mt-4 text-xl font-bold">{driver.nome}</h2>
            <p className="text-gray-600">
              {phoneNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
            </p>
          </div>

          {/* Valor input */}
          <div>
            <label
              htmlFor="valor"
              className="block text-sm text-gray-700 text-center mb-2"
            >
              Qual valor pago?
            </label>
            <input
              id="valor"
              name="valor"
              type="text"
              inputMode="decimal"
              lang="pt-BR"
              pattern="[0-9]*[.,]?[0-9]{0,2}"
              placeholder="0,00"
              value={valor}
              onChange={handleValorChange}
              className="w-full py-3 text-2xl text-center border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* TODO: once you have clientSecret, mount Stripe <Elements> + <PaymentElement> here */}
        </div>
      </main>
    </div>
  );
}
