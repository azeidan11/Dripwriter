// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function withRetry<T>(fn: () => Promise<T>, tries = 3, base = 400): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    // eslint-disable-next-line no-empty
    catch (e) { last = e; if (i < tries - 1) await sleep(base * (i + 1)); }
  }
  throw last;
}

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
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    // Persist user + Google tokens in DB
    async signIn({ user, account, profile }) {
      const email = (profile as any)?.email || user?.email;
      if (!email) return false;

      const name = (profile as any)?.name ?? user?.name ?? null;
      const access = account?.access_token ?? null;
      const refresh = account?.refresh_token ?? null; // often only on first consent
      const exp = account?.expires_at ?? null;        // seconds since epoch

      await withRetry(() =>
        prisma.user.upsert({
          where: { email },
          update: {
            name,
            ...(access ? { gAccessToken: access } : {}),
            ...(typeof exp === "number" ? { gAccessTokenExp: exp } : {}),
            ...(refresh ? { gRefreshToken: refresh } : {}),
          },
          create: {
            email,
            plan: "FREE",
            name,
            gAccessToken: access,
            gAccessTokenExp: typeof exp === "number" ? exp : null,
            gRefreshToken: refresh,
          },
        })
      );

      return true;
    },

    // Keep short-lived access token in the JWT for client usage (optional)
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        const ttl = typeof account.expires_in === "number" ? account.expires_in : 3600;
        token.expiresAt = Date.now() + ttl * 1000;
      }

      // If still valid, return as-is
      if (token.expiresAt && Date.now() < (token.expiresAt as number) - 60_000) return token;

      // Try refresh with refresh_token if present
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
          }).then((r) => r.json());

          if (!res?.access_token) {
            throw new Error(`Google token refresh failed: ${res?.error ?? "unknown_error"}`);
          }
          token.accessToken = res.access_token;
          const refreshTtl = typeof res.expires_in === "number" ? res.expires_in : 3600;
          token.expiresAt = Date.now() + refreshTtl * 1000;
          if (res.refresh_token) token.refreshToken = res.refresh_token;
        } catch {
          token.accessToken = undefined;
          token.refreshToken = undefined;
          token.expiresAt = undefined;
        }
      }

      return token;
    },

    // Enrich session with DB-backed fields
    async session({ session, token }) {
      try {
        const email = session?.user?.email as string | undefined;
        if (email) {
          const user = await prisma.user.findUnique({ where: { email } });
          if (user) {
            (session as any).userId = user.id;
            (session as any).plan = user.plan;
            if (session.user) session.user.name = user.name ?? session.user.name ?? null;
          } else {
            (session as any).userId = (token as any)?.userId ?? null;
            (session as any).plan = (token as any)?.plan ?? "FREE";
          }
        } else {
          (session as any).userId = (token as any)?.userId ?? null;
          (session as any).plan = (token as any)?.plan ?? "FREE";
        }
      } catch {
        (session as any).userId = (token as any)?.userId ?? null;
        (session as any).plan = (token as any)?.plan ?? "FREE";
      }

      (session as any).accessToken = (token as any)?.accessToken;
      (session as any).refreshToken = (token as any)?.refreshToken;
      return session;
    },
  },
};