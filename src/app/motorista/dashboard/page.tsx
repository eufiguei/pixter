
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Define types for profile and payments (ensure Profile includes all needed fields)
type Profile = {
  id: string;
  nome?: string; // Made optional as it might not be immediately available
  email?: string; // Made optional
  celular: string; // Assuming celular is essential
  profissao?: string; // Made optional
  conta_bancaria?: string; // This seems to be used as the Stripe Account ID indicator in older code
  stripe_account_id?: string | null;
  stripe_account_status?: 'pending' | 'verified' | 'restricted' | null;
  // Add other profile fields as needed (e.g., from Supabase)
  // stripe_account_charges_enabled?: boolean;
  // stripe_account_payouts_enabled?: boolean;
  // stripe_account_details_submitted?: boolean;
};

type Payment = {
  id: string;
  amount: number;
  created_at: string;
  // Add other payment fields as needed
};

// --- Componente MinhaPaginaView (Versão Corrigida e Aprimorada) ---
const MinhaPaginaView = ({ profile, paymentUrl, qrCode, onConnectStripe }: {
  profile: Profile | null;
  paymentUrl: string;
  qrCode: string;
  onConnectStripe: () => void;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(paymentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    });
  };

  if (!profile) return <p>Carregando...</p>;

  // Lógica de Status Aprimorada
  const getStripeStatusDisplay = () => {
    // Check for stripe_account_id first
    if (!profile.stripe_account_id) {
      return { connected: false, message: 'Conecte sua conta Stripe para ativar sua página.', showConnectButton: true, showDetails: false };
    }
    // If ID exists, check the status field updated by webhook
    switch (profile.stripe_account_status) {
      case 'verified':
        // Add check for charges_enabled if you store it separately
        return { connected: true, message: 'Sua conta Stripe está ativa.', showConnectButton: false, showDetails: true };
      case 'pending':
        return { connected: true, message: 'Sua conta Stripe está com verificação pendente. Conclua o processo no Stripe.', showConnectButton: false, showDetails: false }; // Consider adding a button/link to Stripe or re-onboarding
      case 'restricted':
        return { connected: true, message: 'Sua conta Stripe está restrita. Verifique seu email ou acesse o Stripe para mais detalhes.', showConnectButton: false, showDetails: false }; // Consider adding a button/link to Stripe or re-onboarding
      default:
        // Status might be null or an unexpected value if webhook hasn't run or failed
        return { connected: true, message: 'Verificando status da conta Stripe... Atualize a página em instantes ou tente conectar novamente se o problema persistir.', showConnectButton: true, showDetails: false }; // Show connect button as fallback
    }
  };

  const stripeStatus = getStripeStatusDisplay();

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Minha Página de Pagamento</h2>
      <p className="text-gray-700 mb-4">{stripeStatus.message}</p>

      {stripeStatus.showConnectButton && (
        <div className="text-center">
          <button
            onClick={onConnectStripe}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {profile.stripe_account_id ? 'Reconectar / Atualizar Stripe' : 'Conectar com Stripe'}
          </button>
        </div>
      )}

      {stripeStatus.showDetails && (
        <div className="space-y-4">
          <p className="text-gray-700">Sua página pública para receber pagamentos:</p>
          {paymentUrl ? (
            <div className="flex items-center space-x-2 bg-gray-100 p-2 rounded">
              <Link href={paymentUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate flex-grow">
                {paymentUrl}
              </Link>
              <button
                onClick={handleCopy}
                className="text-sm py-1 px-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          ) : <p className="text-gray-500">Gerando link...</p>}
          {qrCode ? (
            <div>
              <p className="text-gray-700 mt-4">QR Code:</p>
              <img src={qrCode} alt="QR Code Pagamento" className="mt-2 border" />
            </div>
          ) : <p className="text-gray-500">Gerando QR Code...</p>}
        </div>
      )}
    </div>
  );
};

// --- Componente PagamentosRecebidosView (Sem alterações) ---
const PagamentosRecebidosView = ({ payments }: { payments: Payment[] }) => (
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h2 className="text-xl font-semibold mb-4">Pagamentos Recebidos</h2>
    {payments.length === 0 ? (
      <p className="text-gray-600">Você ainda não recebeu nenhum pagamento.</p>
    ) : (
      <ul>
        {payments.map((payment) => (
          <li key={payment.id} className="border-b py-2">
            {/* Display payment details here */}
            Valor: {payment.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, Data: {new Date(payment.created_at).toLocaleDateString('pt-BR')}
          </li>
        ))}
      </ul>
    )}
  </div>
);

// --- Componente MeusDadosView (Verificar tipo Profile) ---
const MeusDadosView = ({ profile, onUpdate }: { profile: Profile | null, onUpdate: (updates: Partial<Profile>) => Promise<void> }) => {
  // Basic form state - ideally use a form library like react-hook-form
  const [nome, setNome] = useState(profile?.nome || '');
  const [profissao, setProfissao] = useState(profile?.profissao || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setNome(profile.nome || '');
      setProfissao(profile.profissao || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setIsLoading(true);
    setError('');
    try {
      // Only update fields that are being edited
      await onUpdate({ nome, profissao });
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Falha ao atualizar perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile) return <p>Carregando dados...</p>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Meus Dados</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nome</label>
          {isEditing ? (
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              disabled={isLoading}
            />
          ) : (
            <p className="text-gray-900">{profile.nome || '-'}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <p className="text-gray-900">{profile.email || '-'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">WhatsApp</label>
          <p className="text-gray-900">{profile.celular}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Profissão</label>
          {isEditing ? (
            <input
              type="text"
              value={profissao}
              onChange={(e) => setProfissao(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              disabled={isLoading}
            />
          ) : (
            <p className="text-gray-900">{profile.profissao || '-'}</p>
          )}
        </div>
        {/* Display Stripe Status - Using the field from the improved logic */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Status Conta Stripe</label>
          <p className="text-gray-600">
            {!profile.stripe_account_id ? 'Não conectada' :
             (profile.stripe_account_status === 'verified' ? 'Verificada' :
             (profile.stripe_account_status === 'pending' ? 'Pendente' :
             (profile.stripe_account_status === 'restricted' ? 'Restrita' : 'Verificando...')))}
          </p>
        </div>
      </div>
      <div className="mt-6">
        {isEditing ? (
          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={isLoading}
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            Atualizar Informações
          </button>
        )}
      </div>
    </div>
  );
};

// --- Main Dashboard Component (MotoristaPage) ---
export default function MotoristaPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');

  // State to manage which view is active
  const [activeView, setActiveView] = useState('overview'); // 'overview', 'payments', 'profile', 'paymentPage'

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // Buscar perfil do motorista (ensure API returns stripe_account_status)
        const profileRes = await fetch('/api/motorista/profile');
        if (!profileRes.ok) {
          if (profileRes.status === 401) {
            router.push('/motorista/login'); // Redirect to login if not authenticated
            return;
          }
          throw new Error(`Erro ao carregar perfil (${profileRes.status})`);
        }
        const profileData: Profile = await profileRes.json();
        setProfile(profileData);

        // Only fetch other data if profile loaded
        if (profileData) {
          // Set payment URL based on profile (e.g., phone number)
          const formattedPhoneForUrl = profileData.celular.replace(/\D/g, ''); // Remove non-digits
          setPaymentUrl(`${window.location.origin}/${formattedPhoneForUrl}`); // Use origin for base URL

          // Fetch payments
          const paymentsRes = await fetch('/api/motorista/payments'); // Assuming this endpoint exists
          if (paymentsRes.ok) {
            const paymentsData = await paymentsRes.json();
            setPayments(paymentsData.payments || []);
          } else {
            console.error('Erro ao carregar pagamentos:', paymentsRes.statusText);
            // Don't throw, just show empty list or a message
          }

          // Fetch QR code only if Stripe account is likely active (e.g., verified)
          // Adjust this condition based on your exact needs and profile data
          if (profileData.stripe_account_id && profileData.stripe_account_status === 'verified') {
            try {
              const qrRes = await fetch(`/api/stripe/driver-qr-code?driverId=${profileData.id}`);
              if (qrRes.ok) {
                const qrData = await qrRes.json();
                setQrCode(qrData.qrCode); // Assuming API returns { qrCode: 'data:image/png;base64,...' }
              } else {
                console.error('Erro ao buscar QR code:', qrRes.statusText);
              }
            } catch (qrError) {
              console.error('Falha ao buscar QR code:', qrError);
            }
          }
        }

      } catch (err: any) {
        console.error('Erro ao carregar dados do dashboard:', err);
        setError(err.message || 'Não foi possível carregar seus dados. Tente novamente mais tarde.');
        // If profile fetch failed, profile might be null
        if (!profile) setProfile(null); // Ensure profile is null on error if it failed fetch
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Add dependency array - re-run if router changes
  }, [router]);

  // Function to handle profile updates
  const handleProfileUpdate = async (updates: Partial<Profile>) => {
    if (!profile) throw new Error("Perfil não carregado.");

    const response = await fetch('/api/motorista/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      let errorMsg = 'Falha ao atualizar perfil.';
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) { /* Ignore parsing error */ }
      throw new Error(errorMsg);
    }

    const updatedProfile = await response.json();
    setProfile(updatedProfile); // Update local profile state
  };

  // Function to initiate Stripe Connect onboarding
  const handleConnectStripe = async () => {
    setLoading(true); // Show loading indicator
    setError('');
    try {
        const response = await fetch('/api/stripe/connect-account');
        if (!response.ok) {
            let errorMsg = 'Falha ao iniciar conexão com Stripe.';
            try {
              const errorData = await response.json();
              errorMsg = errorData.error || errorMsg;
            } catch(e) { /* Ignore */ }
            throw new Error(errorMsg);
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
        setLoading(false);
    }
    // No need to setLoading(false) on success, as page redirects
  };

  // --- Render Logic ---

  if (loading && !profile) {
    // Show loading only on initial load when profile is not yet fetched
    return <div className="p-6 text-center">Carregando dashboard...</div>;
  }

  if (error && !profile) {
    // If profile fetch failed completely, show error and maybe a retry button
    return <div className="p-6 text-red-500">Erro: {error}</div>;
  }

  if (!profile) {
    // This case might happen if fetch fails but error state wasn't set properly, or auth failed
    // Router should have redirected in useEffect if 401, so this might indicate another issue
    return <div className="p-6">Não foi possível carregar o perfil. Verifique se está logado.</div>;
  }

  // Profile is loaded, render the dashboard structure
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <span className="text-xl font-bold text-gray-800">PIXTER</span>
          <div className="flex space-x-4">
            <button onClick={() => setActiveView('overview')} className={`px-3 py-2 rounded-md text-sm font-medium ${activeView === 'overview' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}>Visão Geral</button>
            <button onClick={() => setActiveView('payments')} className={`px-3 py-2 rounded-md text-sm font-medium ${activeView === 'payments' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}>Pagamentos</button>
            <button onClick={() => setActiveView('profile')} className={`px-3 py-2 rounded-md text-sm font-medium ${activeView === 'profile' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}>Meus Dados</button>
            <button onClick={() => setActiveView('paymentPage')} className={`px-3 py-2 rounded-md text-sm font-medium ${activeView === 'paymentPage' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}>Minha Página</button>
            {/* Add Logout button logic here - e.g., call /api/auth/logout and redirect */}
            <button onClick={async () => { await fetch('/api/auth/logout'); router.push('/motorista/login'); }} className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Sair</button>
          </div>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Show loading indicator covering content if loading state is true but profile exists (e.g., during actions) */}
        {loading && profile && <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50"><p>Processando...</p></div>}
        {/* Show general error message if error state is set */}
        {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">Erro: {error}</div>}

        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Olá, {profile.nome || 'Motorista'}!</h1>

        {/* Conditional Rendering based on activeView */}
        {activeView === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Overview Cards */}
            <div onClick={() => setActiveView('payments')} className="cursor-pointer bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">Pagamentos Recebidos</h2>
              <p className="text-gray-600">{payments.length === 0 ? 'Você ainda não recebeu nenhum pagamento.' : `${payments.length} pagamentos recebidos.`}</p>
            </div>
            <div onClick={() => setActiveView('profile')} className="cursor-pointer bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">Meus Dados</h2>
              <p className="text-gray-600">Ver e atualizar suas informações.</p>
            </div>
            <div onClick={() => setActiveView('paymentPage')} className="cursor-pointer bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">Minha Página de Pagamento</h2>
              <p className="text-gray-600">Gerenciar sua página pública e conexão Stripe.</p>
            </div>
          </div>
        )}

        {activeView === 'payments' && <PagamentosRecebidosView payments={payments} />}

        {activeView === 'profile' && <MeusDadosView profile={profile} onUpdate={handleProfileUpdate} />}

        {activeView === 'paymentPage' && <MinhaPaginaView profile={profile} paymentUrl={paymentUrl} qrCode={qrCode} onConnectStripe={handleConnectStripe} />}

      </main>
    </div>
  );
}