import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabaseServer } from "@/lib/supabase/client"; // Use server client (service role)
import { verifyCode, deleteVerificationCode, formatPhoneNumber } from "@/lib/supabase/client"; // Import OTP helpers

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
      id: "email-password", // Added id for clarity
      name: "Email e Senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { data, error } = await supabaseServer.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });
        if (error || !data.user) {
          console.error("Email/Password Auth Error:", error?.message);
          return null; // Or throw an error for specific feedback
        }

        const { data: profile } = await supabaseServer
          .from("profiles")
          .select("*, avatar_url: profiles_avatar_url_fkey(avatar_url)") // Fetch avatar_url via relationship if needed
          .eq("id", data.user.id)
          .single();

        if (!profile) {
            console.warn(`Profile not found during Email/Password login for user: ${data.user.id}. Login allowed, but profile data missing.`);
            // Decide if login should be blocked if profile is mandatory
            // return null;
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

    /* ------ Phone + OTP (Custom) ------ */
    CredentialsProvider({
      id: "phone-otp", // Unique identifier for this provider
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
        code: { label: "Code", type: "text" },
        countryCode: { label: "Country Code", type: "text", value: "55" }, // Optional, default to 55
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.code) return null;

        const countryCode = credentials.countryCode || "55";
        const formattedPhone = formatPhoneNumber(credentials.phone, countryCode);

        // 1. Verify code against your custom table
        const { data: verificationData, error: verificationError } = await verifyCode(formattedPhone, credentials.code);

        if (verificationError || !verificationData) {
          console.log(`Phone OTP verification failed for ${formattedPhone}: Invalid or expired code.`);
          // Throwing an error provides feedback to the signIn function
          throw new Error("Código inválido ou expirado");
        }

        // 2. If code is valid, find the user in auth.users by phone number
        //    Requires querying auth.users, potentially using Admin API if RLS restricts
        //    Using supabaseServer (service role) should bypass RLS
        const { data: userData, error: userError } = await supabaseServer
          .from("users") // Querying the auth.users table
          .select("id, email") // Select necessary fields
          .eq("phone", formattedPhone)
          .single(); // Assuming phone number is unique

        if (userError || !userData) {
          console.error(`Error finding user by phone ${formattedPhone}:`, userError?.message);
          // Handle case where user might not exist for this phone number
          // Maybe create the user here if this is also a sign-up flow?
          // For now, assume user must exist if they received an OTP
          throw new Error("Usuário não encontrado para este número de telefone.");
        }

        // 3. Fetch the user's profile from public.profiles
        const { data: profileData, error: profileError } = await supabaseServer
          .from("profiles")
          .select("*, avatar_url: profiles_avatar_url_fkey(avatar_url)") // Adjust select as needed
          .eq("id", userData.id)
          .single();

        if (profileError && profileError.code !== "PGRST116") { // Ignore 'not found' error here
            console.error(`Error fetching profile for user ${userData.id}:`, profileError.message);
            throw new Error("Erro ao buscar perfil do usuário.");
        }

        if (!profileData) {
            console.warn(`Profile not found for user ${userData.id} during OTP login. Login allowed, but profile data missing.`);
            // Potentially create a basic profile here if needed?
            // Or ensure the sign-up process *always* creates one.
            // For now, allow login but profile might be incomplete.
        }

        // 4. Delete the used OTP code
        await deleteVerificationCode(formattedPhone);

        // 5. Return the user object for NextAuth session creation
        return {
          id: userData.id,
          email: userData.email, // May be null if user signed up only with phone
          name: profileData?.nome || null, // Get name from profile
          image: profileData?.avatar_url || null,
          tipo: profileData?.tipo || "cliente", // Get type from profile
        };
      },
    }),

  ],

  /* ---------------------------------------------------------------
     Callbacks (Ensure these handle the user object from OTP provider)
  ----------------------------------------------------------------*/
  callbacks: {
    async signIn({ user, account, profile }) {
      // This might need adjustment depending on how Google profile data comes in
      if (account?.provider === "google") {
        // Check if profile exists, create/update if necessary
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
            // Profile doesn't exist, create it
            console.log(`Creating profile for new Google user: ${user.id}`);
            const { error: insertError } = await supabaseServer
                .from('profiles')
                .insert({
                    id: user.id,
                    nome: user.name,
                    email: user.email,
                    avatar_url: user.image,
                    tipo: 'cliente' // Default type for new Google users
                });
            if (insertError) {
                console.error("Error creating profile for Google user:", insertError.message);
                return false; // Block sign-in if profile creation fails
            }
            (user as any).tipo = 'cliente'; // Assign default type to session user object
        } else {
            // Profile exists, assign existing type
             (user as any).tipo = existingProfile.tipo ?? 'cliente';
        }
      }
      // For credential providers (Email/Pass, Phone/OTP), the 'tipo' should be set in the authorize function
      return true; // Allow sign-in
    },

    async jwt({ token, user }) {
      // If user object exists (on sign in), add custom fields to token
      if (user) {
        token.id = user.id;
        token.tipo = (user as any).tipo; // Ensure 'tipo' is added from authorize/signIn
      }
      return token;
    },

    async session({ session, token }) {
      // Copy custom fields from token to session object
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tipo = token.tipo as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    newUser: "/cadastro", // Ensure this page handles profile creation if needed
    // error: '/auth/error', // Optional: Custom error page
  },

  session: { strategy: "jwt" },

  // Optional: Add debug logging in development
  // debug: process.env.NODE_ENV === 'development',
};

