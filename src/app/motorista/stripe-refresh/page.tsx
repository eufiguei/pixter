'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function StripeRefresh() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function refreshStripeLink() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/motorista/login');
          return;
        }

        const driverId = session.user.id;

        const response = await fetch('/api/stripe/create-connect-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ driverId }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao atualizar link do Stripe');
        }
        
        // Redirecionar para o link do Stripe
        if (data.url) {
          window.location.href = data.url;
        } else {
          router.push('/motorista/dashboard');
        }
      } catch (error) {
        console.error('Erro:', error);
        setError('Falha ao atualizar link do Stripe');
        setLoading(false);
      }
    }

    refreshStripeLink();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Atualizando link do Stripe...</h2>
          <p className="text-gray-600 mb-4">Por favor, aguarde enquanto redirecionamos você para o Stripe.</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-red-500">Erro</h2>
        <p className="mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
