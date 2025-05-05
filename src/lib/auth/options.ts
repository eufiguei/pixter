/* ------------------------------------------------------------------
   NEXTAUTH + SUPABASE + STRIPE  (v2025-05)
   • Column in Supabase is `stripe_account_id`
   • No deep generics   • `tipo` is required on User
-------------------------------------------------------------------*/
import { NextAuthOptions, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { Stripe } from "stripe";
import { supabaseServer, formatPhoneNumber } from "@/lib/supabase/client";

/* ---------- Row type for `profiles` ---------- */
interface ProfileRow {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
  tipo: string | null;
  stripe_account_id: string | null;        // ← column name in Supabase
}

/* ---------- Stripe ---------- */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

/* ---------- Helper: fetch profile ---------- */
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
  /* ================= PROVIDERS ================= */
  providers: [
    /* Google OAuth */
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),

    /* Email + Password */
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
          tipo: profile?.tipo ?? "cliente", // required
        };
        return user;
      },
    }),

    /* Phone + OTP */
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
          throw new Error(
            error?.message.includes("expired")
              ? "Código expirado. Por favor, solicite um novo."
              : "Código inválido ou expirado"
          );
        }

        const profile = await getProfile(data.user.id);

        const user: User = {
          id: data.user.id,
          email: data.user.email,
          name: profile?.nome ?? null,
          image: profile?.avatar_url ?? null,
          tipo: profile?.tipo ?? "cliente",
        };
        return user;
      },
    }),
  ],

  /* ================= CALLBACKS ================= */
  callbacks: {
    /* -------- signIn -------- */
    async signIn({ user }) {
      if (!user?.id) return false;

      let stripeCustomerId: string | null = null;
      let profile = await getProfile(user.id);

      /* New user: create profile + Stripe customer */
      if (!profile) {
        try {
          const cust = await stripe.customers.create({
            email: user.email ?? undefined,
            name: user.name ?? undefined,
            metadata: { supabase_user_id: user.id },
          });
          stripeCustomerId = cust.id;

          const { error } = await supabaseServer.from("profiles").insert({
            id: user.id,
            nome: user.name ?? null,
            email: user.email ?? null,
            avatar_url: user.image ?? null,
            tipo: "cliente",
            stripe_account_id: stripeCustomerId,
          });
          if (error) throw error;

          profile = await getProfile(user.id); // refresh
        } catch (e: any) {
          console.error("Bootstrap error:", e.message);
          return false;
        }
      }

      /* Existing user: ensure Stripe ID */
      if (profile && !profile.stripe_account_id) {
        try {
          const cust = await stripe.customers.create({
            email: user.email ?? profile.email ?? undefined,
            name: user.name ?? profile.nome ?? undefined,
            metadata: { supabase_user_id: user.id },
          });
          stripeCustomerId = cust.id;

          const { error } = await supabaseServer
            .from("profiles")
            .update({ stripe_account_id: stripeCustomerId })
            .eq("id", user.id);
          if (error) throw error;
        } catch (e: any) {
          console.error("Stripe create error:", e.message);
          return false;
        }
      } else {
        stripeCustomerId = profile?.stripe_account_id ?? null;
      }

      /* expose custom fields to later callbacks */
      (user as any).stripeCustomerId = stripeCustomerId;
      (user as any).tipo = profile?.tipo ?? "cliente";
      return true;
    },

    /* -------- jwt -------- */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tipo = (user as any).tipo;
        token.stripeCustomerId = (user as any).stripeCustomerId;
      }
      return token;
    },

    /* -------- session -------- */
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as any; // cast once for custom props
        u.id = token.id;
        u.tipo = token.tipo;
        u.stripeCustomerId = token.stripeCustomerId;
      }
      return session;
    },
  },

  pages: { signIn: "/login", newUser: "/cadastro" },
  session: { strategy: "jwt", maxAge: 86_400 },
  jwt: { maxAge: 86_400 },
};