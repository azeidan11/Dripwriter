import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

import { prisma } from "@/lib/db";

export async function getOAuthFromSession() {
  const session = await getServerSession(authOptions as any);
  const accessToken = (session as any)?.accessToken;
  const refreshToken = (session as any)?.refreshToken;

  if (!accessToken) {
    throw new Error("Unauthorized: no Google access token in session.");
  }

  const redirectUri = new URL("/api/auth/callback/google", process.env.NEXTAUTH_URL!).toString();
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri
  );

  oAuth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oAuth2Client;
}

export async function createDoc(oAuth: any, title: string) {
  const docs = google.docs({ version: "v1", auth: oAuth });
  const res = await docs.documents.create({ requestBody: { title } });
  return res.data.documentId!;
}

export async function appendAtEnd(oAuth: any, docId: string, text: string) {
  const docs = google.docs({ version: "v1", auth: oAuth });
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            text,
            endOfSegmentLocation: { segmentId: "" }, // appends at end
          },
        },
      ],
    },
  });
}


/**
 * === NEW HELPERS (non-breaking additions) ===
 * These helpers fetch Google tokens from the User row, auto-refresh access tokens when needed,
 * persist the refreshed token/expiry, and return a ready-to-use Google Docs client.
 *
 * Usage from API routes (recommended):
 *   const docs = await getDocsClientForUser(userId)
 *   await docs.documents.batchUpdate(...)
 */

function epoch() { return Math.floor(Date.now() / 1000); }

async function refreshAccessToken(refreshToken: string): Promise<{ access: string; exp: number; newRefresh?: string }> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars");
  }
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Google token refresh failed (${resp.status}): ${txt}`);
  }
  const json: { access_token?: string; expires_in?: number; refresh_token?: string } = await resp.json();
  if (!json.access_token || !json.expires_in) {
    throw new Error("Google refresh response missing access_token/expires_in");
  }
  return { access: json.access_token, exp: epoch() + Number(json.expires_in), newRefresh: json.refresh_token };
}

/** Returns an OAuth2 client for a given user with a valid access token. */
export async function getOAuthForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gAccessToken: true, gAccessTokenExp: true, gRefreshToken: true },
  });

  if (!user?.gRefreshToken) {
    throw new Error("No Google refresh token on file for this user.");
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );

  const skew = 60; // seconds
  const now = epoch();
  let access = user.gAccessToken ?? undefined;
  let exp = user.gAccessTokenExp ?? 0;

  if (!access || !exp || exp - now < skew) {
    const refreshed = await refreshAccessToken(user.gRefreshToken);
    await prisma.user.update({
      where: { id: userId },
      data: {
        gAccessToken: refreshed.access,
        gAccessTokenExp: refreshed.exp,
        ...(refreshed.newRefresh ? { gRefreshToken: refreshed.newRefresh } : {}),
      },
    });
    access = refreshed.access;
    exp = refreshed.exp;
  }

  oauth2.setCredentials({ access_token: access, refresh_token: user.gRefreshToken });
  return oauth2;
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const oauth = await getOAuthForUser(userId);
  const creds = (oauth as any).credentials || {};
  if (typeof creds.access_token === "string" && creds.access_token.length > 0) return creds.access_token;
  throw new Error("No Google access token available after refresh.");
}

/** Returns a Google Docs client for the given user with a guaranteed-valid token. */
export async function getDocsClientForUser(userId: string) {
  const auth = await getOAuthForUser(userId);
  return google.docs({ version: "v1", auth });
}

/** Convenience: create a doc for the given user and return its documentId. */
export async function createDocForUser(userId: string, title: string) {
  const docs = await getDocsClientForUser(userId);
  const res = await docs.documents.create({ requestBody: { title } });
  return res.data.documentId!;
}

/** Convenience: append text at the end of a doc for the given user. */
export async function appendAtEndForUser(userId: string, docId: string, text: string) {
  const docs = await getDocsClientForUser(userId);
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            text,
            endOfSegmentLocation: { segmentId: "" }, // append at end
          },
        },
      ],
    },
  });
}