import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { createNotification } from "../utils/notify";

export const verificationRouter = Router();

verificationRouter.use(requireAuth);

// Block SSRF: reject private/local network URLs
function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost") return false;
    if (/^127\./.test(h)) return false;
    if (/^10\./.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    if (/^192\.168\./.test(h)) return false;
    if (/^169\.254\./.test(h)) return false; // link-local
    return true;
  } catch {
    return false;
  }
}

const submitSchema = z.object({
  subjectId: z.string().min(1),
  evidenceType: z.enum(["grades", "skyward", "screenshot", "other"]),
  evidenceNote: z.string().min(10).max(1000),
  // Require a valid public HTTPS URL — blocks file://, localhost, private IPs (SSRF)
  evidenceUrl: z
    .string()
    .url("Please provide a valid URL for your evidence.")
    .refine(isSafeUrl, "Evidence URL must be a public HTTPS address."),
  gpaOrGrade: z.string().max(20).optional(),
  selfRating: z.number().int().min(1).max(5).default(3),
});

// Student: submit a verification request
verificationRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);
    const { subjectId, evidenceType, evidenceNote, evidenceUrl, gpaOrGrade, selfRating } = parsed.data;

    // Check subject exists
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new AppError(404, "Subject not found");

    // Check for existing pending/approved verification for this subject
    const existing = await prisma.tutorVerification.findFirst({
      where: { userId: req.userId!, subjectId, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (existing) {
      throw new AppError(409, existing.status === "APPROVED"
        ? "You are already approved to tutor this subject"
        : "You already have a pending verification for this subject");
    }

    const verification = await prisma.tutorVerification.create({
      data: {
        userId: req.userId!,
        subjectId,
        evidenceType,
        evidenceNote,
        evidenceUrl,
        gpaOrGrade: gpaOrGrade || null,
        selfRating,
      },
      include: { subject: true },
    });

    // Notify admins
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    await Promise.all(
      admins.map((a) =>
        createNotification(a.id, "NEW_REQUEST", "New tutor verification", `A student submitted verification for ${subject.name}.`, "/admin")
      )
    );

    res.status(201).json({ success: true, data: verification });
  } catch (err) {
    next(err);
  }
});

// Student: get own verifications
verificationRouter.get("/mine", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const verifications = await prisma.tutorVerification.findMany({
      where: { userId: req.userId! },
      include: { subject: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: verifications });
  } catch (err) {
    next(err);
  }
});

// Admin: list all pending verifications
verificationRouter.get("/pending", requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const verifications = await prisma.tutorVerification.findMany({
      where: { status: "PENDING" },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, grade: true } },
        subject: true,
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, data: verifications });
  } catch (err) {
    next(err);
  }
});

const reviewSchema = z.object({
  reviewNote: z.string().max(500).optional(),
  selfRatingOverride: z.number().int().min(1).max(5).optional(),
});

// Admin: approve a verification
verificationRouter.post("/:id/approve", requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    const verification = await prisma.tutorVerification.findUnique({
      where: { id: req.params.id },
      include: { subject: true },
    });
    if (!verification) throw new AppError(404, "Verification not found");
    if (verification.status !== "PENDING") throw new AppError(409, "Already reviewed");

    const finalRating = parsed.data.selfRatingOverride ?? verification.selfRating;

    await prisma.$transaction([
      prisma.tutorVerification.update({
        where: { id: req.params.id },
        data: { status: "APPROVED", reviewedBy: req.userId, reviewNote: parsed.data.reviewNote ?? null },
      }),
      // Upsert the TutorSubject using admin's override or student's submitted rating
      prisma.tutorSubject.upsert({
        where: { userId_subjectId: { userId: verification.userId, subjectId: verification.subjectId } },
        update: { selfRating: finalRating },
        create: { userId: verification.userId, subjectId: verification.subjectId, selfRating: finalRating },
      }),
      // Set isTutor = true
      prisma.user.update({
        where: { id: verification.userId },
        data: { isTutor: true },
      }),
    ]);

    await createNotification(
      verification.userId,
      "TUTOR_APPROVED",
      "Tutor application approved!",
      `You are now approved to tutor ${verification.subject.name}. You will appear in search results.`,
      "/profile"
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Admin: reject a verification
verificationRouter.post("/:id/reject", requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    const verification = await prisma.tutorVerification.findUnique({
      where: { id: req.params.id },
      include: { subject: true },
    });
    if (!verification) throw new AppError(404, "Verification not found");
    if (verification.status !== "PENDING") throw new AppError(409, "Already reviewed");

    await prisma.tutorVerification.update({
      where: { id: req.params.id },
      data: { status: "REJECTED", reviewedBy: req.userId, reviewNote: parsed.data.reviewNote ?? null },
    });

    await createNotification(
      verification.userId,
      "TUTOR_REJECTED",
      "Tutor application not approved",
      parsed.data.reviewNote
        ? `Your ${verification.subject.name} application was not approved: ${parsed.data.reviewNote}`
        : `Your ${verification.subject.name} application was not approved. You may reapply with additional evidence.`,
      "/profile"
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
