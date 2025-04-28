import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Funções de autenticação
export const signUp = async (email, password, userData) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData
    }
  })
  return { data, error }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// Funções específicas para autenticação por telefone
export const storeVerificationCode = async (phone, code, expiresInMinutes = 10) => {
  const { data, error } = await supabase
    .from('verification_codes')
    .upsert({
      phone,
      code,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()
    })
  return { data, error }
}

export const verifyCode = async (phone, code) => {
  const { data, error } = await supabase
    .from('verification_codes')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .single()
  return { data, error }
}

export const deleteVerificationCode = async (phone) => {
  const { error } = await supabase
    .from('verification_codes')
    .delete()
    .eq('phone', phone)
  return { error }
}

export const createDriverWithPhone = async (phone, userData) => {
  // Gera um email único baseado no telefone
  const email = `${phone.replace(/\D/g, '')}@pixter.temp`
  
  // Gera uma senha aleatória e segura
  const password = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10)
  
  // Cria o usuário na autenticação
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    phone,
    options: {
      data: {
        tipo: 'motorista',
        phone
      }
    }
  })
  
  if (authError) {
    return { error: authError }
  }
  
  const userId = authData.user?.id
  
  if (!userId) {
    return { error: new Error('Falha ao criar usuário') }
  }
  
  // Cria o perfil do motorista
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      celular: phone,
      tipo: 'motorista',
      ...userData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  
  if (profileError) {
    return { error: profileError }
  }
  
  // Faz login com o usuário criado
  const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (sessionError) {
    return { error: sessionError }
  }
  
  return { data: { user: authData.user, session, password }, error: null }
}

export const signInWithPhone = async (phone) => {
  const email = `${phone.replace(/\D/g, '')}@pixter.temp`
  
  // Verifica se o usuário existe
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('celular', phone)
    .eq('tipo', 'motorista')
    .single()
  
  if (profileError || !profile) {
    return { error: new Error('Motorista não encontrado') }
  }
  
  // Usa o método de login mágico (sem senha)
  const { data, error } = await supabase.auth.signInWithOtp({
    email
  })
  
  return { data, error }
}

// Função para formatar número de telefone
export function formatPhoneNumber(phone, countryCode = '55') {
  // Remove todos os caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Se já começa com o código do país, apenas adiciona o +
  if (cleanPhone.startsWith(countryCode)) {
    return `+${cleanPhone}`;
  }
  
  // Adiciona o código do país
  return `+${countryCode}${cleanPhone}`;
}

// Funções de banco de dados
export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
  return { data, error }
}

// Funções de armazenamento
export const uploadImage = async (bucket, path, file) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: true
    })
  return { data, error }
}

export const getImageUrl = (bucket, path) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
