// src/app/api/auth/[...nextauth]/route.ts (Corrected - Imports authOptions)
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/options"; // Import from the new location

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };