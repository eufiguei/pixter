import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { supabase } from '@/lib/supabase/client';

// Configuração do NextAuth
const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'Email e Senha',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (error || !data.user) {
            return null;
          }

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.email?.split('@')[0],
          };
        } catch (error) {
          console.error('Erro ao autenticar:', error);
          return null;
        }
      }
    }),
  ],
  pages: {
    signIn: '/login',
    newUser: '/cadastro',
  },
  session: {
    strategy: 'jwt',
  },
});

export { handler as GET, handler as POST };
