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

  const now = Math.floor(Date.now() / 1000);
  let access = user.gAccessToken ?? undefined;
  let exp = user.gAccessTokenExp ?? 0;

  // Refresh if missing/expired/expiring within 60s
  if (!access || !exp || exp - now < 60) {
    // Use deprecated method via any-cast to access credentials shape cleanly
    const res = await (oauth2 as any).refreshAccessToken();
    const creds: any = res?.credentials ?? {};
    const newAccess = typeof creds.access_token === "string" ? creds.access_token : undefined;
    if (!newAccess) throw new Error("Failed to refresh Google access token.");
    const newExp = creds.expiry_date ? Math.floor(Number(creds.expiry_date) / 1000) : now + 3600;

    await prisma.user.update({
      where: { id: userId },
      data: { gAccessToken: newAccess, gAccessTokenExp: newExp },
    });

    access = newAccess;
    exp = newExp;
  }

  oauth2.setCredentials({ access_token: access, refresh_token: user.gRefreshToken });
  return oauth2;
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