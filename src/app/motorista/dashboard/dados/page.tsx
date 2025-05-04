// src/app/motorista/dashboard/dados/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
// import AvatarUpload from "@/components/AvatarUpload"; // Remove old component import
import AvatarGridSelector from "@/components/AvatarGridSelector"; // Import the new grid selector

// Define Profile type (ensure it matches the one used elsewhere)
type Profile = {
  id: string;
  nome?: string;
  email?: string;
  celular: string;
  profissao?: string;
  avatar_url?: string | null;
  stripe_account_id?: string | null;
  stripe_account_status?: "pending" | "verified" | "restricted" | null;
  // Add other relevant fields
};

// --- MeusDadosView Component Logic (adapted for page context) ---
export default function MeusDadosPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  // Include avatar_url in form state to track changes
  const [formState, setFormState] = useState({ nome: "", profissao: "", avatar_url: null as string | null });
  const [stripeLoginLink, setStripeLoginLink] = useState<string | null>(null);
  const [loadingStripeLink, setLoadingStripeLink] = useState(false);

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
    if (!profile) return { text: "Carregando...", color: "text-gray-500", icon: "⚪" };

    if (!profile.stripe_account_id) {
      return { text: "Não conectada", color: "text-red-600", icon: "🔴" };
    }

    switch (profile.stripe_account_status) {
      case "verified":
        return { text: "Verificada", color: "text-green-600", icon: "🟢" };
      case "pending":
        return { text: "Pendente", color: "text-yellow-600", icon: "🟡" };
      case "restricted":
        return { text: "Restrita", color: "text-red-600", icon: "🔴" };
      default:
        // Treat null or unknown status as 'Verificando...'
        return { text: "Verificando...", color: "text-yellow-600", icon: "🟡" };
    }
  };

  const stripeStatus = getStripeStatusDisplay();

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
            </button>
          </div>
        )}
      </div>

      {/* Edit/Save Buttons */}
      <div className="mt-6">
        {isEditing ? (
          <div className="flex space-x-3">
            <button
              onClick={handleUpdate}
              disabled={loading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar Alterações"}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                // Reset form state to original profile data if canceling
                setFormState({
                  nome: profile.nome || "",
                  profissao: profile.profissao || "",
                  avatar_url: profile.avatar_url || null,
                });
              }}
              disabled={loading}
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
}

