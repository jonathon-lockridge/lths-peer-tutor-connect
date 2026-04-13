import { google } from "googleapis";

/**
 * Creates a Google Meet link via the Calendar API using OAuth2 credentials.
 * The credentials belong to a dedicated app Gmail account (not a user's personal Gmail).
 * The meeting is purely between the student and tutor — the app account is just the room creator.
 *
 * Required env vars (Railway):
 *   GOOGLE_CLIENT_ID      — from Google Cloud Console OAuth 2.0 credentials
 *   GOOGLE_CLIENT_SECRET  — from Google Cloud Console OAuth 2.0 credentials
 *   GOOGLE_REFRESH_TOKEN  — obtained once via the get-google-token script
 *
 * Returns null (gracefully) if env vars are missing or the API call fails.
 */
export async function createGoogleMeet(opts: {
  matchId: string;
  title: string;
  startTime: Date;
  endTime: Date;
}): Promise<string | null> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    console.warn("[googleMeet] Missing env vars — no Meet link generated");
    return null;
  }

  try {
    const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

    const calendar = google.calendar({ version: "v3", auth });

    const event = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      requestBody: {
        summary: opts.title,
        start: { dateTime: opts.startTime.toISOString() },
        end: { dateTime: opts.endTime.toISOString() },
        conferenceData: {
          createRequest: {
            requestId: opts.matchId, // idempotency key — same match always gets same Meet link
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });

    const uri = event.data.conferenceData?.entryPoints?.[0]?.uri ?? null;
    if (!uri) console.warn("[googleMeet] No Meet URI returned for match", opts.matchId);
    return uri;
  } catch (err) {
    console.error("[googleMeet] Failed to create Meet link:", err);
    return null;
  }
}
