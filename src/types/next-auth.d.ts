import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & { id: string; tipo: string };
  }
  interface User extends DefaultUser {
    tipo: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tipo: string;
  }
}

export {};            // necessário porque "isolatedModules": true
