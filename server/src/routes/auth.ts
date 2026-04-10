import { Router, Request, Response, NextFunction } from "express";
import { Webhook } from "svix";
import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { z } from "zod";

export const authRouter = Router();

// Emails/domains that receive ADMIN role automatically
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const ADMIN_DOMAINS = ["@ltisdschools.org"];

export function isAdminEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (ADMIN_EMAILS.includes(lower)) return true;
  return ADMIN_DOMAINS.some((d) => lower.endsWith(d));
}

const onboardingSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  grade: z.number().int().min(9).max(12),
  bio: z.string().max(500).optional(),
});

// Clerk webhook — sync user creates/deletes
authRouter.post("/webhook", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) throw new AppError(500, "Webhook secret not configured");

    const svix_id = req.headers["svix-id"] as string;
    const svix_timestamp = req.headers["svix-timestamp"] as string;
    const svix_signature = req.headers["svix-signature"] as string;

    if (!svix_id || !svix_timestamp || !svix_signature) {
      throw new AppError(400, "Missing svix headers");
    }

    const wh = new Webhook(WEBHOOK_SECRET);
    const payload = wh.verify(req.body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as { type: string; data: Record<string, unknown> };

    if (payload.type === "user.created") {
      const data = payload.data as {
        id: string;
        email_addresses: { email_address: string }[];
        first_name?: string;
        last_name?: string;
        image_url?: string;
      };
      const email = data.email_addresses[0]?.email_address ?? "";
      const isSchoolEmail =
        email.endsWith("@ltisdschools.org") || email.endsWith("@ltisdschools.net");
      if (!isSchoolEmail) {
        res.status(200).json({ success: true });
        return;
      }
      const isAdmin = isAdminEmail(email);
      await prisma.user.upsert({
        where: { clerkId: data.id },
        update: {},
        create: {
          clerkId: data.id,
          email,
          firstName: data.first_name ?? "",
          lastName: data.last_name ?? "",
          grade: 9,
          role: isAdmin ? "ADMIN" : "STUDENT",
          avatarUrl: data.image_url,
        },
      });
    }

    if (payload.type === "user.updated") {
      const data = payload.data as {
        id: string;
        image_url?: string;
        first_name?: string;
        last_name?: string;
      };
      await prisma.user.updateMany({
        where: { clerkId: data.id },
        data: {
          ...(data.image_url !== undefined ? { avatarUrl: data.image_url } : {}),
          ...(data.first_name ? { firstName: data.first_name } : {}),
          ...(data.last_name ? { lastName: data.last_name } : {}),
        },
      });
    }

    if (payload.type === "user.deleted") {
      const data = payload.data as { id: string };
      await prisma.user.deleteMany({ where: { clerkId: data.id } });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Complete onboarding after first login
authRouter.post("/onboard", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.errors[0].message);
    }
    const { firstName, lastName, grade, bio } = parsed.data;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { firstName, lastName, grade, bio },
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// Get current user
authRouter.get("/me", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new AppError(404, "User not found");
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});
