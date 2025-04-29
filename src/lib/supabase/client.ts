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
      // You pass 'data' here to store additional info in the auth.users table metadata
      // or trigger functions. It does NOT automatically populate the 'profiles' table.
      data: {
        // Include fields you want in auth.users.user_metadata
        // Supabase Auth doesn't automatically link this to 'profiles' table columns
        // You might need a trigger for that (common practice).
        nome, // Example: store name in user_metadata
        tipo, // Example: store tipo in user_metadata
      },
    },
  });

  if (error) {
    // Log the specific error
    console.error('Supabase signup error:', error.message);
    // Return a user-friendly message, potentially masking specific details
    return { success: false, message: `Signup failed: ${error.message}` };
  }

  // Case 1: Successful NEW user signup (user exists, has identity, session might be null until confirmed)
  if (data.user && data.user.identities && data.user.identities.length > 0) {
    console.log('Successful new user registration initiated for:', email);
    // NOTE: You still need to handle profile creation separately, often via a trigger
    // or calling another function after successful email verification.
    // The 'data' in options above does NOT populate your 'profiles' table directly.
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

// Phone OTP sign-in/signup
export async function signInWithPhoneOtp(celular: string) {
  // Ensure phone number is in E.164 format if needed by Supabase
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: celular,
    // options: { data: { ... } } // OTP sign-in usually doesn't need extra data here
  });

  if (error) {
    console.error('OTP sign-in error:', error.message);
    return { success: false, message: `OTP request failed: ${error.message}` };
  }

  console.log('OTP sent successfully to:', celular);
  return { success: true, message: 'OTP sent successfully. Please enter the code.' };
}

// Update user profile data later
// IMPORTANT: This function updates the 'profiles' table.
// Ensure you have Row Level Security (RLS) policies set up correctly
// so users can only update their OWN profile.
export async function updateProfile(userId: string, updates: { email?: string, nome?: string, cpf?: string, tipo?: string, celular?: string, profissao?: string, data_nascimer?: string, selfie_url?: string, avatar_index?: string /* add other fields */ }) {
  // Add updated_at timestamp automatically
  const profileData = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // Remove undefined fields to avoid overwriting existing data with null
  Object.keys(profileData).forEach(key => profileData[key] === undefined && delete profileData[key]);

  const { error } = await supabase
    .from('profiles')
    .update(profileData)
    .eq('id', userId); // Ensure this matches the user's auth ID

  if (error) {
    console.error('Profile update error:', error.message);
    return { success: false, message: `Profile update failed: ${error.message}` };
  }

  console.log('Profile updated successfully for user:', userId);
  return { success: true, message: 'Profile updated successfully.' };
}

// You might also need functions for:
// - Email/Password Sign In
// - Password Reset
// - Handling email verification callback
// - Creating the profile entry AFTER email verification (often done with DB triggers)
