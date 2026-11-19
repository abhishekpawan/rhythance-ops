/**
 * Sends a jobseeker's documents to the AI document check (the separate godspeed-ops-ai service).
 *
 * Only what the check needs leaves this server: the profile id, the user id and the documents (paths and
 * types; the files themselves are read by the AI service). Names, date of birth, SIN, pay rates and the rest
 * of the profile are never sent. The check runs in the background: a failure is logged and never fails the
 * request that triggered it.
 *
 * AI_VERIFICATION_URL must be set per portal; there is no default (the old default was a dead Heroku app).
 */
import dotenv from "dotenv";

dotenv.config();

export interface DocumentCheckPayload {
  id?: string | null;
  user_id: string;
  documents: unknown[];
}

export function aiVerificationUrl(): string | null {
  const url = (process.env.AI_VERIFICATION_URL || "").trim();
  return url || null;
}

if (!aiVerificationUrl()) {
  console.error(
    "AI_VERIFICATION_URL is not set: uploaded documents will not be sent to the AI document check."
  );
}

/** Fire-and-forget: call without await. `authHeader` is the signed-in user's own Authorization header. */
export async function sendDocumentsToAiCheck(
  payload: DocumentCheckPayload,
  authHeader?: string
): Promise<void> {
  const url = aiVerificationUrl();
  if (!url) {
    console.error(
      "AI document check skipped: AI_VERIFICATION_URL is not set for this portal."
    );
    return;
  }
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers["Authorization"] = authHeader;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: payload.id ?? null,
        user_id: payload.user_id,
        documents: payload.documents,
      }),
    });
    if (!response.ok) {
      console.error("AI verification service error:", response.status);
    }
  } catch (error) {
    console.error(
      "Error sending data to AI verification service:",
      error instanceof Error ? error.name : "error"
    );
  }
}
