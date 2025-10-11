export const runtime = "nodejs";

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const scopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

const authOptions = {
  providers: [
    Google({
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
      return token;
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      return session;
    },
  },
} as const;

const handler = NextAuth(authOptions as any);
export { handler as GET, handler as POST };