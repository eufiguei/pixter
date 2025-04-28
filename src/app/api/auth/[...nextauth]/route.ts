import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { supabase } from '@/lib/supabase/client';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
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

          if (error) {
            console.error('Erro ao fazer login:', error);
            return null;
          }

          if (!data.user) {
            return null;
          }

          // Buscar perfil do usuário
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profileError) {
            console.error('Erro ao buscar perfil:', profileError);
            return null;
          }

          return {
            id: data.user.id,
            email: data.user.email,
            name: profile.nome,
            image: null,
            tipo: profile.tipo || 'cliente',
          };
        } catch (error) {
          console.error('Erro ao autorizar:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Adiciona dados do usuário ao token
      if (user) {
        token.id = user.id;
        token.tipo = user.tipo;
      }

      // Se for login com Google, cria ou atualiza o usuário no Supabase
      if (account && account.provider === 'google') {
        try {
          // Verificar se o usuário já existe
          const { data: existingUser, error: userError } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', token.email)
            .single();

          if (userError && userError.code !== 'PGRST116') { // PGRST116 = não encontrado
            console.error('Erro ao verificar usuário existente:', userError);
          }

          if (!existingUser) {
            // Criar usuário no Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: token.email,
              password: Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10),
              options: {
                data: {
                  name: token.name,
                  tipo: 'cliente',
                }
              }
            });

            if (authError) {
              console.error('Erro ao criar usuário no Supabase Auth:', authError);
            } else {
              // Criar perfil do usuário
              const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                  id: authData.user.id,
                  nome: token.name,
                  email: token.email,
                  tipo: 'cliente',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });

              if (profileError) {
                console.error('Erro ao criar perfil do usuário:', profileError);
              }

              token.id = authData.user.id;
              token.tipo = 'cliente';
            }
          } else {
            token.id = existingUser.id;
            token.tipo = 'cliente';
          }
        } catch (error) {
          console.error('Erro ao processar login com Google:', error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      // Adiciona dados do usuário à sessão
      if (token) {
        session.user.id = token.id;
        session.user.tipo = token.tipo;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Redireciona para o dashboard após login
      return url.startsWith(baseUrl) ? url : `${baseUrl}/dashboard`;
    }
  },
  pages: {
    signIn: '/login',
    signUp: '/cadastro',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
