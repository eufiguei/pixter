/* ──────────────────────────────────────────────────────────────
   src/lib/supabase/client.js
   ———————————————————————————————————————————————————————— */
   import { createClient } from '@supabase/supabase-js';

   /*────────── VARIÁVEIS DE AMBIENTE ──────────*/
   const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL;
   const supabaseAnonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
   const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
   
   /*────────── CLIENTES ───────────────────────*/
   // Navegador (ANON)
   export const supabase = createClient(supabaseUrl, supabaseAnonKey);
   
   // Backend (Service-Role se existir)
   export const supabaseServer = createClient(
     supabaseUrl,
     supabaseServiceKey ?? supabaseAnonKey
   );
   
   // Admin API (crear usuários sem limite de e-mail)
   export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
   
   /*────────── DRIVER via TELEFONE ───────────*/
   export const createDriverWithPhone = async (phone, userData) => {
     const sanitized = phone.replace(/\D/g, '');
   
     /* ─ 0. Dup-check auth.users ───────────────────────── */
     const findBy = (field, value) =>
       supabaseAdmin.from('auth.users').select('id').eq(field, value).maybeSingle();
   
     const emailProvided =
       userData.email && userData.email.trim() !== '' ? userData.email.trim() : null;
   
     if ((await findBy('phone', phone)).data) {
       return { error: new Error('phone_exists') }; // nº já cadastrado
     }
     if (emailProvided && (await findBy('email', emailProvided)).data) {
       return { error: new Error('email_exists') }; // e-mail já usado
     }
   
     /* ─ 1. Define e-mail + senha ─────────────────────── */
     const email =
       emailProvided ?? `${sanitized}-${Date.now()}@pixter-temp.com`; // único
     const password =
       Math.random().toString(36).slice(-10) +
       Math.random().toString(36).slice(-10);
   
     /* ─ 2. Cria usuário (Admin API) ──────────────────── */
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
   
     const userId = authData.user?.id;
     if (!userId) return { error: new Error('Falha ao criar usuário') };
   
     /* ─ 3. Insere/atualiza perfil (Service-Role) ─────── */
     const profilePayload = {
       id: userId,
       celular: phone,
       tipo: 'motorista',
       nome: userData.nome,
       ...userData,                    // cpf, data_nascimento, avatar_index…
       created_at: new Date().toISOString(),
       updated_at: new Date().toISOString()
     };
   
     const { error: profErr } = await supabaseServer
       .from('profiles')
       .upsert(profilePayload);
     if (profErr) return { error: profErr };
   
     /* ─ 4. Login automático (opcional) ───────────────── */
     const { data: session, error: sessErr } =
       await supabase.auth.signInWithPassword({ email, password });
     if (sessErr) return { error: sessErr };
   
     return { data: { user: authData.user, session }, error: null };
   };
   
   /*────────── sign-in OTP por telefone ──────*/
   export const signInWithPhone = (phone) => {
     const email = `${phone.replace(/\D/g, '')}@pixter-temp.com`;
     return supabase.auth.signInWithOtp({ email });
   };
   
   /*────────── util + CRUD perfil/storage ─────*/
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
   