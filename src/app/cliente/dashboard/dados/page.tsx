// src/app/cliente/dashboard/dados/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
// Assuming these functions exist and work client-side, or need to be created/adjusted
// For now, we will assume placeholder API calls for password change and account deletion

interface ProfileData {
  nome: string;
  email: string;
  celular: string;
  // Add other fields as necessary
}

export default function MeusDadosClientePage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [errorProfile, setErrorProfile] = useState<string | null>(null);
  const [successProfile, setSuccessProfile] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState<string | null>(null);
  const [successPassword, setSuccessPassword] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [errorDelete, setErrorDelete] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (status === "authenticated" && session?.user?.id) {
        try {
          setLoadingProfile(true);
          setErrorProfile(null);
          // TODO: Replace with actual API endpoint for fetching client data
          const response = await fetch(`/api/cliente/profile`); // Example API endpoint
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || "Erro ao carregar dados do perfil.");
          }
          const data = await response.json();
          setProfileData(data.user || { nome: session.user.name, email: session.user.email, celular: "" });
        } catch (err: any) {
          setErrorProfile(err.message || "Erro ao carregar dados do perfil.");
          console.error(err);
        } finally {
          setLoadingProfile(false);
        }
      }
    }
    if (status === "authenticated") {
      fetchProfile();
    } else if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/cliente/dashboard/dados");
    }
  }, [session, status, router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !profileData) return;

    setLoadingProfile(true);
    setErrorProfile(null);
    setSuccessProfile(null);

    try {
      const updates = {
        nome: profileData.nome,
        // celular: profileData.celular, // If celular is updatable
      };
      // TODO: Replace with actual API endpoint for updating client data
      const response = await fetch(`/api/cliente/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Erro ao atualizar dados.");
      }
      setSuccessProfile("Dados atualizados com sucesso!");
      // Optionally update session if name changes and it's stored there
      if (session.user.name !== updates.nome) {
        await updateSession({ ...session, user: { ...session.user, name: updates.nome } });
      }
    } catch (err: any) {
      setErrorProfile(err.message || "Erro ao atualizar dados.");
      console.error(err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleChangeProfile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev!, [name]: value }));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPassword(null);
    setSuccessPassword(null);

    if (newPassword !== confirmNewPassword) {
      setErrorPassword("As novas senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) { // Example: Basic validation
        setErrorPassword("A nova senha deve ter pelo menos 6 caracteres.");
        return;
    }

    setLoadingPassword(true);
    try {
      // TODO: Replace with actual API endpoint for changing password
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Erro ao alterar senha.");
      }
      setSuccessPassword("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      setErrorPassword(err.message || "Erro ao alterar senha. Verifique sua senha atual.");
      console.error(err);
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    setLoadingDelete(true);
    setErrorDelete(null);
    try {
      // TODO: Replace with actual API endpoint for deleting account
      const response = await fetch("/api/user/delete-account", {
        method: "DELETE",
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Erro ao excluir conta.");
      }
      await signOut({ redirect: false });
      router.push("/?accountDeleted=true"); // Redirect to home with a success message
    } catch (err: any) {
      setErrorDelete(err.message || "Erro ao excluir conta.");
      console.error(err);
    } finally {
      setLoadingDelete(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && loadingProfile && !profileData)) {
    return <div className="p-6 text-center">Carregando seus dados...</div>;
  }

  if (status === "unauthenticated") {
    return <div className="p-6 text-center">Redirecionando para login...</div>;
  }

  if (!profileData && !loadingProfile) {
    return <div className="p-6 text-red-500 text-center">{errorProfile || "Não foi possível carregar os dados do seu perfil."}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-8">
        {/* Profile Information Section */}
        <div className="bg-white shadow-md rounded-lg p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Meus Dados</h1>
          {errorProfile && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">{errorProfile}</p>}
          {successProfile && <p className="mb-4 text-sm text-green-600 bg-green-50 p-3 rounded-md">{successProfile}</p>}
          {profileData && (
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  id="nome"
                  name="nome"
                  value={profileData.nome || ""}
                  onChange={handleChangeProfile}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                  disabled={loadingProfile}
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={profileData.email || ""}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="celular" className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
                <input
                  type="text"
                  id="celular"
                  name="celular"
                  value={profileData.celular || ""}
                  disabled // Or make it updatable if your system allows
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed sm:text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loadingProfile}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingProfile ? "Salvando..." : "Salvar Alterações"}
              </button>
            </form>
          )}
        </div>

        {/* Change Password Section */}
        <div className="bg-white shadow-md rounded-lg p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-6">Alterar Senha</h2>
          {errorPassword && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">{errorPassword}</p>}
          {successPassword && <p className="mb-4 text-sm text-green-600 bg-green-50 p-3 rounded-md">{successPassword}</p>}
          <form onSubmit={handleChangePassword} className="space-y-6">
            <div>
              <label htmlFor="currentPassword"className="block text-sm font-medium text-gray-700 mb-1">Senha Atual</label>
              <input type="password" id="currentPassword" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm" disabled={loadingPassword} />
            </div>
            <div>
              <label htmlFor="newPassword"className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
              <input type="password" id="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm" disabled={loadingPassword} />
            </div>
            <div>
              <label htmlFor="confirmNewPassword"className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
              <input type="password" id="confirmNewPassword" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm" disabled={loadingPassword} />
            </div>
            <button type="submit" disabled={loadingPassword} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed">
              {loadingPassword ? "Alterando..." : "Alterar Senha"}
            </button>
          </form>
        </div>

        {/* Delete Account Section */}
        <div className="bg-white shadow-md rounded-lg p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-red-700 mb-4">Excluir Conta</h2>
          {errorDelete && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">{errorDelete}</p>}
          <p className="text-sm text-gray-600 mb-6">
            Esta ação é irreversível. Todos os seus dados associados à sua conta Pixter serão permanentemente apagados.
          </p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loadingDelete}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingDelete ? "Excluindo..." : "Excluir Minha Conta"}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 max-w-md w-full">
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-2">Confirmar Exclusão de Conta</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tem certeza de que deseja excluir sua conta permanentemente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex flex-col sm:flex-row-reverse gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={loadingDelete}
                className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm disabled:opacity-50"
              >
                {loadingDelete ? "Excluindo..." : "Sim, Excluir Conta"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loadingDelete}
                className="w-full sm:w-auto mt-3 sm:mt-0 inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

