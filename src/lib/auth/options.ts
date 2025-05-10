import { NextAuthOptions, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import {
  supabaseServer,
  supabaseAdmin,
  formatPhoneNumber,
} from "@/lib/supabase/client";
import Stripe from "stripe";

/* ---------- Row type for `profiles` ---------- */
interface ProfileRow {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
  tipo: string | null;
  stripe_account_id: string | null;
  account: string | null;
}

/* ---------- Extended user type ---------- */
interface ExtendedUser extends User {
  tipo: string;
  account?: string;
}

/* ---------- Stripe ---------- */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

/* ---------- Helper: fetch profile ---------- */

/* ---------- Helper: get profile by email ---------- */
async function getProfileByEmail(email: string): Promise<ProfileRow | null> {
  console.log("Going to fetch profile by email:", email);

  const { data, error } = await supabaseServer
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error(
      "Profile fetch by email error:",
      error.message,
      error.details
    );
    return null;
  }
  if (data) {
    console.log("Profile fetched by email:", data);
  }
  return data as ProfileRow | null;
}

/* ---------- NextAuth options ---------- */
export const authOptions: NextAuthOptions = {
  providers: [
    /* -------- Google -------- */
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),

    /* ------ Email + Password (Supabase) ------ */
    CredentialsProvider({
      id: "email-password",
      name: "Email e Senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          // Use server client for sign-in
          const { data, error } = await supabaseServer.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (error || !data.user) {
            console.error("Email/Password Auth Error:", error?.message);
            return null; // Return null instead of throwing error
          }

          // Fetch profile using server client
          const { data: profile } = await supabaseServer
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .single();

          // Return user object for NextAuth session
          return {
            id: data.user.id,
            email: data.user.email,
            name: profile?.nome || data.user.email?.split("@")[0],
            image: profile?.avatar_url || null,
            tipo: profile?.tipo || "cliente",
            account: "email",
          };
        } catch (err) {
          console.error("Login error:", err);
          return null;
        }
      },
    }),

    /* ------ Phone + OTP (Supabase) ------ */
    CredentialsProvider({
      id: "phone-otp",
      name: "Telefone",
      credentials: {
        phone: { label: "Telefone", type: "text" },
        code: { label: "Código", type: "text" },
        countryCode: { label: "Country Code", type: "text", value: "55" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.code) return null;

        try {
          const countryCode = credentials.countryCode || "55";
          const formattedPhone = formatPhoneNumber(
            credentials.phone,
            countryCode
          );

          // First verify the OTP
          const { data: verifyData, error: verifyError } =
            await supabaseServer.auth.verifyOtp({
              phone: formattedPhone,
              token: credentials.code,
              type: "sms",
            });

          if (verifyError) {
            console.error(
              `Supabase verifyOtp error for ${formattedPhone}:`,
              verifyError?.message
            );
            return null;
          }

          // Then find the profile
          const { data: profileData, error: profileError } = await supabaseServer
            .from("profiles")
            .select("*")
            .eq("id", verifyData.user.id)
            .eq("tipo", "motorista")
            .single();

          if (profileError) {
            console.error("Error finding profile:", profileError);
            return null;
          }

          // Return user object
          return {
            id: verifyData.user.id,
            email: verifyData.user.email,
            name: profileData?.nome || "Motorista",
            image: profileData?.avatar_url || null,
            tipo: "motorista",
            account: "phone",
          };
          // return dummy = {
          //   id: "dummy-id",
          //   email: "dummy@dummy.com",
          //     name:"dummy",
          //   //   image: profileData?.avatar_url || null,
          //   image: null,
          //     tipo: "motorista",
          //     account: "phone",

          // }
        } catch (err) {
          console.error("Phone OTP verification error:", err);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    // In src/lib/auth/options.ts, replace only the Google signIn part of the callback

    async signIn({ user, account, profile }) {
      // Google authentication flow
      if (account?.provider === "google" && user.email) {
        try {
          console.log("Google auth flow started for email:", user.email);

          // 1. First check if profile exists by email
          const existingProfile = await getProfileByEmail(user.email);

          if (existingProfile) {
            console.log("Using existing profile with ID:", existingProfile.id);
            user.id = existingProfile.id;
            (user as ExtendedUser).tipo = existingProfile.tipo || "cliente";
            (user as ExtendedUser).account = "google";
            return true;
          }

          // 2. For users that exist in Auth but don't have a profile:
          // Instead of trying to create a user, just skip that step
          // and create only the profile record

          // To get the user ID, use the admin client to search for users by email
          const { data: users, error: adminError } = await supabaseAdmin
            .from("auth.users")
            .select("id")
            .eq("email", user.email)
            .single();

          if (adminError) {
            console.error("Error checking for existing user:", adminError);

            // Fall back to creating a new user
            const { data: authUser, error: authError } =
              await supabaseAdmin.auth.admin.createUser({
                email: user.email,
                email_confirm: true,
                user_metadata: {
                  nome: user.name || "",
                  avatar_url: user.image || null,
                },
              });

            if (authError) {
              // If we still get an error, just use NextAuth's session
              console.error("Auth user creation error:", authError);
              console.log("Using NextAuth session without Supabase link");
              return true;
            }

            // Set user ID for profile creation
            user.id = authUser.user.id;
          } else {
            // Found existing user in Supabase Auth
            console.log("Found existing user in Supabase Auth:", users.id);
            user.id = users.id;
          }

          // Create profile
          try {
            const { error: profileError } = await supabaseServer
              .from("profiles")
              .insert({
                id: user.id,
                nome: user.name || "",
                email: user.email,
                avatar_url: user.image || null,
                tipo: "cliente",
                account: "google",
              });

            if (profileError) {
              console.error("Profile creation error:", profileError);
            }
          } catch (error) {
            console.error("Exception during profile creation:", error);
          }

          // Set user type for NextAuth session
          (user as ExtendedUser).tipo = "cliente";
          (user as ExtendedUser).account = "google";

          return true;
        } catch (e) {
          console.error("Google auth error:", e);
          // If all else fails, just let NextAuth handle the session
          return true;
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tipo = (user as ExtendedUser).tipo;
        token.account = (user as ExtendedUser).account;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tipo = token.tipo as string;
        (session.user as any).account = token.account as string;
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
    maxAge: 24 * 60 * 60, // 1 day in seconds
  },

  jwt: {
    maxAge: 24 * 60 * 60, // 1 day in seconds
  },
};
