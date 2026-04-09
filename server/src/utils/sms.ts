import twilio from "twilio";

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const FROM = process.env.TWILIO_PHONE_NUMBER ?? "";

export async function sendSms(to: string, body: string) {
  if (!client || !FROM) return; // Not configured — skip silently
  // Normalize: strip non-digits then prepend +1 if no country code
  const digits = to.replace(/\D/g, "");
  const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
  if (e164.length < 10) return;
  try {
    await client.messages.create({ from: FROM, to: e164, body });
  } catch (e) {
    console.error("[sms] Failed to send to", to, e);
  }
}
