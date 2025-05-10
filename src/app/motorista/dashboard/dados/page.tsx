// src/app/motorista/dashboard/dados/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AvatarGridSelector from "@/components/AvatarGridSelector";

// Define Profile type
type Profile = {
  id: string;
  nome?: string;
  email?: string;
  celular: string;
  profissao?: string;
  avatar_url?: string | null;
  stripe_account_id?: string | null;
  stripe_account_status?: "pending" | "verified" | "restricted" | null;
};

// Define form state type
type FormState = {
  nome: string;
  profissao: string;
  avatar_url: string | null;
};

// Define stripe status type
type StripeStatus = {
  status: string | null;
  accountLink: string | null;
  requirements: {
    currently_due?: string[];
  } | null;
};

export default function MeusDadosPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<FormState>({ 
    nome: "", 
    profissao: "", 
    avatar_url: null 
  });
  const [stripeAccountStatus, setStripeAccountStatus] = useState<StripeStatus>({ 
    status: null, 
    accountLink: null, 
    requirements: null 
  });
  const [loadingStripeStatus, setLoadingStripeStatus] = useState(false);

  // Fetch Stripe status
  const fetchStripeStatus = async () => {
    if (!profile?.stripe_account_id) return;
    
    setLoadingStripeStatus(true);
    try {
      const resp = await fetch("/api/motorista/stripe");
      if (resp.ok) {
        const data = await resp.json();
        setStripeAccountStatus({
          status: data.status,
          accountLink: data.accountLink || data.loginLink,
          requirements: data.requirements || null
        });
      }
    } catch (err) {
      console.error("Error fetching Stripe status:", err);
    } finally {
      setLoadingStripeStatus(false);
    }
  };

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const profileRes = await fetch("/api/motorista/profile");
        if (!profileRes.ok) {
          if (profileRes.status === 401) {
            router.push("/motorista/login");
            return;
          }
          const errorData = await profileRes.json().catch(() => ({})); // Try to parse error
          throw new Error(errorData.error || `Erro ao carregar perfil (${profileRes.status})`);
        }
        const profileData: Profile = await profileRes.json();
        setProfile(profileData);
        // Initialize form state with fetched data
        setFormState({
          nome: profileData.nome || "",
          profissao: profileData.profissao || "",
          avatar_url: profileData.avatar_url || null,
        });
      } catch (err: any) {
        console.error("Erro ao carregar perfil:", err);
        setError(err.message || "Não foi possível carregar seus dados.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  // Fetch Stripe status when profile changes
  useEffect(() => {
    if (profile?.stripe_account_id) {
      fetchStripeStatus();
    }
  }, [profile?.stripe_account_id]);

  // Handle profile updates (including avatar)
  const handleUpdate = async () => {
    if (!profile) return;
    setLoading(true);
    setError("");
    try {
      // Prepare only the fields that are being edited
      const updates: { nome?: string; profissao?: string; avatar_url?: string | null } = {};
      if (formState.nome !== profile.nome) {
        updates.nome = formState.nome;
      }
      if (formState.profissao !== profile.profissao) {
        updates.profissao = formState.profissao;
      }
      if (formState.avatar_url !== profile.avatar_url) {
        updates.avatar_url = formState.avatar_url;
      }

      // Only send request if there are actual changes
      if (Object.keys(updates).length === 0) {
        setIsEditing(false);
        setLoading(false);
        return;
      }

      const response = await fetch("/api/motorista/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates), // Send only changed fields
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falha ao atualizar perfil.");
      }

      const result = await response.json();
      if (result.success && result.profile) {
        setProfile(result.profile); // Update profile state with returned data
        // Update form state to match the saved profile
        setFormState({
          nome: result.profile.nome || "",
          profissao: result.profile.profissao || "",
          avatar_url: result.profile.avatar_url || null,
        });
      } else {
        // Fallback: Re-fetch profile if PUT doesn't return full updated data
        const profileRes = await fetch("/api/motorista/profile");
        const profileData: Profile = await profileRes.json();
        setProfile(profileData);
        setFormState({
          nome: profileData.nome || "",
          profissao: profileData.profissao || "",
          avatar_url: profileData.avatar_url || null,
        });
      }
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || "Falha ao atualizar perfil.");
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes for text fields
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  // Handle avatar selection from the grid
  const handleAvatarSelect = (newAvatarUrl: string) => {
    // Update the form state immediately when an avatar is selected
    setFormState((prev) => ({ ...prev, avatar_url: newAvatarUrl }));
    // If not in editing mode, switch to editing mode to allow saving
    if (!isEditing) {
        setIsEditing(true);
    }
  };

  // Get Stripe Login Link
  const getStripeLoginLink = async () => {
    if (!profile?.stripe_account_id) return;
    setLoadingStripeLink(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/create-login-link");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao obter link do Stripe.");
      }
      const { url } = await res.json();
      setStripeLoginLink(url);
      if (url) {
        window.open(url, "_blank");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingStripeLink(false);
    }
  };

  // Stripe Status Display Logic (Uses stripe_account_status from profile)
  const getStripeStatusDisplay = () => {
    if (!profile?.stripe_account_id) {
      return {
        text: "Não conectado",
        color: "red",
        icon: "warning",
      };
    }

    if (!profile?.stripe_account_status) {
      return {
        text: "Verificando status...",
        color: "yellow",
        icon: "clock",
      };
    }

    switch (profile.stripe_account_status) {
      case "verified":
        return {
          text: "Verificado",
          color: "green",
          icon: "check",
        };
      case "restricted":
        return {
          text: "Restrito",
          color: "red",
          icon: "warning",
        };
      default:
        return {
          text: "Pendente",
          color: "yellow",
          icon: "clock",
        };
    }
  };

  const statusDisplay = getStripeStatusDisplay();

  if (loading && !profile) return <div className="p-6 text-center">Carregando dados...</div>;
  if (error && !profile) return <div className="p-6 text-red-500">Erro: {error}</div>;
  if (!profile) return <div className="p-6">Não foi possível carregar o perfil.</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Meus Dados</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Avatar Selection Section - Use AvatarGridSelector */}
      {/* Show selector always, but disable interaction if not editing? Or show static image if not editing? */} 
      {/* Let's show the grid selector always, but clicking only updates state if editing is enabled or triggers edit mode */}
      <AvatarGridSelector
        // Use formState.avatar_url to reflect selection before saving
        currentAvatarUrl={formState.avatar_url}
        onSelect={handleAvatarSelect}
        loading={loading} // Disable grid clicks while saving
      />

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nome</label>
          {isEditing ? (
            <input
              type="text"
              name="nome"
              value={formState.nome}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              disabled={loading}
            />
          ) : (
            <p className="text-gray-900 mt-1">{profile.nome || "-"}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <p className="text-gray-900 mt-1">{profile.email || "-"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">WhatsApp</label>
          <p className="text-gray-900 mt-1">{profile.celular}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Profissão</label>
          {isEditing ? (
            <input
              type="text"
              name="profissao"
              value={formState.profissao}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              disabled={loading}
            />
          ) : (
            <p className="text-gray-900 mt-1">{profile.profissao || "-"}</p>
          )}
        </div>

        {/* Stripe Status Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Status Conta Stripe</label>
          <p className={`mt-1 font-medium ${stripeStatus.color}`}>
            {stripeStatus.icon} {stripeStatus.text}
          </p>
        </div>

        {/* Stripe Dashboard Link */}
        {profile.stripe_account_id && (
          <div>
            <button
              onClick={getStripeLoginLink}
              disabled={loadingStripeLink}
              className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingStripeLink ? "Gerando link..." : "Acessar painel Stripe"}
        {isEditing ? (
          <input
            type="text"
            name="nome"
            value={formState.nome}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={loading}
          />
        ) : (
          <p className="text-gray-900 mt-1">{profile.nome || "-"}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <p className="text-gray-900 mt-1">{profile.email || "-"}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">WhatsApp</label>
        <p className="text-gray-900 mt-1">{profile.celular}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Profissão</label>
        {isEditing ? (
          <input
            type="text"
            name="profissao"
            value={formState.profissao}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={loading}
          />
        ) : (
          <p className="text-gray-900 mt-1">{profile.profissao || "-"}</p>
        )}
      </div>

      {/* Stripe Status Section */}
      <div>
        {/* Stripe Account Status */}
        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Status da Conta Stripe</h3>
          {!profile.stripe_account_id ? (
            <div>
              <div className="bg-white p-4 rounded-lg mb-4 border border-red-200">
                <p className="text-red-600 mb-4">
                  Para receber pagamentos dos seus clientes, você precisa conectar uma conta Stripe
                </p>
                <button
                  onClick={() =>
                    fetch("/api/motorista/stripe", { method: "POST" })
                      .then((r) => r.json())
                      .then((data) => {
                        if (data.url) window.location.href = data.url;
                      })
                  }
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 w-full"
                >
                  Conectar Stripe para Receber Pagamentos
                </button>
              </div>
              <p className="text-sm text-gray-500">
                A Stripe é nossa parceira de pagamentos, garantindo transferências seguras e rápidas para sua conta bancária.
              </p>
            </div>
          ) : loadingStripeStatus ? (
            <div className="flex items-center justify-center py-4">
              <svg
                className="animate-spin h-5 w-5 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="ml-2">Carregando status...</span>
            </div>
            ) : (
              <div>
                {stripeAccountStatus.status === "verified" ? (
                  <div className="bg-white p-4 rounded-lg border border-green-200">
                    <div className="flex items-center text-green-600 mb-4">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">Sua conta Stripe está verificada</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">Você já pode receber pagamentos e transferir o dinheiro para sua conta bancária.</p>
                    {stripeStatus.accountLink && (
                      <a
                        href={stripeStatus.accountLink}
                        className="block w-full text-center bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Acessar Dashboard Stripe
                      </a>
                    )}
                  </div>
                ) : stripeAccountStatus.status === "restricted" ? (
                  <div className="bg-white p-4 rounded-lg border border-red-200">
                    <div className="flex items-center text-red-600 mb-4">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">Atenção: Sua conta precisa de atualizações</span>
                    </div>
                    {stripeAccountStatus.requirements && (
                      <div className="bg-red-50 p-4 rounded-lg mb-4">
                        <p className="font-medium text-red-800 mb-2">Pendências a resolver:</p>
                        <ul className="list-disc list-inside text-sm text-red-700">
                          {stripeAccountStatus.requirements.currently_due?.map((item: string) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {stripeStatus.accountLink && (
                      <a
                        href={stripeStatus.accountLink}
                        className="block w-full text-center bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Resolver Pendências
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-lg border border-yellow-200">
                    <div className="flex items-center text-yellow-600 mb-4">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">Verificação em andamento</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">Complete a verificação da sua conta para começar a receber pagamentos.</p>
                    {stripeStatus.accountLink && (
                      <a
                        href={stripeStatus.accountLink}
                        className="block w-full text-center bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Completar Verificação
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

    </div>
  ) : (
    <button
      onClick={() => setIsEditing(true)}
      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
    >
      Editar Dados
    </button>
  )}
</div>

<div>
  <label className="block text-sm font-medium text-gray-700">Email</label>
  <p className="text-gray-900 mt-1">{profile.email || "-"}</p>
</div>
<div>
  <label className="block text-sm font-medium text-gray-700">WhatsApp</label>
  <p className="text-gray-900 mt-1">{profile.celular}</p>
</div>
<div>
  <label className="block text-sm font-medium text-gray-700">Profissão</label>
  {isEditing ? (
    <input
      type="text"
      name="profissao"
      value={formState.profissao}
      onChange={handleChange}
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      disabled={loading}
    />
  ) : (
    <p className="text-gray-900 mt-1">{profile.profissao || "-"}</p>
  )}
</div>

{/* Stripe Status Section */}
<div>
  {/* Stripe Account Status */}
  <div className="mt-6 p-4 border rounded-lg bg-gray-50">
    <h3 className="text-lg font-semibold mb-4">Status da Conta Stripe</h3>
    {!profile.stripe_account_id ? (
      <div>
        <div className="bg-white p-4 rounded-lg mb-4 border border-red-200">
          <p className="text-red-600 mb-4">
            Para receber pagamentos dos seus clientes, você precisa conectar uma conta Stripe
          </p>
          <button
            onClick={() =>
              fetch("/api/motorista/stripe", { method: "POST" })
                .then((r) => r.json())
                .then((data) => {
                  if (data.url) window.location.href = data.url;
                })
            }
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 w-full"
          >
            Conectar Stripe para Receber Pagamentos
          </button>
        </div>
        <p className="text-sm text-gray-500">
          A Stripe é nossa parceira de pagamentos, garantindo transferências seguras e rápidas para sua conta bancária.
        </p>
      </div>
    ) : loadingStripeStatus ? (
      <div className="flex items-center justify-center py-4">
        <svg
          className="animate-spin h-5 w-5 text-gray-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span className="ml-2">Carregando status...</span>
      </div>
    ) : (
      <div>
        {stripeStatus.status === "verified" ? (
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <div className="flex items-center text-green-600 mb-4">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Sua conta Stripe está verificada</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">Você já pode receber pagamentos e transferir o dinheiro para sua conta bancária.</p>
            {stripeStatus.accountLink && (
              <a
                href={stripeStatus.accountLink}
                className="block w-full text-center bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                target="_blank"
                rel="noopener noreferrer"
              >
                Acessar Dashboard Stripe
              </a>
            )}
          </div>
        ) : stripeStatus.status === "restricted" ? (
          <div className="bg-white p-4 rounded-lg border border-red-200">
            <div className="flex items-center text-red-600 mb-4">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Atenção: Sua conta precisa de atualizações</span>
            </div>
            {stripeStatus.requirements && (
              <div className="bg-red-50 p-4 rounded-lg mb-4">
                <p className="font-medium text-red-800 mb-2">Pendências a resolver:</p>
                <ul className="list-disc list-inside text-sm text-red-700">
                  {stripeStatus.requirements.currently_due?.map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {stripeStatus.accountLink && (
              <a
                href={stripeStatus.accountLink}
                className="block w-full text-center bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                target="_blank"
                rel="noopener noreferrer"
              >
                Resolver Pendências
              </a>
            )}
          </div>
        ) : (
          <div className="bg-white p-4 rounded-lg border border-yellow-200">
            <div className="flex items-center text-yellow-600 mb-4">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Verificação em andamento</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">Complete a verificação da sua conta para começar a receber pagamentos.</p>
            {stripeStatus.accountLink && (
              <a
                href={stripeStatus.accountLink}
                className="block w-full text-center bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
                target="_blank"
                rel="noopener noreferrer"
              >
                Completar Verificação
              </a>
            )}
          </div>
        )}
      </div>
    )}
  </div>
</div>
);
