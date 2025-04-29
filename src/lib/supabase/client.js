/* ──────────────────────────────────────────────────────────────
   src/lib/supabase/client.js
   ———————————————————————————————————————————————————————— */
import { createClient } from '@supabase/supabase-js';

/*──────────────── VARIÁVEIS DE AMBIENTE ────────────────*/
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/*──────────────── CLIENTES ─────────────────────────────*/
export const supabase = createClient(supabaseUrl, supabaseAnonKey);               // browser
export const supabaseServer = createClient(                                        // API / server
  supabaseUrl,
  supabaseServiceKey ?? supabaseAnonKey
);

/*──────────────── AUTENTICAÇÃO (e-mail) ───────────────*/
export const signUp = (email, password, userData) =>
  supabase.auth.signUp({ email, password, options: { data: userData } });

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

/*──────────────── TELEFONE / OTP ───────────────────────*/
export const storeVerificationCode = (phone, code, minutes = 10) =>
  supabase.from('verification_codes').upsert({
    phone,
    code,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + minutes * 60_000).toISOString()
  });

export const verifyCode = (phone, code) =>
  supabase
    .from('verification_codes')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .single();

export const deleteVerificationCode = (phone) =>
  supabase.from('verification_codes').delete().eq('phone', phone);

/*──────────────── DRIVER via TELEFONE ─────────────────*/
export const createDriverWithPhone = async (phone, userData) => {
  const sanitized = phone.replace(/\D/g, '');
  const email = `${sanitized}@pixter.temp`;
  const password = `${Math.random().toString(36).slice(-10)}${Math.random()
    .toString(36)
    .slice(-10)}`;

  /* 1) cria usuário Auth */
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    phone,
    options: { data: { tipo: 'motorista', phone } }
  });
  if (authError) return { error: authError };

  const userId = authData.user?.id;
  if (!userId) return { error: new Error('Falha ao criar usuário') };

  /* 2) cria perfil */
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

  /* 3) login automático */
  const { data: session, error: sessionError } =
    await supabase.auth.signInWithPassword({ email, password });
  if (sessionError) return { error: sessionError };

  return { data: { user: authData.user, session, password }, error: null };
};

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

/*──────────────── UTIL / DB / STORAGE ────────────────*/
export function formatPhoneNumber(phone, code = '55') {
  const p = phone.replace(/\D/g, '');
  return p.startsWith(code) ? `+${p}` : `+${code}${p}`;
}

export const getProfile = (id) =>
  supabase.from('profiles').select('*').eq('id', id).single();

export const updateProfile = (id, updates) =>
  supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

export const uploadImage = (bucket, path, file) =>
  supabase.storage.from(bucket).upload(path, file, { upsert: true });

export const getImageUrl = (bucket, path) =>
  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
