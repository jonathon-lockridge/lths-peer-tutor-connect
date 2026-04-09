import { prisma } from "./prisma";
import { NotificationType } from "@prisma/client";
import { sendEmail, genericEmail } from "./email";
import { sendSms } from "./sms";

const APP_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  linkTo?: string
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

  // Email — always send regardless of notificationsEnabled toggle
  if (user.email) {
    await sendEmail(user.email, title, genericEmail(name, title, body, link));
  }

  // SMS — only if they provided a phone number
  if (user.phone) {
    await sendSms(user.phone, `${title}: ${body} — ${link}`);
  }

  return notification;
}
