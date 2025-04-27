import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth"; // Using alias defined in tsconfig

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
