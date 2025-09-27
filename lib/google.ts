import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function getOAuthFromSession() {
  const session = await getServerSession(authOptions as any);
  const accessToken = (session as any)?.accessToken;
  const refreshToken = (session as any)?.refreshToken;

  if (!accessToken) {
    throw new Error("Unauthorized: no Google access token in session.");
  }

  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.NEXTAUTH_URL + "/api/auth/callback/google"
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