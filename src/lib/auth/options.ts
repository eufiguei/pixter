// src/lib/auth/options.ts (Updated with Phone OTP Provider using Supabase verifyOtp)
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase, supabaseServer } from "@/lib/supabase/client"; // Import both client and server
import { formatPhoneNumber } from "@/lib/supabase/client"; // Import phone formatter

/* ------------------------------------------------------------------
   NextAuth options - Defined and Exported Here
-------------------------------------------------------------------*/
export const authOptions: NextAuthOptions = {
  providers: [
    /* -------- Google -------- */
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),

    /* ------ E-mail + senha (Supabase) ------ */
    CredentialsProvider({
      id: "email-password",
      name: "Email e Senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Use server client for sign-in to bypass RLS if needed, though client might work too
        const { data, error } = await supabaseServer.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });
        if (error || !data.user) {
          console.error("Email/Password Auth Error:", error?.message);
          throw new Error(error?.message || "Email ou senha inválidos."); // Throw error for feedback
        }

        const { data: profile } = await supabaseServer
          .from("profiles")
          .select("*, avatar_url: profiles_avatar_url_fkey(avatar_url)")
          .eq("id", data.user.id)
          .single();

        if (!profile) {
            console.warn(`Profile not found during Email/Password login for user: ${data.user.id}.`);
            // Decide if login should be blocked if profile is mandatory
            // throw new Error("Perfil não encontrado.");
        }

        return {
          id: data.user.id,
          email: data.user.email,
          name: profile?.nome || data.user.email?.split("@")[0],
          image: profile?.avatar_url || null,
          tipo: profile?.tipo || "cliente",
        };
      },
    }),

    /* ------ Phone + OTP (Custom - Using Supabase verifyOtp) ------ */
    CredentialsProvider({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
        code: { label: "Code", type: "text" },
        countryCode: { label: "Country Code", type: "text", value: "55" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.code) return null;

        const countryCode = credentials.countryCode || "55";
        const formattedPhone = formatPhoneNumber(credentials.phone, countryCode);

        // 1. Verify OTP using Supabase Auth verifyOtp
        // Use the standard client instance (supabase) as it handles session context
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          phone: formattedPhone,
          token: credentials.code,
          type: "sms", // or "whatsapp" depending on what send-verification used
        });

        if (verifyError || !verifyData.user) {
          console.error(`Supabase verifyOtp error for ${formattedPhone}:`, verifyError?.message);
          // Map common errors
          let errorMessage = "Código inválido ou expirado";
          if (verifyError?.message.includes("expired")) {
              errorMessage = "Código expirado. Por favor, solicite um novo.";
          }
          throw new Error(errorMessage);
        }

        // 2. Verification successful, Supabase returns the user object.
        //    Fetch the user's profile from public.profiles using the user ID.
        const userId = verifyData.user.id;
        const { data: profileData, error: profileError } = await supabaseServer // Use server client for profile access
          .from("profiles")
          .select("*, avatar_url: profiles_avatar_url_fkey(avatar_url)")
          .eq("id", userId)
          .single();

        if (profileError && profileError.code !== "PGRST116") { // Ignore "not found" error here
            console.error(`Error fetching profile for user ${userId} after OTP verify:`, profileError.message);
            throw new Error("Erro ao buscar perfil do usuário.");
        }

        if (!profileData) {
            console.warn(`Profile not found for user ${userId} during OTP login. Login allowed, but profile data missing.`);
            // Ensure the sign-up process or a trigger creates the profile.
            // For now, allow login but profile might be incomplete.
        }

        // 3. Return the user object for NextAuth session creation
        // Supabase verifyOtp already confirmed the user exists in auth.users
        return {
          id: userId,
          email: verifyData.user.email, // May be null
          name: profileData?.nome || null,
          image: profileData?.avatar_url || null,
          tipo: profileData?.tipo || "cliente",
        };
      },
    }),

  ],

  /* ---------------------------------------------------------------
     Callbacks (Ensure these handle the user object from OTP provider)
  ----------------------------------------------------------------*/
  callbacks: {
    async signIn({ user, account, profile }) {
      // This logic ensures a profile exists or is created for Google sign-ins
      // It also assigns the user type to the user object for the JWT callback
      if (account?.provider === "google") {
        const { data: existingProfile, error } = await supabaseServer
          .from("profiles")
          .select("id, tipo")
          .eq("id", user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
            console.error("Error checking profile during Google sign-in:", error.message);
            return false; // Block sign-in on error
        }

        if (!existingProfile) {
            console.log(`Creating profile for new Google user: ${user.id}`);
            const { error: insertError } = await supabaseServer
                .from('profiles')
                .insert({
                    id: user.id,
                    nome: user.name,
                    email: user.email,
                    avatar_url: user.image,
                    tipo: 'cliente'
                });
            if (insertError) {
                console.error("Error creating profile for Google user:", insertError.message);
                return false;
            }
            (user as any).tipo = 'cliente';
        } else {
             (user as any).tipo = existingProfile.tipo ?? 'cliente';
        }
      }
      // For credential providers (Email/Pass, Phone/OTP), the 'tipo' should be set in the authorize function
      // We already added 'tipo' to the user object returned by authorize
      return true; // Allow sign-in
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tipo = (user as any).tipo;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tipo = token.tipo as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    newUser: "/cadastro",
  },

  session: { strategy: "jwt" },
};

