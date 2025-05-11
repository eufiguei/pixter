import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      tipo: string;
      celular?: string | null; // Added celular property
    };
  }
  interface User extends DefaultUser {
    tipo: string;
    celular?: string | null; // Added celular property
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tipo: string;
    celular?: string | null; // Added celular property
  }
}

export {}; // necessary because "isolatedModules": true

