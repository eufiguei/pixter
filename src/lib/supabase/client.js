/* ──────────────────────────────────────────────────────────────
   src/lib/supabase/client.js   〈JS puro〉
   ———————————————————————————————————————————————————————— */

// 1. Importa o SDK
import { createClient } from '@supabase/supabase-js';

/*──────────────────── VARIÁVEIS DE AMBIENTE ───────────────────*/
const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/*──────────────────── CLIENTES SUPABASE ───────────────────────*/

// • Client para uso no **backend** (rotas / server actions)
export const supabaseServer = createClient(
  supabaseUrl,
  // → use SERVICE_ROLE se estiver disponível; caso contrário, ANON
  supabaseServiceKey ?? supabaseAnonKey
);

// • Client para uso no **front-end**
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/*──────────────────── FUNÇÕES DE AUTENTICAÇÃO ─────────────────*/

// Cadastro por e-mail
export const signUp = async (email, password, userData) => {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: userData }
  });
};

// Login por e-mail
export const signIn = async (email, password) => {
  return supabase.auth.signInWithPassword({ email, password });
};

// Logout
export const signOut = async () => {
  return supabase.auth.signOut();
};

/*──────────────── TELEFONE (OTP) ────────────────*/
export const storeVerificationCode = async (
  phone,
  code,
  expiresInMinutes = 10
) => {
  return supabase
    .from('verification_codes')
    .upsert({
      phone,
      code,
      created_at: new Date().toISOString(),
      expires_at: new Date(
        Date.now() + expiresInMinutes * 60 * 1000
      ).toISOString()
    });
};

export const verifyCode = async (phone, code) => {
  return supabase
    .from('verification_codes')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .single();
};

export const deleteVerificationCode = async (phone) => {
  return supabase.from('verification_codes').delete().eq('phone', phone);
};

/*──────────── UTILITÁRIOS e DB / STORAGE ────────────*/

// Formata +55 XXXXXXXXXXX
export function formatPhoneNumber(phone, countryCode = '55') {
  const clean = phone.replace(/\D/g, '');
  return clean.startsWith(countryCode) ? `+${clean}` : `+${countryCode}${clean}`;
}

// CRUD de profile
export const getProfile = (id) =>
  supabase.from('profiles').select('*').eq('id', id).single();

export const updateProfile = (id, updates) =>
  supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

// Upload & URL
export const uploadImage = (bucket, path, file) =>
  supabase.storage.from(bucket).upload(path, file, { upsert: true });

export const getImageUrl = (bucket, path) =>
  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
