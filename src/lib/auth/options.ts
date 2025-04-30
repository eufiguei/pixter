// src/lib/auth/options.ts
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabaseServer as supabase } from "@/lib/supabase/server"; // Assuming server client is defined here

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
      name: "Email e Senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        /* 1. Autentica no Supabase */
        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });
        if (error || !data.user) return null;

        /* 2. Busca perfil do usuário */
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        /* 3. Devolve objeto esperado pelo NextAuth (User | AdapterUser) */
        return {
          id: data.user.id,
          email: data.user.email,
          name: profile?.nome || data.user.email?.split("@")[0],
          image: profile?.avatar_url || null,
          tipo: profile?.tipo || "cliente",
        };
      },
    }),
  ],

  /* ---------------------------------------------------------------
     Callbacks
  ----------------------------------------------------------------*/
  callbacks: {
    /* Garante que ‘tipo’ exista também no primeiro login Google */
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tipo")
          .eq("id", user.id)
          .single();
        (user as any).tipo = profile?.tipo ?? "cliente";
      }
      return true; // permite login
    },

    /* Adiciona id + tipo ao JWT */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tipo = (user as any).tipo;
      }
      return token;
    },

    /* Copia campos do token para a session retornada ao client */
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
