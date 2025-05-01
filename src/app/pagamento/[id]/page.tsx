'use client'

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link'; // Added missing import

// Define Profile type
type Profile = {
    id: string;
    nome?: string;
    avatar_url?: string;
    // Add other fields as needed
};

export default function PaginaPagamento() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const driverId = params?.id as string;

  const [valor, setValor] = useState('');
  const [gorjeta, setGorjeta] = useState(0); // Gorjeta in BRL (e.g., 1 for R$1)
  const [processando, setProcessando] = useState(false);
  const [driverProfile, setDriverProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState('');

  // Fetch driver profile
  useEffect(() => {
    const fetchDriverProfile = async () => {
      if (!driverId) return;
      setLoadingProfile(true);
      setError('');
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('id, nome, avatar_url')
          .eq('id', driverId)
          .eq('tipo', 'motorista') // Ensure it's a driver
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            throw new Error('Motorista não encontrado.');
          } else {
            throw new Error(profileError.message || 'Erro ao buscar dados do motorista.');
          }
        }
        setDriverProfile(data);
      } catch (err: any) {
        console.error("Error fetching driver profile:", err);
        setError(err.message);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchDriverProfile();
  }, [driverId, supabase]);

  // Function to handle input change and allow only numbers and one comma
  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Remove non-digit characters except for one comma
    value = value.replace(/[^\d,]/g, '');
    // Ensure only one comma
    const commaIndex = value.indexOf(',');
    if (commaIndex !== -1) {
      value = value.substring(0, commaIndex + 1) + value.substring(commaIndex + 1).replace(/,/g, '');
    }
    // Limit to 2 decimal places
    if (commaIndex !== -1 && value.length > commaIndex + 3) {
        value = value.substring(0, commaIndex + 3);
    }

    setValor(value);
  };

  // Function to convert BRL string (e.g., "12,34") to cents (integer)
  const convertBRLToCents = (brlString: string): number => {
    if (!brlString) return 0;
    const numericString = brlString.replace(',', '.'); // Replace comma with dot for parseFloat
    const value = parseFloat(numericString);
    return Math.round(value * 100); // Convert to cents and round
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverId || !valor) return;

    setProcessando(true);
    setError('');

    const valorEmCentavos = convertBRLToCents(valor);
    const gorjetaEmCentavos = gorjeta * 100; // Gorjeta is already in BRL

    try {
      const response = await fetch('/api/stripe/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId: driverId,
          amount: valorEmCentavos,
          tipAmount: gorjetaEmCentavos,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao iniciar pagamento.');
      }

      // Redirect to Stripe Checkout if URL is provided
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.clientSecret) {
        // Handle Payment Element flow if needed (not implemented here)
        console.log("Received client secret for Payment Element:", data.clientSecret);
        // For now, redirect to success assuming PI was created
        router.push('/pagamento/sucesso');
      } else {
          throw new Error('Resposta inválida do servidor de pagamento.');
      }

    } catch (err: any) {
      console.error("Payment initiation error:", err);
      setError(err.message || 'Ocorreu um erro ao processar seu pagamento.');
      setProcessando(false);
    }
  };

  if (loadingProfile) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        {error && !driverProfile && (
            <div className="text-center text-red-500 mb-6">
                <p>{error}</p>
                <Link href="/" className="text-indigo-600 hover:text-indigo-800 mt-2 inline-block">Voltar</Link>
            </div>
        )}
        {driverProfile && (
          <>
            <div className="flex flex-col items-center mb-6">
              {/* Avatar do motorista */}
              <div className="w-24 h-24 bg-gray-200 rounded-full overflow-hidden mb-4">
                {driverProfile.avatar_url ? (
                  <img src={driverProfile.avatar_url} alt={`Avatar de ${driverProfile.nome}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-500 text-sm">Sem Foto</span>
                  </div>
                )}
              </div>
              <h3 className="text-xl font-medium text-gray-800">{driverProfile.nome || 'Motorista'}</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="valor" className="block text-sm font-medium text-gray-700 mb-1 text-center">
                  Qual valor pago?
                </label>
                <input
                  id="valor"
                  name="valor"
                  type="text" // Use text to better control formatting
                  inputMode="decimal" // Hint for numeric keyboard, hopefully with comma on pt-BR
                  required
                  value={valor}
                  onChange={handleValorChange} // Use custom handler
                  className="w-full px-3 py-3 text-2xl border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-center font-semibold"
                  placeholder="0,00"
                />
              </div>

              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2">Adicionar gorjeta:</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setGorjeta(0)}
                    className={`py-2 px-4 rounded-md transition ${
                      gorjeta === 0
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Sem gorjeta
                  </button>
                  {[1, 2, 5, 10].map(tipValue => (
                     <button
                        key={tipValue}
                        type="button"
                        onClick={() => setGorjeta(tipValue)}
                        className={`py-2 px-4 rounded-md transition ${
                        gorjeta === tipValue
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                    >
                        + R${tipValue},00
                    </button>
                  ))}
                  {/* Add more tip options if needed */}
                </div>
                {/* Removed tip explanation text based on IMG_0356 */}
              </div>

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={!valor || processando || !driverProfile}
                className={`w-full bg-purple-600 text-white py-3 px-4 rounded-md font-medium text-lg transition ${
                  !valor || processando || !driverProfile ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'
                }`}
              >
                {processando ? 'Processando...' : 'Pagar'}
              </button>
            </form>

            {/* Removed Stripe/Apple Pay text based on IMG_0356 */}
          </>
        )}
      </div>
    </main>
  )
}

