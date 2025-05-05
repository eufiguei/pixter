// src/lib/auth/options.ts (Updated with Phone OTP Provider using Supabase verifyOtp)
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { Stripe } from "stripe"; // Import Stripe
// Import only server/admin clients and helpers needed server-side
import { supabaseServer, supabaseAdmin, formatPhoneNumber } from "@/lib/supabase/client";

// Initialize Stripe (Use environment variables!)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_YOUR_KEY", {
  apiVersion: "2022-11-15", // Use your desired API version
});

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

        // Use server client for sign-in
        const { data, error } = await supabaseServer.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });
        if (error || !data.user) {
          console.error("Email/Password Auth Error:", error?.message);
          throw new Error(error?.message || "Email ou senha inválidos."); // Throw error for feedback
        }

        // Fetch profile using server client
        const { data: profile } = await supabaseServer
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        if (!profile) {
            console.warn(`Profile not found during Email/Password login for user: ${data.user.id}.`);
            // Decide if login should be blocked if profile is mandatory
            // throw new Error("Perfil não encontrado.");
        }

        // Return user object for NextAuth session
        return {
          id: data.user.id,
          email: data.user.email,
          name: profile?.nome || data.user.email?.split("@")[0],
          image: profile?.avatar_url || null,
          tipo: profile?.tipo || "cliente", // Default to client if not found
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
        const { data: verifyData, error: verifyError } = await supabaseServer.auth.verifyOtp({
          phone: formattedPhone,
          token: credentials.code,
          type: "sms", // or "whatsapp"
        });

        if (verifyError || !verifyData?.user) {
          console.error(`Supabase verifyOtp error for ${formattedPhone}:`, verifyError?.message);
          let errorMessage = "Código inválido ou expirado";
          if (verifyError?.message.includes("expired")) {
              errorMessage = "Código expirado. Por favor, solicite um novo.";
          }
          throw new Error(errorMessage);
        }

        // 2. Fetch profile
        const userId = verifyData.user.id;
        const { data: profileData, error: profileError } = await supabaseServer
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (profileError && profileError.code !== "PGRST116") {
            console.error(`Error fetching profile for user ${userId} after OTP verify:`, profileError.message);
            throw new Error("Erro ao buscar perfil do usuário.");
        }

        if (!profileData) {
            console.warn(`Profile not found for user ${userId} during OTP login. Login allowed, but profile data missing.`);
        }

        // 3. Return user object
        return {
          id: userId,
          email: verifyData.user.email,
          name: profileData?.nome || null,
          image: profileData?.avatar_url || null,
          tipo: profileData?.tipo || "cliente",
        };
      },
    }),

  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // Ensure user object has an id
      if (!user?.id) return false;

      // --- Stripe Customer Creation/Retrieval ---
      let stripeCustomerId: string | null = null;

      try {
        // Check if profile exists in Supabase
        const { data: existingProfile, error: profileError } = await supabaseServer
          .from("profiles")
          .select("id, tipo, stripe_customer_id") // Select stripe_customer_id
          .eq("id", user.id)
          .maybeSingle(); // Use maybeSingle to handle not found gracefully

        if (profileError) {
          console.error("Error checking profile during sign-in:", profileError.message);
          return false; // Block sign-in on profile fetch error
        }

        if (!existingProfile) {
          // --- Create Profile and Stripe Customer for NEW users (e.g., first Google sign-in) ---
          console.log(`Creating profile and Stripe Customer for new user: ${user.id}`);

          // Create Stripe Customer first
          try {
            const customer = await stripe.customers.create({
              email: user.email || undefined,
              name: user.name || undefined,
              metadata: {
                supabase_user_id: user.id,
              },
            });
            stripeCustomerId = customer.id;
            console.log(`Stripe Customer created: ${stripeCustomerId} for user ${user.id}`);
          } catch (stripeError: any) {
            console.error("Error creating Stripe Customer:", stripeError.message);
            // Decide if sign-in should fail if Stripe Customer creation fails
            return false; // Block sign-in if Stripe Customer creation fails
          }

          // Now create Supabase profile including the Stripe Customer ID
          const { error: insertError } = await supabaseServer
            .from("profiles")
            .insert({
              id: user.id,
              nome: user.name,
              email: user.email,
              avatar_url: user.image,
              tipo: "cliente", // Default new users to client
              stripe_customer_id: stripeCustomerId, // Store Stripe Customer ID
            });

          if (insertError) {
            console.error("Error creating Supabase profile:", insertError.message);
            // Optional: Attempt to delete the created Stripe Customer if profile creation fails?
            return false; // Block sign-in if profile creation fails
          }
          (user as any).tipo = "cliente"; // Add tipo to user object for JWT/Session

        } else {
          // --- Existing User: Check/Create Stripe Customer ID ---
          stripeCustomerId = existingProfile.stripe_customer_id;

          if (!stripeCustomerId) {
            console.log(`Stripe Customer ID missing for existing user ${user.id}. Creating now.`);
            try {
              const customer = await stripe.customers.create({
                email: user.email || existingProfile.email || undefined,
                name: user.name || existingProfile.nome || undefined,
                metadata: {
                  supabase_user_id: user.id,
                },
              });
              stripeCustomerId = customer.id;
              console.log(`Stripe Customer created: ${stripeCustomerId} for user ${user.id}`);

              // Update profile with the new Stripe Customer ID
              const { error: updateError } = await supabaseServer
                .from("profiles")
                .update({ stripe_customer_id: stripeCustomerId })
                .eq("id", user.id);

              if (updateError) {
                console.error("Error updating profile with Stripe Customer ID:", updateError.message);
                // Decide if sign-in should fail
                return false;
              }
            } catch (stripeError: any) {
              console.error("Error creating Stripe Customer for existing user:", stripeError.message);
              // Decide if sign-in should fail
              return false;
            }
          }
          // Add existing tipo to user object for JWT/Session
          (user as any).tipo = existingProfile.tipo ?? "cliente";
        }

      } catch (e: any) {
        console.error("Unexpected error during signIn callback:", e.message);
        return false;
      }

      // Add stripeCustomerId to the user object to pass it to the JWT callback
      if (stripeCustomerId) {
        (user as any).stripeCustomerId = stripeCustomerId;
      }

      // Allow sign-in if everything succeeded
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tipo = (user as any).tipo;
        token.stripeCustomerId = (user as any).stripeCustomerId; // Add stripeCustomerId to token
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tipo = token.tipo as string;
        session.user.stripeCustomerId = token.stripeCustomerId as string; // Add stripeCustomerId to session
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    newUser: "/cadastro",
  },

  session: {
    strategy: "jwt",
    // Set session max age to 1 day for better security
    maxAge: 24 * 60 * 60, // 1 day in seconds
    // updateAge: 24 * 60 * 60, // Optional: Update expiry only once every 24 hours
  },

  jwt: {
    // JWT max age remains 1 day (consistent with session maxAge)
    maxAge: 24 * 60 * 60, // 1 day in seconds
  },
};

