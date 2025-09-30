import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";

const scopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: scopes,
          access_type: "offline",
          prompt: "consent", // ensures refresh_token on first login
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }: any) {
      const email = profile?.email;
      if (!email) return false;
      await prisma.user.upsert({
        where: { email },
        update: {
          name: (profile as any)?.name ?? null,
        },
        create: { email, plan: "FREE", name: (profile as any)?.name ?? null },
      });
      return true;
    },
    async jwt({ token, account }: any) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token; // may arrive only once
        token.expiresAt = Date.now() + account.expires_in * 1000;
      }
      // still valid?
      if (token.expiresAt && Date.now() < token.expiresAt - 60_000) return token;

      // try refreshing
      if (token.refreshToken) {
        try {
          const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
              refresh_token: String(token.refreshToken),
            }),
          }).then(r => r.json());

          token.accessToken = res.access_token;
          token.expiresAt = Date.now() + res.expires_in * 1000;
          if (res.refresh_token) token.refreshToken = res.refresh_token;
        } catch {
          token.accessToken = undefined;
          token.refreshToken = undefined;
          token.expiresAt = undefined;
        }
      }

      if (token?.email) {
        const user = await prisma.user.findUnique({ where: { email: token.email as string } });
        if (user) {
          (token as any).userId = user.id;
          (token as any).plan = user.plan;
        }
      }

      return token;
    },
    async session({ session, token }: any) {
      // Always prefer DB as the source of truth so plan changes reflect immediately
      const email = session?.user?.email as string | undefined;
      if (email) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          (session as any).userId = user.id;
          (session as any).plan = user.plan;
          if (session.user) {
            session.user.name = user.name ?? session.user.name ?? null;
          }
        } else {
          // Fallback to token payload if somehow user is missing
          (session as any).userId = (token as any)?.userId;
          (session as any).plan = (token as any)?.plan ?? "FREE";
        }
      } else {
        (session as any).userId = (token as any)?.userId;
        (session as any).plan = (token as any)?.plan ?? "FREE";
      }

      // Expose OAuth tokens for server-side Google API calls
      session.accessToken = (token as any)?.accessToken;
      session.refreshToken = (token as any)?.refreshToken;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };