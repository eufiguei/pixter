import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Email/password sign-up
export async function signUpWithEmail(email: string, password: string, celular?: string, nome?: string, cpf?: string, tipo?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { celular, nome, cpf, tipo },
    },
  })

  if (error) {
    console.error('Signup error:', error.message)
    return { success: false, message: error.message }
  }

  if (data.user?.identities?.length === 0) {
    return { success: false, message: 'Email already registered.' }
  }

  return { success: true, message: 'Signup successful! Check your email for verification.' }
}

// Phone OTP sign-in/signup
export async function signInWithPhoneOtp(celular: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: celular,
    options: {
      data: {
        email: null,
        nome: null,
        cpf: null,
        tipo: null,
      },
    },
  })

  if (error) {
    console.error('OTP error:', error.message)
    return { success: false, message: error.message }
  }

  return { success: true, message: 'OTP sent successfully.' }
}

// Update user profile data later
export async function updateProfile(userId: string, email?: string, nome?: string, cpf?: string, tipo?: string) {
  const updates = { email, nome, cpf, tipo, updated_at: new Date().toISOString() }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) {
    console.error('Profile update error:', error.message)
    return { success: false, message: error.message }
  }

  return { success: true, message: 'Profile updated successfully.' }
}