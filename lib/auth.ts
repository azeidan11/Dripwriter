// lib/auth.ts
import type { NextAuthOptions, Account, Profile, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";

/**
 * Small helpers for resilient DB writes during auth callback.
 */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
async function withRetry<T>(fn: () => Promise<T>, tries = 3, base = 300): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(base * (i + 1));
    }
  }
  throw lastErr;
}

/**
 * Google scopes we request. Includes Docs + Drive File.
 */
const scopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },

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
    /**
     * Upsert the user and persist Google tokens on sign-in.
     */
    async signIn({
      user,
      account,
      profile,
    }: {
      user: { email?: string | null; name?: string | null };
      account: Account | null;
      profile?: Profile | null;
    }) {
      const email = (profile as any)?.email || user?.email;
      if (!email) return false;

      const name = (profile as any)?.name ?? user?.name ?? null;
      const access = account?.access_token ?? null;
      const refresh = account?.refresh_token ?? null; // Often only on first consent
      const exp = account?.expires_at ?? null; // seconds since epoch

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

    /**
     * Keep short-lived access token in the JWT for optional client usage,
     * and refresh it when near expiry. Also hydrate from DB if missing.
     */
    async jwt({
      token,
      account,
    }: {
      token: JWT & { accessToken?: string; refreshToken?: string; expiresAt?: number };
      account?: Account | null;
    }) {
      // Initial sign-in
      if (account) {
        token.accessToken = account.access_token as string | undefined;
        token.refreshToken = (account.refresh_token as string | undefined) ?? token.refreshToken;
        const ttl = typeof account.expires_in === "number" ? account.expires_in : 3600;
        token.expiresAt = Date.now() + ttl * 1000;
      }

      // If we don't have a refresh token in the JWT (common on subsequent logins),
      // hydrate it from the database using the user's email.
      if (!token.refreshToken && token.email) {
        const u = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { gRefreshToken: true, gAccessToken: true, gAccessTokenExp: true },
        });
        if (u?.gRefreshToken) token.refreshToken = u.gRefreshToken;
        if (u?.gAccessToken) token.accessToken = u.gAccessToken as string;
        if (typeof u?.gAccessTokenExp === "number") {
          token.expiresAt = u.gAccessTokenExp * 1000; // DB stores seconds; JWT uses ms
        }
      }

      // If still valid, return as-is (refresh 60s before expiry)
      if (token.expiresAt && Date.now() < (token.expiresAt as number) - 60_000) return token;

      // Try to refresh using refresh_token
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
          }).then((r) => r.json() as Promise<any>);

          if (!res?.access_token) {
            throw new Error(`Google token refresh failed: ${res?.error ?? "unknown_error"}`);
          }

          token.accessToken = res.access_token as string;
          const refreshTtl = typeof res.expires_in === "number" ? res.expires_in : 3600;
          token.expiresAt = Date.now() + refreshTtl * 1000;
          if (res.refresh_token) token.refreshToken = res.refresh_token as string;

          // Persist back to DB (seconds since epoch)
          if (token.email) {
            await prisma.user.update({
              where: { email: token.email as string },
              data: {
                gAccessToken: token.accessToken,
                gAccessTokenExp: Math.floor((token.expiresAt as number) / 1000),
                ...(res.refresh_token ? { gRefreshToken: token.refreshToken! } : {}),
              },
            });
          }
        } catch {
          // Invalidate in-JWT access token; leave DB as-is
          token.accessToken = undefined;
          token.expiresAt = undefined;
        }
      }

      return token;
    },

    /**
     * Attach server-authoritative fields to session.
     */
    async session({
      session,
      token,
    }: {
      session: Session & { userId?: string | null; plan?: string | null; createdAt?: string | null } & {
        accessToken?: string;
        refreshToken?: string;
      };
      token: JWT & { accessToken?: string; refreshToken?: string; expiresAt?: number };
    }) {
      try {
        const email = session?.user?.email as string | undefined;
        if (email) {
          // Fetch only what we need (also avoids bringing token fields unnecessarily)
          const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, plan: true, name: true, createdAt: true },
          });

          if (user) {
            (session as any).userId = user.id;
            (session as any).plan = user.plan;
            (session as any).createdAt = user.createdAt ? user.createdAt.toISOString() : null;
            if (session.user) session.user.name = user.name ?? session.user.name ?? null;
          } else {
            // Fallback to whatever is in the JWT if DB lookup failed
            (session as any).userId = (token as any)?.userId ?? null;
            (session as any).plan = (token as any)?.plan ?? "FREE";
            (session as any).createdAt = null;
          }
        } else {
          (session as any).userId = (token as any)?.userId ?? null;
          (session as any).plan = (token as any)?.plan ?? "FREE";
          (session as any).createdAt = null;
        }
      } catch {
        (session as any).userId = (token as any)?.userId ?? null;
        (session as any).plan = (token as any)?.plan ?? "FREE";
        (session as any).createdAt = null;
      }

      // Surface short-lived Google tokens to the client (optional use)
      (session as any).accessToken = (token as any).accessToken;
      (session as any).refreshToken = (token as any).refreshToken;

      return session;
    },
  },
};

export default authOptions;