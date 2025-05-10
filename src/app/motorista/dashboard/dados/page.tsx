"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AvatarGridSelector from "@/components/AvatarGridSelector";

type Profile = {
  id: string;
  nome: string;
  email: string;
  celular: string;
  profissao: string;
  avatar_url: string | null;
  stripe_account_id: string | null;
  stripe_account_status: string | null;
};

type FormState = {
  nome: string;
  profissao: string;
  avatar_url: string | null;
};

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
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<FormState>({ 
    nome: "", 
    profissao: "", 
    avatar_url: null 
  });
  const [stripeStatus, setStripeStatus] = useState<StripeStatus>({ 
    status: null, 
    accountLink: null, 
    requirements: null 
  });
  const [loadingStripeStatus, setLoadingStripeStatus] = useState(false);
  const [loadingStripeLink, setLoadingStripeLink] = useState(false);

  // Fetch Stripe account status
  const fetchStripeStatus = async () => {
    if (!profile?.stripe_account_id) return;
    
    try {
      setLoadingStripeStatus(true);
      const resp = await fetch("/api/motorista/stripe");
      if (resp.ok) {
        const data = await resp.json();
        setStripeStatus({
          status: data.status,
          accountLink: data.accountLink || data.loginLink,
          requirements: data.requirements || null
        });
      } else {
        console.error("Erro ao buscar status do Stripe");
      }
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoadingStripeStatus(false);
    }
  };

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const resp = await fetch("/api/motorista/profile");
        
        if (!resp.ok) {
          throw new Error("Erro ao buscar perfil");
        }
        
        const data = await resp.json();
        setProfile(data);
        setFormState({
          nome: data.nome || "",
          profissao: data.profissao || "",
          avatar_url: data.avatar_url
        });
      } catch (err) {
        console.error("Erro:", err);
        setError("Não foi possível carregar seu perfil. Tente novamente mais tarde.");
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
  }, [profile]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const resp = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: formState.nome,
          profissao: formState.profissao,
          avatar_url: formState.avatar_url,
        }),
      });
      
      if (!resp.ok) {
        throw new Error("Erro ao atualizar perfil");
      }
      
      const updatedProfile = await resp.json();
      setProfile(updatedProfile);
      setIsEditing(false);
    } catch (err) {
      console.error("Erro:", err);
      setError("Não foi possível atualizar seu perfil. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  // Handle canceling edit mode
  const handleCancel = () => {
    setIsEditing(false);
    
    // Reset form to current profile values
    if (profile) {
      setFormState({
        nome: profile.nome || "",
        profissao: profile.profissao || "",
        avatar_url: profile.avatar_url
      });
    }
  };

  // Get Stripe login link
  const getStripeLoginLink = async () => {
    if (!profile?.stripe_account_id) return;
    
    try {
      setLoadingStripeLink(true);
      const resp = await fetch("/api/motorista/stripe/login");
      
      if (resp.ok) {
        const data = await resp.json();
        if (data.url) {
          window.open(data.url, "_blank");
        }
      } else {
        console.error("Erro ao gerar link do Stripe");
      }
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoadingStripeLink(false);
    }
  };

  // Status display helpers
  const getStatusDisplay = () => {
    if (!profile) return { text: "", color: "", icon: "" };
    
    if (!profile.stripe_account_id) {
      return {
        text: "Conta não conectada",
        color: "text-red-600",
        icon: "⚠️",
      };
    }
    
    switch (profile.stripe_account_status) {
      case "verified":
        return {
          text: "Verificado",
          color: "text-green-600",
          icon: "✅",
        };
      case "restricted":
        return {
          text: "Requer atenção",
          color: "text-orange-600",
          icon: "⚠️",
        };
      case "pending":
        return {
          text: "Verificação pendente",
          color: "text-yellow-600",
          icon: "⏳",
        };
      default:
        return {
          text: "Status desconhecido",
          color: "text-gray-600",
          icon: "❓",
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  if (loading && !profile) {
    return <div className="p-6 text-center">Carregando dados...</div>;
  }
  
  if (error && !profile) {
    return <div className="p-6 text-red-500">Erro: {error}</div>;
  }
  
  if (!profile) {
    return <div className="p-6">Não foi possível carregar o perfil.</div>;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Meus Dados</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="space-y-6">
        {/* Avatar Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Avatar</label>
          <AvatarGridSelector
            currentAvatarUrl={formState.avatar_url}
            onSelect={(url) => handleChange({ target: { name: "avatar_url", value: url } })}
            loading={!isEditing || loading}
          />
        </div>

        {/* Name Field */}
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

        {/* Email Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <p className="text-gray-900 mt-1">{profile.email || "-"}</p>
        </div>

        {/* Phone Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700">WhatsApp</label>
          <p className="text-gray-900 mt-1">{profile.celular}</p>
        </div>

        {/* Profession Field */}
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
                          {stripeStatus.requirements.currently_due?.map((item) => (
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

          {/* Stripe Dashboard Link */}
          {profile?.stripe_account_id && (
            <div className="mt-2 text-center">
              <button
                onClick={getStripeLoginLink}
                disabled={loadingStripeLink}
                className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingStripeLink ? "Gerando link..." : "Acessar painel Stripe"}
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end">
          {isEditing ? (
            <div className="flex gap-4">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}