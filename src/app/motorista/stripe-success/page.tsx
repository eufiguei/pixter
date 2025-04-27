'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function StripeSuccess() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [driver, setDriver] = useState<any>(null);

  useEffect(() => {
    async function checkDriverStatus() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/motorista/login');
          return;
        }

        const { data, error } = await supabase
          .from('drivers')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
          throw error;
        }

        setDriver(data);
      } catch (error) {
        console.error('Erro:', error);
        setError('Falha ao verificar status da conta');
      } finally {
        setLoading(false);
      }
    }

    checkDriverStatus();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Verificando status da conta...</h2>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold mb-4 text-red-500">Erro</h2>
          <p className="mb-6">{error}</p>
          <Link href="/motorista/dashboard" className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">
            Voltar para o dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-2">Conta Stripe configurada com sucesso!</h2>
        <p className="text-gray-600 mb-6">
          Sua conta Stripe foi configurada com sucesso. Agora você pode receber pagamentos através do Pixter.
        </p>
        
        {driver && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6 text-left">
            <h3 className="font-semibold mb-2">Status da sua conta:</h3>
            <p>
              <span className="font-medium">Conta Stripe:</span> {driver.stripe_account_id ? 'Conectada' : 'Não conectada'}
            </p>
            <p>
              <span className="font-medium">Status:</span> {driver.stripe_account_status || 'Pendente'}
            </p>
            <p>
              <span className="font-medium">Pagamentos habilitados:</span> {driver.stripe_account_enabled ? 'Sim' : 'Não'}
            </p>
          </div>
        )}
        
        <Link href="/motorista/dashboard" className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">
          Ir para o dashboard
        </Link>
      </div>
    </main>
  );
}
