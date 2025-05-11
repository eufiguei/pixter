
// src/app/vendedor/dashboard/pagina-pagamento/page.tsx

// This page contains the "Minha Página de Pagamento" section, including
// the public payment link, QR code, and Stripe connection status/button.

// Logic adapted from the original MinhaPaginaView and main dashboard component.

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Define Profile type (ensure it matches the one used elsewhere)
type Profile = {
  id: string;
  nome?: string;
  email?: string;
  celular: string;
  profissao?: string;
  avatar_url?: string | null;
  stripe_account_id?: string | null;
  stripe_account_status?: 'pending' | 'verified' | 'restricted' | null;
  // Add other relevant fields
};

export default function MinhaPaginaPagamentoPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadingConnect, setLoadingConnect] = useState(false);

  // Fetch profile data and related info (QR code, payment URL)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const profileRes = await fetch('/api/vendedor/profile');
        if (!profileRes.ok) {
          if (profileRes.status === 401) {
            router.push('/vendedor/login');
            return;
          }
          throw new Error(`Erro ao carregar perfil (${profileRes.status})`);
        }
        const profileData: Profile = await profileRes.json();
        setProfile(profileData);

        if (profileData) {
          // Set payment URL
          const formattedPhoneForUrl = profileData.celular.replace(/\D/g, '');
          setPaymentUrl(`${window.location.origin}/${formattedPhoneForUrl}`);

          // Fetch QR code if Stripe account is connected (Task 2.6 - Initial Fetch)
          // We fetch regardless of status, API should handle non-verified accounts if needed
          if (profileData.stripe_account_id) {
            try {
              // Use the profile ID obtained from the profile fetch
              const qrRes = await fetch(`/api/stripe/driver-qr-code?driverId=${profileData.id}`);
              if (qrRes.ok) {
                const qrData = await qrRes.json();
                // Assuming API returns { qrCode: 'data:image/png;base64,...' } or similar
                setQrCode(qrData.qrCode); 
              } else {
                const qrErrorData = await qrRes.json();
                console.error('Erro ao buscar QR code:', qrRes.statusText, qrErrorData);
                setError(prev => prev + (prev ? '; ' : '') + (qrErrorData.error || 'Falha ao gerar QR code.'));
              }
            } catch (qrError: any) {
              console.error('Falha ao buscar QR code:', qrError);
              setError(prev => prev + (prev ? '; ' : '') + 'Erro técnico ao buscar QR code.');
            }
          }
        }
      } catch (err: any) {
        console.error('Erro ao carregar dados da página:', err);
        setError(err.message || 'Não foi possível carregar seus dados.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  // Function to initiate Stripe Connect onboarding
  const handleConnectStripe = async () => {
    setLoadingConnect(true);
    setError('');
    try {
      const response = await fetch('/api/stripe/connect-account');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao iniciar conexão com Stripe.');
      }
      const { url } = await response.json();
      if (url) {
        window.location.href = url; // Redirect user to Stripe
      } else {
        throw new Error('URL de conexão Stripe não recebida.');
      }
    } catch (err: any) {
      console.error("Erro handleConnectStripe:", err);
      setError(err.message || 'Erro ao conectar com Stripe.');
      setLoadingConnect(false);
    }
    // No need to setLoadingConnect(false) on success, as page redirects
  };

  // Handle copy payment URL
  const handleCopy = () => {
    navigator.clipboard.writeText(paymentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // --- Render Logic ---
  if (loading) return <div className="p-6 text-center">Carregando...</div>;
  if (error && !profile) return <div className="p-6 text-red-500">Erro: {error}</div>;
  if (!profile) return <div className="p-6">Não foi possível carregar o perfil.</div>;

  // Task 2.5: Hide Stripe connection info if already connected.
  // The logic below shows the link/QR only if stripe_account_id exists.
  const isStripeConnected = !!profile.stripe_account_id;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Minha Página de Pagamento</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      {!isStripeConnected ? (
        // Show connect button if not connected
        <div className="text-center space-y-4">
          <p className="text-gray-700">Conecte sua conta Stripe para ativar sua página de pagamento e gerar seu QR Code.</p>
          <button
            onClick={handleConnectStripe}
            disabled={loadingConnect}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loadingConnect ? 'Conectando...' : 'Conectar com Stripe'}
          </button>
        </div>
      ) : (
        // Show payment link and QR code if connected (Task 2.5 implemented)
        <div className="space-y-4">
          <p className="text-gray-700">Sua página pública para receber pagamentos:</p>
          {paymentUrl ? (
            <div className="flex items-center space-x-2 bg-gray-100 p-3 rounded-md border border-gray-200">
              <Link href={paymentUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate flex-grow text-sm sm:text-base">
                {paymentUrl}
              </Link>
              <button
                onClick={handleCopy}
                className="text-sm py-1 px-3 rounded-md bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          ) : (
            <p className="text-gray-500">Gerando link...</p>
          )}
          
          {/* QR Code Section (Task 2.6) */}
          <div>
            <p className="text-gray-700 mt-4">QR Code para Pagamento Rápido:</p>
            {qrCode ? (
              <div className="mt-2 p-4 border rounded-md inline-block bg-gray-50">
                <img src={qrCode} alt="QR Code Pagamento" className="w-48 h-48 md:w-56 md:h-56" />
              </div>
            ) : (
              <p className="text-gray-500 mt-2">{loading ? 'Carregando...' : 'Não foi possível gerar o QR Code. Verifique sua conexão Stripe.'}</p>
            )}
             {/* Add a button to download QR? Maybe later. */}
          </div>
          
          {/* Optionally, add a button to disconnect or manage Stripe connection */}
          {/* <div className="mt-6 border-t pt-4">
            <button 
              onClick={handleConnectStripe} 
              disabled={loadingConnect}
              className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              {loadingConnect ? 'Processando...' : 'Gerenciar conexão Stripe'}
            </button>
          </div> */} 
        </div>
      )}
    </div>
  );
}

