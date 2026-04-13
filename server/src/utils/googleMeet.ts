import { google } from "googleapis";

/**
 * Creates a Google Calendar event with a Google Meet link attached.
 * Returns the Meet join URL, or null if env vars are missing or creation fails.
 *
 * Env vars required:
 *   GOOGLE_SERVICE_ACCOUNT_KEY  — JSON.stringify() of the service account key file
 *   GOOGLE_CALENDAR_EMAIL       — service account email (used as the calendarId)
 */
export async function createGoogleMeet(opts: {
  matchId: string;
  title: string;
  startTime: Date;
  endTime: Date;
}): Promise<string | null> {
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyRaw) {
    console.warn("[googleMeet] GOOGLE_SERVICE_ACCOUNT_KEY not set — skipping Meet creation");
    return null;
  }

  try {
    const credentials = JSON.parse(keyRaw) as object;
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    const calendar = google.calendar({ version: "v3", auth });

    const event = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_EMAIL ?? "primary",
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
    console.error("[googleMeet] Failed to create Meet link for match", opts.matchId, err);
    return null;
  }
}
