import { PrismaAdapter } from "@auth/prisma-adapter";
import { type NextAuthOptions } from "next-auth";
import { type Adapter } from "next-auth/adapters";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  // Use Prisma adapter with Neon compatibility
  // Note: While @auth/neon-adapter exists, PrismaAdapter is generally 
  // recommended and works with NeonDB via the standard DATABASE_URL.
  // If specific Neon features are needed later, we can switch.
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    // Add authentication providers here (e.g., Google, GitHub, Email)
    // Example (install @auth/core and providers like google-provider):
    // import GoogleProvider from "next-auth/providers/google";
    // GoogleProvider({
    //   clientId: process.env.GOOGLE_CLIENT_ID!,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    // }),
  ],
  session: {
    // Use JSON Web Tokens for session management
    strategy: "jwt",
  },
  callbacks: {
    // Include user ID and potentially other custom fields in the JWT session
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Add other fields from your User model if needed
        // token.customField = user.customField;
      }
      return token;
    },
    // Include user ID and custom fields in the session object available client-side
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        // Add other fields
        // session.user.customField = token.customField;
      }
      return session;
    },
  },
  // Add secret from .env.local
  secret: process.env.AUTH_SECRET,
  // Configure pages if you want custom login/error pages
  // pages: {
  //   signIn: '/auth/signin',
  //   signOut: '/auth/signout',
  //   error: '/auth/error', // Error code passed in query string as ?error=
  //   verifyRequest: '/auth/verify-request', // (used for email/passwordless login)
  //   newUser: '/auth/new-user' // New users will be directed here on first sign in (leave the property out to disable)
  // }
};
