// src/hooks/useMotoristaProfile.ts
import { useState, useEffect, useCallback } from 'react';

interface ProfileData {
  id: string;
  nome: string;
  email: string;
  celular: string;
  tipo: string;
  profissao?: string;
  stripe_account_id?: string;
  stripe_account_status?: string;
  avatar_url?: string;
}

export function useMotoristaProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const resp = await fetch("/api/motorista/profile");
      
      if (!resp.ok) {
        throw new Error("Erro ao buscar perfil");
      }
      
      const data = await resp.json();
      console.log("Profile data loaded:", data);
      
      setProfile(data);
    } catch (err) {
      console.error("Erro:", err);
      setError("Não foi possível carregar seu perfil. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load profile data on component mount
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Function to refresh profile data manually
  const refreshProfile = useCallback(() => {
    return fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refreshProfile
  };
}