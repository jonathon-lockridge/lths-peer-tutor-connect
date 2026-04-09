import { prisma } from "./prisma";
import { NotificationType } from "@prisma/client";
import { sendEmail, genericEmail } from "./email";
import { sendSms } from "./sms";

const APP_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

interface NotifyOptions {
  /** Skip sending email (use when the caller is sending a richer custom email separately) */
  skipEmail?: boolean;
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  linkTo?: string,
  opts?: NotifyOptions
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationsEnabled: true, email: true, phone: true, firstName: true },
  });
  if (!user) return null;

  // In-app notification (respects user toggle)
  let notification = null;
  if (user.notificationsEnabled !== false) {
    notification = await prisma.notification.create({
      data: { userId, type, title, body, linkTo },
    });
  }

  const name = user.firstName ?? "there";
  const link = linkTo ? `${APP_URL}${linkTo}` : APP_URL;

  // Email — always send regardless of notificationsEnabled toggle (unless caller handles it)
  if (user.email && !opts?.skipEmail) {
    await sendEmail(user.email, title, genericEmail(name, title, body, link));
  }

  // SMS — only if they provided a phone number
  if (user.phone) {
    try {
      await sendSms(user.phone, `${title}: ${body} — ${link}`);
    } catch (e) {
      console.error("[sms] Failed to send to", user.phone, e);
    }
  }

  return notification;
}
