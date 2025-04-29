
// src/lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey ?? supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// OTP helpers
export const storeVerificationCode = (phone: string, code: string, minutes = 10) =>
  supabase.from('verification_codes').upsert({
    phone,
    code,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + minutes * 60000).toISOString()
  });

export const verifyCode = (phone: string, code: string) =>
  supabase.from('verification_codes').select('*').eq('phone', phone).eq('code', code)
           .gt('expires_at', new Date().toISOString()).single();

export const deleteVerificationCode = (phone: string) =>
  supabase.from('verification_codes').delete().eq('phone', phone);

// format phone
export const formatPhoneNumber = (phone: string, cc = '55') => {
  const n = phone.replace(/\D/g, '');
  return n.startsWith(cc) ? '+' + n : '+' + cc + n;
};

// create driver with duplicate checks
export const createDriverWithPhone = async (phone: string, userData: any) => {
  const sanitized = phone.replace(/\D/g, '');
  const emailProvided = userData.email?.trim() || null;

  const dupPhone = await supabaseAdmin.from('auth.users').select('id').eq('phone', phone).maybeSingle();
  if (dupPhone.data) return { error: new Error('phone_exists') };

  if (emailProvided) {
    const dupEmail = await supabaseAdmin.from('auth.users').select('id').eq('email', emailProvided).maybeSingle();
    if (dupEmail.data) return { error: new Error('email_exists') };
  }

  const email = emailProvided ?? `${sanitized}-${Date.now()}@pixter-temp.com`;
  const password = Math.random().toString(36).slice(-10)+Math.random().toString(36).slice(-10);

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email, phone, password, email_confirm: true, phone_confirm: true,
    user_metadata: { tipo: 'motorista', phone }
  });
  if (authErr) return { error: authErr };

  const userId = authData.user?.id!;
  const profilePayload = { id: userId, celular: phone, tipo: 'motorista', nome: userData.nome, ...userData,
                           created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

  const { error: prErr } = await supabaseServer.from('profiles').upsert(profilePayload);
  if (prErr) return { error: prErr };

  const { data: session, error: sessErr } = await supabase.auth.signInWithPassword({ email, password });
  if (sessErr) return { error: sessErr };

  return { data: { user: authData.user, session }, error: null };
};

// sign-in via OTP
export const signInWithPhone = (phone: string) => {
  const email = `${phone.replace(/\D/g, '')}@pixter-temp.com`;
  return supabase.auth.signInWithOtp({ email });
};
