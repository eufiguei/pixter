/* ------------------------------------------------------------------
   src/lib/auth/options.ts
   Full, Type-Safe version – fixes compile-time blocker on `email`
-------------------------------------------------------------------*/

import { NextAuthOptions, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { Stripe } from "stripe";

// ──────────────────────────────────────────────────────────────────
// Supabase helpers (server-side only)
import {
  supabaseServer,
  supabaseAdmin,
  formatPhoneNumber,
} from "@/lib/supabase/client";

// ──────────────────────────────────────────────────────────────────
// Stripe initialisation  (ALWAYS use env vars in real prod)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_YOUR_KEY", {
  apiVersion: "2022-11-15",
});

// ──────────────────────────────────────────────────────────────────
// Postgres row typing  – re-use everywhere you query `profiles`
export interface ProfileRow {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
  tipo: string | null;
  stripe_customer_id: string | null;
}

/* ------------------------------------------------------------------
   NextAuth configuration
-------------------------------------------------------------------*/
export const authOptions: NextAuthOptions = {
  /* ================================================================
     PROVIDERS
  ==================================================================*/
  providers: [
    /* -------- Google OAuth -------- */
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),

    /* -------- E-mail + Senha (Supabase) -------- */
    CredentialsProvider({
      id: "email-password",
      name: "Email e Senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // 1. Auth via Supabase
        const { data, error } = await supabaseServer.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });
        if (error || !data.user) {
          console.error("Email/Password Auth Error:", error?.message);
          throw new Error(error?.message || "Email ou senha inválidos.");
        }

        // 2. Fetch profile (typed)
        const { data: profile } = await supabaseServer
          .from<ProfileRow>("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        // 3. Map to NextAuth-compatible object
        const user: User = {
          id: data.user.id,
          email: data.user.email,
          name: profile?.nome ?? data.user.email?.split("@")[0] ?? null,
          image: profile?.avatar_url ?? null,
        };

        // Custom field forwarded via `any`
        (user as any).tipo = profile?.tipo ?? "cliente";

        return user;
      },
    }),

    /* -------- Telefone + OTP (Supabase verifyOtp) -------- */
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

        // 1. Verify OTP
        const { data: verifyData, error: verifyError } =
          await supabaseServer.auth.verifyOtp({
            phone: formattedPhone,
            token: credentials.code,
            type: "sms",
          });

        if (verifyError || !verifyData?.user) {
          console.error(`Supabase verifyOtp error for ${formattedPhone}:`, verifyError?.message);
          let msg = "Código inválido ou expirado";
          if (verifyError?.message.includes("expired"))
            msg = "Código expirado. Por favor, solicite um novo.";
          throw new Error(msg);
        }

        // 2. Profile (typed, may be null)
        const userId = verifyData.user.id;
        const { data: profileData } = await supabaseServer
          .from<ProfileRow>("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        // 3. Assemble user object
        const user: User = {
          id: userId,
          email: verifyData.user.email,
          name: profileData?.nome ?? null,
          image: profileData?.avatar_url ?? null,
        };
        (user as any).tipo = profileData?.tipo ?? "cliente";
        return user;
      },
    }),
  ],

  /* ================================================================
     CALLBACKS
  ==================================================================*/
  callbacks: {
    /* ------------- signIn ------------- */
    async signIn({ user }) {
      if (!user?.id) return false;

      let stripeCustomerId: string | null = null;

      // 1. Lookup profile (now typed & includes email/nome)
      const { data: existingProfile, error: profileError } = await supabaseServer
        .from<ProfileRow>("profiles")
        .select("id, nome, email, tipo, stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError.message);
        return false;
      }

      /* -------- New user (no profile) -------- */
      if (!existingProfile) {
        try {
          const cust = await stripe.customers.create({
            email: user.email ?? undefined,
            name: user.name ?? undefined,
            metadata: { supabase_user_id: user.id },
          });
          stripeCustomerId = cust.id;

          // Create profile with Stripe ID
          const { error: insertErr } = await supabaseServer.from("profiles").insert({
            id: user.id,
            nome: user.name ?? null,
            email: user.email ?? null,
            avatar_url: user.image ?? null,
            tipo: "cliente",
            stripe_customer_id: stripeCustomerId,
          });
          if (insertErr) throw insertErr;
        } catch (e: any) {
          console.error("Account bootstrap error:", e.message);
          return false;
        }
        (user as any).tipo = "cliente";
      }

      /* -------- Existing user -------- */
      else {
        stripeCustomerId = existingProfile.stripe_customer_id;

        if (!stripeCustomerId) {
          try {
            const cust = await stripe.customers.create({
              email: user.email ?? existingProfile.email ?? undefined,
              name: user.name ?? existingProfile.nome ?? undefined,
              metadata: { supabase_user_id: user.id },
            });
            stripeCustomerId = cust.id;

            const { error: updateErr } = await supabaseServer
              .from("profiles")
              .update({ stripe_customer_id: stripeCustomerId })
              .eq("id", user.id);
            if (updateErr) throw updateErr;
          } catch (e: any) {
            console.error("Stripe create error:", e.message);
            return false;
          }
        }

        (user as any).tipo = existingProfile.tipo ?? "cliente";
      }

      /* attach for later callbacks */
      (user as any).stripeCustomerId = stripeCustomerId;
      return true;
    },

    /* ------------- jwt ------------- */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tipo = (user as any).tipo;
        token.stripeCustomerId = (user as any).stripeCustomerId;
      }
      return token;
    },

    /* ------------- session ------------- */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tipo = token.tipo as string;
        session.user.stripeCustomerId = token.stripeCustomerId as string;
      }
      return session;
    },
  },

  /* ================================================================
     PAGES & STRATEGY
  ==================================================================*/
  pages: { signIn: "/login", newUser: "/cadastro" },

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 1 day
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 1 day
  },
};