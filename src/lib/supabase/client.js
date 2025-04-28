import { createClient } from '@supabase/supabase-js';

/*─────────────────── VARIÁVEIS DE AMBIENTE ──────────────────────*/
const supabaseUrl         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/*───────────────── CLIENTES SUPABASE ────────────────────────────*/
// • Backend (rotas / server actions)
export const supabaseServer = createClient(
  supabaseUrl,
  supabaseServiceKey ?? supabaseAnonKey   // usa SERVICE_ROLE se existir
);

// • Front-end
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/*───────────────── FUNÇÕES DE AUTENTICAÇÃO (e-mail) ────────────*/
export const signUp = (email, password, userData) =>
  supabase.auth.signUp({ email, password, options: { data: userData } });

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

/*──────── TELEFONE (OTP) E MOTORISTA ───────────────────────────*/

// Grava código OTP
export const storeVerificationCode = (phone, code, expiresInMinutes = 10) =>
  supabase.from('verification_codes').upsert({
    phone,
    code,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()
  });

// Valida código OTP
export const verifyCode = (phone, code) =>
  supabase
    .from('verification_codes')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .single();

// Remove código
export const deleteVerificationCode = (phone) =>
  supabase.from('verification_codes').delete().eq('phone', phone);

/*——— cria motorista com telefone (usado em complete-registration) ———*/
export const createDriverWithPhone = async (phone, userData) => {
  const email = `${phone.replace(/\D/g, '')}@pixter.temp`;
  const password =
    Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);

  // 1) cria usuário Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    phone,
    options: { data: { tipo: 'motorista', phone } }
  });
  if (authError) return { error: authError };

  const userId = authData.user?.id;
  if (!userId) return { error: new Error('Falha ao criar usuário') };

  // 2) cria perfil
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      celular: phone,
      tipo: 'motorista',
      nome: userData.nome,
      ...userData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  if (profileError) return { error: profileError };

  // 3) login automático
  const { data: session, error: sessionError } =
    await supabase.auth.signInWithPassword({ email, password });
  if (sessionError) return { error: sessionError };

  return { data: { user: authData.user, session, password }, error: null };
};

/*——— login OTP para motorista ———*/
export const signInWithPhone = async (phone) => {
  const email = `${phone.replace(/\D/g, '')}@pixter.temp`;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('celular', phone)
    .eq('tipo', 'motorista')
    .single();
  if (!profile) return { error: new Error('Motorista não encontrado') };

  return supabase.auth.signInWithOtp({ email });
};

/*──────────── UTILITÁRIOS, DB, STORAGE ─────────────────────────*/

// Formata +55 XXXXXXXXXXX
export function formatPhoneNumber(phone, countryCode = '55') {
  const clean = phone.replace(/\D/g, '');
  return clean.startsWith(countryCode) ? `+${clean}` : `+${countryCode}${clean}`;
}

// Profiles
export const getProfile = (id) =>
  supabase.from('profiles').select('*').eq('id', id).single();

export const updateProfile = (id, updates) =>
  supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

// Storage
export const uploadImage = (bucket, path, file) =>
  supabase.storage.from(bucket).upload(path, file, { upsert: true });

export const getImageUrl = (bucket, path) =>
  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;