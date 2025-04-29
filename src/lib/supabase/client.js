/* ──────────────────────────────────────────────────────────────
   src/lib/supabase/client.js
   ────────────────────────────────────────────────────────────── */
   import { createClient } from '@supabase/supabase-js';

   /*────────── VARIÁVEIS DE AMBIENTE — NÃO EXPONHA SERVICE ROLE NO FRONT ─────*/
   const supabaseUrl         = process.env.NEXT_PUBLIC_SUPABASE_URL;
   const supabaseAnonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
   const supabaseServiceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
   
   /*────────── CLIENTES ──────────────────────────────────────────────────────*/
   // Navegador
   export const supabase = createClient(supabaseUrl, supabaseAnonKey);
   
   // Backend/API (bypass RLS)
   export const supabaseServer = createClient(
     supabaseUrl,
     supabaseServiceKey ?? supabaseAnonKey
   );
   
   // Admin API — cria usuário sem disparar e-mail / sem rate-limit
   export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
   
   /*────────── AUTENTICAÇÃO E-MAIL (caso use) ───────────────────────────────*/
   export const signUp = (email, password, userData) =>
     supabase.auth.signUp({ email, password, options: { data: userData } });
   
   export const signIn = (email, password) =>
     supabase.auth.signInWithPassword({ email, password });
   
   export const signOut = () => supabase.auth.signOut();
   
   /*────────── OTP — verification_codes ─────────────────────────────────────*/
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

  const email =
    userData.email && userData.email.trim() !== ''
      ? userData.email.trim()
      : `${sanitized}@pixter-temp.com`; // fallback válido .com

  const password =
    Math.random().toString(36).slice(-10) +
    Math.random().toString(36).slice(-10);

  /* 1) — verifica se já existe usuário por e-mail */
  const { data: existing } = await supabaseAdmin.auth.admin.getUserByEmail(email);
  if (existing?.id) {
    // já cadastrado: retorna erro ou inicia login OTP
    return { error: new Error('Usuário já existe. Faça login.') };
  }

  /* 2) — cria usuário via Admin API (não envia e-mail) */
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      phone,
      password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { tipo: 'motorista', phone }
    });
  if (authError) return { error: authError };

  const userId = authData.user?.id;
  if (!userId) return { error: new Error('Falha ao criar usuário') };

  /* 3) — upsert perfil */
  const { error: profileError } = await supabaseServer
    .from('profiles')
    .upsert(
      {
        id: userId,
        celular: phone,
        tipo: 'motorista',
        nome: userData.nome,
        ...userData,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }        // evita duplicate key se já existir
    );

  if (profileError) {
    console.error('PROFILE ERROR →', profileError.message); // <— log detalhado
    return { error: profileError };
  }

  /* 4) — login automático (opcional) */
  const { data: session, error: sessionError } =
    await supabase.auth.signInWithPassword({ email, password });
  if (sessionError) return { error: sessionError };

  return { data: { user: authData.user, session, password }, error: null };
};
   
   export const signInWithPhone = (phone) => {
     const email = `${phone.replace(/\D/g, '')}@pixter-temp.com`;
     return supabase.auth.signInWithOtp({ email });
   };
   
   /*────────── UTIL / PERFIL / STORAGE ──────────────────────────────────────*/
   export const formatPhoneNumber = (phone, code = '55') => {
     const p = phone.replace(/\D/g, '');
     return p.startsWith(code) ? `+${p}` : `+${code}${p}`;
   };
   
   export const getProfile = (id) =>
     supabase.from('profiles').select('*').eq('id', id).single();
   
   export const updateProfile = (id, updates) =>
     supabaseServer
       .from('profiles')
       .update({ ...updates, updated_at: new Date().toISOString() })
       .eq('id', id);
   
   export const uploadImage = (bucket, path, file) =>
     supabase.storage.from(bucket).upload(path, file, { upsert: true });
   
   export const getImageUrl = (bucket, path) =>
     supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
   