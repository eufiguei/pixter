import "next-auth";

// Augment the built-in types for `next-auth` to ensure Session includes `user`

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string;
      email?: string;
      name?: string;
      tipo?: string; // custom role discriminator ("motorista", "cliente", etc.)
      stripeCustomerId?: string | null;
      stripeAccountId?: string | null;
      [key: string]: any; // allow any additional props
    };
  }
}

// Ensures the file is treated as a module
export {};
