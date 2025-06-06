/* ──────────────────────────────────────────────────────────────
   src/lib/supabase/client.ts   ←  TypeScript (garante tree-shaking)
   ────────────────────────────────────────────────────────────── */
   import { createClient, User } from '@supabase/supabase-js';
   import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'; // Import Auth Helper
   
   /*──────────────── VARIÁVEIS DE AMBIENTE ───────────────*/
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
   const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Make sure this is defined in your server environment variables

   if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
     throw new Error('Missing Supabase environment variables');
   }
   
   /*──────────────── CLIENTES ────────────────────────────*/
   // Client-side instance (safe for browser) - REMOVED to use Auth Helpers
   // export const supabase = createClient(supabaseUrl, supabaseAnonKey);
   // Server-side instance (uses service key, ONLY for backend/API routes)
   export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
   export const supabaseAdmin  = supabaseServer;  // alias for Admin API
   
   /*──────────────── EMAIL/PASSWORD SIGNUP (Client-Side) ──*/
   // Added back based on user request, with fix for unconfirmed emails
   export async function signUpWithEmail(email: string, password: string, optionsData?: { celular?: string; nome?: string; cpf?: string; tipo?: string }) {
     const supabase = createClientComponentClient(); // Use Auth Helper client
     // Use the client-side supabase instance for sign-up initiated from the browser
     const { data, error } = await supabase.auth.signUp({
       email,
       password,
       options: {
         data: optionsData, // Pass data for the trigger (handle_new_user)
       },
     });
   
     if (error) {
       console.error('Supabase signup error:', error.message);
       return { success: false, message: `Signup failed: ${error.message}` };
     }
   
     // Case 1: Successful NEW user signup (user exists, has identity, session might be null until confirmed)
     if (data.user && data.user.identities && data.user.identities.length > 0) {
       console.log('Successful new user registration initiated for:', email);
       // The trigger `handle_new_user` should create the profile entry.
       return { success: true, message: 'Signup successful! Please check your email (including spam folder) for the verification link.' };
     }
   
     // Case 2: Email already exists, but user is unconfirmed (user exists, no identity)
     if (data.user && data.user.identities && data.user.identities.length === 0) {
       console.warn('Signup attempt for existing unconfirmed email:', email);
       // Supabase typically resends the confirmation email in this scenario.
       return {
         success: false, // Indicate signup didn't complete fully / create a new session
         message: 'This email is already registered but requires verification. Please check your inbox (and spam folder) for the confirmation email.'
       };
     }
   
     // Fallback for any other unexpected scenario
     console.error('Unexpected signup response:', data);
     return { success: false, message: 'An unexpected error occurred during signup. Please try again.' };
   }
   
   /*──────────────── OTP HELPERS (Client-Side) ─────────*/
   // These interact with your custom 'verification_codes' table.
   // Assumes called from client-side; RLS must be set up correctly.
   
   export const storeVerificationCode = async (
     phone: string,
     code: string,
     minutes = 10
   ) => {
     const supabase = createClientComponentClient(); // Use Auth Helper client
     return supabase
       .from('verification_codes')
       .upsert({
         phone, // Ensure phone is consistently formatted (E.164 recommended)
         code,
         created_at: new Date().toISOString(),
         expires_at: new Date(Date.now() + minutes * 60_000).toISOString()
       });
   };
   
   export const verifyCode = async (phone: string, code: string) => {
     const supabase = createClientComponentClient(); // Use Auth Helper client
     return supabase
       .from('verification_codes')
       .select('*')
       .eq('phone', phone)
       .eq('code', code)
       .gt('expires_at', new Date().toISOString())
       .single();
   };
   
   export const deleteVerificationCode = async (phone: string) => {
     const supabase = createClientComponentClient(); // Use Auth Helper client
     return supabase.from('verification_codes').delete().eq('phone', phone);
   };
   
   /*──────────────── UTIL ────────────────────────────────*/
export const formatPhoneNumber = (phone: string, code = '55') => {
    // If the phone number already starts with +, return it as is
    if (phone.startsWith('+')) {
      return phone;
    }

    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Handle Brazilian numbers - remove leading zero if present
    if (code === '55' && digitsOnly.startsWith('0')) {
      return `+${code}${digitsOnly.substring(1)}`;
    }
    
    // Original logic for other cases
    return digitsOnly.startsWith(code) ? `+${digitsOnly}` : `+${code}${digitsOnly}`;
};
   
   /*──────────────── DRIVER via TELEFONE (Server-Side ONLY) ──*/
   // This function uses supabaseAdmin and should ONLY be called from secure server-side API routes.
   export const createDriverWithPhone = async (
     phone: string, // Expects E.164 format from formatPhoneNumber
     userData: Record<string, any>
   ) => {
     const sanitizedPhoneDigits = phone.replace(/\D/g, ''); // Digits only for temp email
   
     /* 1. Dup-check (using Admin API) */
     const emailProvided = userData.email && userData.email.trim() !== '' ? userData.email.trim() : null;
   
     const { data: dupPhoneData, error: dupPhoneError } = await supabaseAdmin
       .from('auth.users') // Query auth.users directly
       .select('id')
       .eq('phone', phone)
       .maybeSingle();
   
     if (dupPhoneError) console.error('Error checking duplicate phone:', dupPhoneError.message);
     if (dupPhoneData) return { error: new Error('phone_exists') };
   
     if (emailProvided) {
       const { data: dupEmailData, error: dupEmailError } = await supabaseAdmin
         .from('auth.users')
         .select('id')
         .eq('email', emailProvided)
         .maybeSingle();
       if (dupEmailError) console.error('Error checking duplicate email:', dupEmailError.message);
       if (dupEmailData) return { error: new Error('email_exists') };
     }
   
     /* 2. Generate temporary email + strong password */
     const email = emailProvided ?? `${sanitizedPhoneDigits}-${Date.now()}@pixter-temp.com`; // Use digits only
     const password = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
   
     /* 3. Create user using Admin API */
     const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
       email,
       phone,
       password,
       email_confirm: true, // Mark email as confirmed (since it's temporary or provided)
       phone_confirm: true, // Mark phone as confirmed (assuming OTP was verified before calling this)
       user_metadata: { tipo: 'motorista', nome: userData.nome /* Add other metadata if needed */ }
     });
   
     if (authErr) {
       console.error('Admin API createUser error:', authErr.message);
       return { error: authErr };
     }
   
     const userId = authData.user?.id;
     if (!userId) {
       console.error('Admin API createUser succeeded but returned no user ID.');
       return { error: new Error('User creation failed unexpectedly.') };
     }
   
     /* 4. Create/Update profile using Server client (avoids RLS issues) */
     // The trigger `handle_new_user` should ideally run and create the basic profile.
     // This upsert ensures the profile exists and sets/updates specific driver data.
     const profilePayload = {
       id: userId,
       celular: phone,
       tipo: 'motorista',
       nome: userData.nome,
       cpf: userData.cpf, // Add other fields from userData as needed
       email: emailProvided, // Store the real email if provided
       // created_at will be set by trigger or default
       updated_at: new Date().toISOString(),
       verified:true
     };
   
     // Remove undefined fields from payload
     Object.keys(profilePayload).forEach(key => (profilePayload as any)[key] === undefined && delete (profilePayload as any)[key]);
   
     const { error: profileErr } = await supabaseServer
       .from('profiles')
       .upsert(profilePayload); // Use upsert for robustness
   
     if (profileErr) {
       console.error('Error upserting profile:', profileErr.message);
       // Don't necessarily fail the whole process, but log it.
       // Consider cleanup logic if profile creation fails (e.g., delete the auth user?)
       return { error: profileErr }; // Propagate profile upsert error
     }
   
     /* 5. Optional: Sign in user on client-side after this server process completes */
     // This function runs on the server, so it can't directly return a client session.
     // The client would typically call an API route that uses this function,
     // and then the client might need to sign in separately if required immediately.
     // Returning the created user info might be useful for the client.
     console.log('Driver user created successfully via Admin API:', userId);
     return { data: { user: authData.user }, error: null };
   };
   
   /*──────────────── sign-in OTP via telefone (Client-Side) ──*/
   // Uses standard phone OTP sign-in.
   export const signInWithPhone = (phone: string) => {
     const supabase = createClientComponentClient(); // Use Auth Helper client
     const formattedPhone = formatPhoneNumber(phone);
     return supabase.auth.signInWithOtp({ phone: formattedPhone });
   };
   
   /*──────────────── CRUD perfil / storage (Client-Side) ──*/
   // Use client instance assuming called from frontend where user is authenticated.
   // RLS policies MUST allow users to perform these actions on their own data.
   
   export const getProfile = (id: string) => {
     const supabase = createClientComponentClient(); // Use Auth Helper client
     return supabase.from("profiles").select("*").eq("id", id).single();
   };
   
   export const updateProfile = (id: string, updates: Record<string, any>) => {
     const supabase = createClientComponentClient(); // Use Auth Helper client
     return supabase
       .from('profiles')
       .update({ ...updates, updated_at: new Date().toISOString() })
       .eq('id', id); // RLS policy `auth.uid() = id` will enforce security
   };
   
   export const uploadImage = (bucket: string, path: string, file: File) => {
     const supabase = createClientComponentClient(); // Use Auth Helper client
     return supabase.storage.from(bucket).upload(path, file, { upsert: true });
   };
   
   export const getImageUrl = (bucket: string, path: string) => {
     const supabase = createClientComponentClient(); // Use Auth Helper client
     // Note: getPublicUrl does not require the user to be authenticated if the bucket is public.
     // If the bucket is private, you'd need different logic (e.g., createSignedUrl).
     const { data } = supabase.storage.from(bucket).getPublicUrl(path);
     return data.publicUrl;
   };
   
   