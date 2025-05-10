// src/app/api/auth/[...nextauth]/route.ts (Corrected - Imports authOptions)
// @ts-ignore - Bypassing TypeScript errors for NextAuth imports
import NextAuth from "next-auth/next";
import { authOptions } from "@/lib/auth/options"; // Import from the new location

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };