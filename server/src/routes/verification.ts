import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { createNotification } from "../utils/notify";

export const verificationRouter = Router();

verificationRouter.use(requireAuth);

const submitSchema = z.object({
  subjectId: z.string().min(1),
  evidenceType: z.enum(["grades", "skyward", "screenshot", "other"]),
  evidenceNote: z.string().min(10).max(1000),
  // Require actual documentary evidence — a file URL (uploaded screenshot) or an external URL
  evidenceUrl: z.string().min(10, "Please upload a screenshot as proof."),
  gpaOrGrade: z.string().max(20).optional(),
});

// Student: submit a verification request
verificationRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);
    const { subjectId, evidenceType, evidenceNote, evidenceUrl, gpaOrGrade } = parsed.data;

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

const reviewSchema = z.object({ reviewNote: z.string().max(500).optional() });

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

    await prisma.$transaction([
      prisma.tutorVerification.update({
        where: { id: req.params.id },
        data: { status: "APPROVED", reviewedBy: req.userId, reviewNote: parsed.data.reviewNote ?? null },
      }),
      // Upsert the TutorSubject entry so they appear in search results
      prisma.tutorSubject.upsert({
        where: { userId_subjectId: { userId: verification.userId, subjectId: verification.subjectId } },
        update: {},
        create: { userId: verification.userId, subjectId: verification.subjectId },
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
