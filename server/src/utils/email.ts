import { Resend } from "resend";
import ical from "ical-generator";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? "LTHS Peer Tutor Connect <noreply@student-tutors.com>";

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: Buffer }[]
) {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
      })),
    });
  } catch (e) {
    console.error("[email] Failed to send to", to, e);
  }
}

export function generateICS(opts: {
  title: string;
  description: string;
  start: Date;
  end: Date;
  location: string;
  meetingUrl?: string;
  organizerEmail: string;
}): Buffer {
  const cal = ical({ name: "LTHS Peer Tutor Connect" });
  cal.createEvent({
    start: opts.start,
    end: opts.end,
    summary: opts.title,
    description: opts.meetingUrl
      ? `${opts.description}\n\nJoin meeting: ${opts.meetingUrl}`
      : opts.description,
    location: opts.meetingUrl ?? opts.location,
    url: opts.meetingUrl,
    organizer: { name: "LTHS Peer Tutor Connect", email: opts.organizerEmail },
  });
  return Buffer.from(cal.toString());
}

export function newRequestEmail(tutorName: string, studentName: string, subjectName: string, appUrl: string) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
      <h2 style="color:#b91c1c;">📚 New Tutoring Request</h2>
      <p>Hi ${tutorName},</p>
      <p><strong>${studentName}</strong> has requested your help with <strong>${subjectName}</strong>.</p>
      <p>Log in to accept or decline the request.</p>
      <a href="${appUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#b91c1c;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
        View Request
      </a>
      <p style="margin-top:24px;font-size:12px;color:#888;">LTHS Peer Tutor Connect · Lake Travis High School</p>
    </div>`;
}

export function matchAcceptedEmail(studentName: string, tutorName: string, subjectName: string, scheduledAt: string, location: string, appUrl: string, meetingUrl?: string) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
      <h2 style="color:#b91c1c;">✅ Session Confirmed</h2>
      <p>Hi ${studentName},</p>
      <p><strong>${tutorName}</strong> confirmed your <strong>${subjectName}</strong> tutoring session.</p>
      <table style="margin-top:16px;border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px;background:#f9f9f9;font-weight:600;">📅 When</td><td style="padding:8px;">${scheduledAt}</td></tr>
        <tr><td style="padding:8px;background:#f9f9f9;font-weight:600;">📍 Where</td><td style="padding:8px;">${location}</td></tr>
        ${meetingUrl ? `<tr><td style="padding:8px;background:#f9f9f9;font-weight:600;">🎥 Meeting</td><td style="padding:8px;"><a href="${meetingUrl}" style="color:#b91c1c;">${meetingUrl}</a></td></tr>` : ""}
      </table>
      <p style="margin-top:16px;font-size:13px;color:#555;">📎 A calendar invite is attached — add it to Google Calendar, Apple Calendar, or Outlook.</p>
      ${meetingUrl ? `<a href="${meetingUrl}" style="display:inline-block;margin-top:12px;padding:12px 24px;background:#b91c1c;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">🎥 Join Meeting</a>` : ""}
      <a href="${appUrl}" style="display:inline-block;margin-top:12px;margin-left:${meetingUrl ? "12px" : "0"};padding:12px 24px;background:#b91c1c;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View in App</a>
      <p style="margin-top:24px;font-size:12px;color:#888;">LTHS Peer Tutor Connect · Lake Travis High School</p>
    </div>`;
}

export function sessionReminderEmail(name: string, subjectName: string, scheduledAt: string, location: string, appUrl: string) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
      <h2 style="color:#b91c1c;">⏰ Session Reminder</h2>
      <p>Hi ${name},</p>
      <p>Your <strong>${subjectName}</strong> session starts in about <strong>1 hour</strong>.</p>
      <table style="margin-top:16px;border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px;background:#f9f9f9;font-weight:600;border-radius:4px;">📅 When</td><td style="padding:8px;">${scheduledAt}</td></tr>
        <tr><td style="padding:8px;background:#f9f9f9;font-weight:600;border-radius:4px;">📍 Where</td><td style="padding:8px;">${location}</td></tr>
      </table>
      <a href="${appUrl}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#b91c1c;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
        View Session
      </a>
      <p style="margin-top:24px;font-size:12px;color:#888;">LTHS Peer Tutor Connect · Lake Travis High School</p>
    </div>`;
}

export function genericEmail(name: string, title: string, body: string, appUrl: string) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
      <h2 style="color:#b91c1c;">${title}</h2>
      <p>Hi ${name},</p>
      <p>${body}</p>
      <a href="${appUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#b91c1c;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
        Open App
      </a>
      <p style="margin-top:24px;font-size:12px;color:#888;">LTHS Peer Tutor Connect · Lake Travis High School</p>
    </div>`;
}
