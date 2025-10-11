export const runtime = "nodejs";

import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function withRetry<T>(fn: () => Promise<T>, tries = 3, base = 400): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < tries - 1) await sleep(base * (i + 1)); }
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

const authOptions: NextAuthOptions = {
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
    async signIn({ user, account, profile }: any) {
      const email = profile?.email || user?.email;
      if (!email) return false;

      const name = (profile as any)?.name ?? user?.name ?? null;
      const access = account?.access_token ?? null;
      const refresh = account?.refresh_token ?? null; // may only arrive on first consent
      const exp = account?.expires_at ?? null; // seconds epoch

      await withRetry(() =>
        prisma.user.upsert({
          where: { email },
          update: {
            name,
            ...(access ? { gAccessToken: access } : {}),
            ...(exp ? { gAccessTokenExp: Number(exp) } : {}),
            ...(refresh ? { gRefreshToken: refresh } : {}),
          },
          create: {
            email,
            plan: "FREE",
            name,
            gAccessToken: access,
            gAccessTokenExp: exp ? Number(exp) : null,
            gRefreshToken: refresh,
          },
        })
      );

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

      // Persist latest tokens to DB so background jobs can use them
      if (token?.email && (token as any)?.accessToken) {
        const latest: any = {
          gAccessToken: (token as any).accessToken || null,
          gAccessTokenExp: (token as any).expiresAt ? Math.floor(Number((token as any).expiresAt) / 1000) : null,
        };
        if ((token as any).refreshToken) latest.gRefreshToken = (token as any).refreshToken;
        try {
          await prisma.user.update({ where: { email: token.email as string }, data: latest });
        } catch {}
      }

      return token;
    },
    async session({ session, token }: any) {
      try {
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
            (session as any).userId = (token as any)?.userId ?? null;
            (session as any).plan = (token as any)?.plan ?? "FREE";
          }
        } else {
          (session as any).userId = (token as any)?.userId ?? null;
          (session as any).plan = (token as any)?.plan ?? "FREE";
        }
      } catch (err) {
        // If the DB is unreachable or throws, never break the session endpoint
        console.error("[next-auth][session] error", err);
        (session as any).userId = (token as any)?.userId ?? null;
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