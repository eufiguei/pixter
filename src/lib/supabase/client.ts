/* ──────────────────────────────────────────────────────────────
   src/lib/supabase/client.ts   ←  TypeScript (garante tree-shaking)
   ────────────────────────────────────────────────────────────── */
   import { createClient } from '@supabase/supabase-js';

   /*──────────────── VARIÁVEIS DE AMBIENTE ───────────────*/
   const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
   const supabaseAnonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
   const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
   
   /*──────────────── CLIENTES ────────────────────────────*/
   export const supabase = createClient(supabaseUrl, supabaseAnonKey);          // navegador
   export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey); // API/server
   export const supabaseAdmin  = supabaseServer;  // alias para Admin API
   
   /*──────────────── OTP HELPERS ──────────────────────────*/
   export const storeVerificationCode = (
     phone: string,
     code: string,
     minutes = 10
   ) =>
     supabase
       .from('verification_codes')
       .upsert({
         phone,
         code,
         created_at: new Date().toISOString(),
         expires_at: new Date(Date.now() + minutes * 60_000).toISOString()
       });
   
   export const verifyCode = (phone: string, code: string) =>
     supabase
       .from('verification_codes')
       .select('*')
       .eq('phone', phone)
       .eq('code', code)
       .gt('expires_at', new Date().toISOString())
       .single();
   
   export const deleteVerificationCode = (phone: string) =>
     supabase.from('verification_codes').delete().eq('phone', phone);
   
   /*──────────────── UTIL ────────────────────────────────*/
   export const formatPhoneNumber = (phone: string, code = '55') => {
     const p = phone.replace(/\D/g, '');
     return p.startsWith(code) ? `+${p}` : `+${code}${p}`;
   };
   
   /*──────────────── DRIVER via TELEFONE ─────────────────*/
   export const createDriverWithPhone = async (
     phone: string,
     userData: Record<string, any>
   ) => {
     const sanitized = phone.replace(/\D/g, '');
   
     /* 1. Dup-check */
     const emailProvided =
       userData.email && userData.email.trim() !== ''
         ? userData.email.trim()
         : null;
   
     const dupPhone = await supabaseAdmin
       .from('auth.users')
       .select('id')
       .eq('phone', phone)
       .maybeSingle();
   
     if (dupPhone.data) return { error: new Error('phone_exists') };
   
     if (emailProvided) {
       const dupEmail = await supabaseAdmin
         .from('auth.users')
         .select('id')
         .eq('email', emailProvided)
         .maybeSingle();
       if (dupEmail.data) return { error: new Error('email_exists') };
     }
   
     /* 2. e-mail + senha */
     const email =
       emailProvided ?? `${sanitized}-${Date.now()}@pixter-temp.com`;
     const password =
       Math.random().toString(36).slice(-10) +
       Math.random().toString(36).slice(-10);
   
     /* 3. cria usuário (Admin API) */
     const { data: authData, error: authErr } =
       await supabaseAdmin.auth.admin.createUser({
         email,
         phone,
         password,
         email_confirm: true,
         phone_confirm: true,
         user_metadata: { tipo: 'motorista', phone }
       });
     if (authErr) return { error: authErr };
   
     const userId = authData.user?.id ?? '';
     /* 4. perfil */
     const profilePayload = {
       id: userId,
       celular: phone,
       tipo: 'motorista',
       nome: userData.nome,
       ...userData,
       created_at: new Date().toISOString(),
       updated_at: new Date().toISOString()
     };
   
     const { error: profileErr } = await supabaseServer
       .from('profiles')
       .upsert(profilePayload);
     if (profileErr) return { error: profileErr };
   
     /* 5. login opcional */
     const { data: session, error: sessErr } =
       await supabase.auth.signInWithPassword({ email, password });
     if (sessErr) return { error: sessErr };
   
     return { data: { user: authData.user, session }, error: null };
   };
   
   /*──────────────── sign-in OTP via telefone ────────────*/
   export const signInWithPhone = (phone: string) => {
     const email = `${phone.replace(/\D/g, '')}@pixter-temp.com`;
     return supabase.auth.signInWithOtp({ email });
   };
   
   /*──────────────── CRUD perfil / storage ───────────────*/
   export const getProfile = (id: string) =>
     supabase.from('profiles').select('*').eq('id', id).single();
   
   export const updateProfile = (id: string, updates: Record<string, any>) =>
     supabaseServer
       .from('profiles')
       .update({ ...updates, updated_at: new Date().toISOString() })
       .eq('id', id);
   
   export const uploadImage = (bucket: string, path: string, file: File) =>
     supabase.storage.from(bucket).upload(path, file, { upsert: true });
   
   export const getImageUrl = (bucket: string, path: string) =>
     supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
   