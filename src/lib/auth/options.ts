/* ------------------------------------------------------------------
   NEXTAUTH + SUPABASE + STRIPE
   • Keeps generics shallow (no “excessively deep” error)
   • Adds required `tipo` field when building `User` objects
-------------------------------------------------------------------*/
import { NextAuthOptions, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { Stripe } from "stripe";

import { supabaseServer, formatPhoneNumber } from "@/lib/supabase/client";

/* ---------- Row type for the `profiles` table ---------- */
interface ProfileRow {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
  tipo: string | null;
  stripe_customer_id: string | null;
}

/* ---------- Stripe ---------- */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_YOUR_KEY", {
  apiVersion: "2022-11-15",
});

/* ---------- Helper: fetch profile once ---------- */
async function getProfile(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabaseServer
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Profile fetch error:", error.message);
    return null;
  }
  return data as ProfileRow | null;
}

/* ------------------------------------------------------------------
   NextAuth configuration
-------------------------------------------------------------------*/
export const authOptions: NextAuthOptions = {
  /* ====================== PROVIDERS ====================== */
  providers: [
    /* ---- Google OAuth ---- */
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),

    /* ---- Email + Senha ---- */
    CredentialsProvider({
      id: "email-password",
      name: "Email e Senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize({ email, password }) {
        if (!email || !password) return null;

        const { data, error } = await supabaseServer.auth.signInWithPassword({
          email,
          password,
        });
        if (error || !data.user)
          throw new Error(error?.message || "Email ou senha inválidos.");

        const profile = await getProfile(data.user.id);

        const user: User = {
          id: data.user.id,
          email: data.user.email,
          name: profile?.nome ?? data.user.email?.split("@")[0] ?? null,
          image: profile?.avatar_url ?? null,
          tipo: profile?.tipo ?? "cliente", // required field ✅
        };

        return user;
      },
    }),

    /* ---- Phone + OTP ---- */
    CredentialsProvider({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
        code: { label: "Code", type: "text" },
        countryCode: { label: "Country", type: "text", value: "55" },
      },
      async authorize({ phone, code, countryCode }) {
        if (!phone || !code) return null;

        const formatted = formatPhoneNumber(phone, countryCode || "55");

        const { data, error } = await supabaseServer.auth.verifyOtp({
          phone: formatted,
          token: code,
          type: "sms",
        });
        if (error || !data?.user) {
          const msg = error?.message.includes("expired")
            ? "Código expirado. Por favor, solicite um novo."
            : "Código inválido ou expirado";
          throw new Error(msg);
        }

        const profile = await getProfile(data.user.id);

        const user: User = {
          id: data.user.id,
          email: data.user.email,
          name: profile?.nome ?? null,
          image: profile?.avatar_url ?? null,
          tipo: profile?.tipo ?? "cliente", // required field ✅
        };

        return user;
      },
    }),
  ],

  /* ====================== CALLBACKS ====================== */
  callbacks: {
    async signIn({ user }) {
      if (!user?.id) return false;

      let stripeCustomerId: string | null = null;
      let profile = await getProfile(user.id);

      /* -------- New user -------- */
      if (!profile) {
        try {
          const cust = await stripe.customers.create({
            email: user.email ?? undefined,
            name: user.name ?? undefined,
            metadata: { supabase_user_id: user.id },
          });
          stripeCustomerId = cust.id;

          const { error: insErr } = await supabaseServer.from("profiles").insert({
            id: user.id,
            nome: user.name ?? null,
            email: user.email ?? null,
            avatar_url: user.image ?? null,
            tipo: "cliente",
            stripe_customer_id: stripeCustomerId,
          });
          if (insErr) throw insErr;
          profile = await getProfile(user.id);
        } catch (e: any) {
          console.error("Bootstrap error:", e.message);
          return false;
        }
      }

      /* -------- Existing user: ensure Stripe ID -------- */
      if (profile && !profile.stripe_customer_id) {
        try {
          const cust = await stripe.customers.create({
            email: user.email ?? profile.email ?? undefined,
            name: user.name ?? profile.nome ?? undefined,
            metadata: { supabase_user_id: user.id },
          });
          stripeCustomerId = cust.id;

          const { error: upErr } = await supabaseServer
            .from("profiles")
            .update({ stripe_customer_id: stripeCustomerId })
            .eq("id", user.id);
          if (upErr) throw upErr;
        } catch (e: any) {
          console.error("Stripe create error:", e.message);
          return false;
        }
      } else {
        stripeCustomerId = profile?.stripe_customer_id ?? null;
      }

      /* Attach custom fields for jwt/session */
      (user as any).stripeCustomerId = stripeCustomerId;
      (user as any).tipo = profile?.tipo ?? "cliente";
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tipo = (user as any).tipo;
        token.stripeCustomerId = (user as any).stripeCustomerId;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tipo = token.tipo as string;
        session.user.stripeCustomerId = token.stripeCustomerId as string;
      }
      return session;
    },
  },

  /* ====================== OTHER OPTIONS ====================== */
  pages: { signIn: "/login", newUser: "/cadastro" },

  session: { strategy: "jwt", maxAge: 86_400 }, // 1 day
  jwt: { maxAge: 86_400 },
};