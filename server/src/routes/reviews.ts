import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { checkAndAwardTopRated } from "./badges";
import { z } from "zod";

export const reviewsRouter = Router();

reviewsRouter.use(requireAuth);

const createSchema = z.object({
  tutorId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(300).optional(),
});

// List reviews for a tutor
reviewsRouter.get("/tutor/:tutorId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { tutorId: req.params.tutorId },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: reviews });
  } catch (err) {
    next(err);
  }
});

// Check if current user can review a given tutor
reviewsRouter.get("/can-review/:tutorId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutorId = req.params.tutorId;

    // Check for existing review
    const existing = await prisma.review.findFirst({
      where: { tutorId, reviewerId: req.userId },
    });

    if (existing) {
      return res.json({ success: true, data: { canReview: false, hasReviewed: true, existingReview: existing } });
    }

    // Must have at least 1 fully confirmed match with this tutor where scheduledAt is in the past
    const eligibleMatch = await prisma.match.findFirst({
      where: {
        tutorId,
        OR: [{ studentId: req.userId }, { request: { requesterId: req.userId } }],
        status: { in: ["ACCEPTED", "COMPLETED"] },
        scheduledAt: { lt: new Date() },
        sessions: { some: { tutorConfirmed: true, tuteeConfirmed: true } },
      },
    });

    res.json({ success: true, data: { canReview: !!eligibleMatch, hasReviewed: false } });
  } catch (err) {
    next(err);
  }
});

// Create a review (one per tutor per student, rating required)
reviewsRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    const { tutorId, rating, comment } = parsed.data;

    if (tutorId === req.userId) throw new AppError(400, "You cannot review yourself");

    // Verify tutor exists
    const tutor = await prisma.user.findUnique({ where: { id: tutorId }, select: { id: true, isTutor: true } });
    if (!tutor || !tutor.isTutor) throw new AppError(404, "Tutor not found");

    // Must have at least 1 fully confirmed match with this tutor where scheduledAt is past
    const eligibleMatch = await prisma.match.findFirst({
      where: {
        tutorId,
        OR: [{ studentId: req.userId }, { request: { requesterId: req.userId } }],
        status: { in: ["ACCEPTED", "COMPLETED"] },
        scheduledAt: { lt: new Date() },
        sessions: { some: { tutorConfirmed: true, tuteeConfirmed: true } },
      },
    });
    if (!eligibleMatch) {
      throw new AppError(403, "You must complete a session with this tutor before reviewing");
    }

    // Enforce one review per tutor per student
    const existing = await prisma.review.findFirst({
      where: { tutorId, reviewerId: req.userId },
    });
    if (existing) {
      throw new AppError(409, "You already reviewed this tutor. Delete your review to submit a new one.");
    }

    const review = await prisma.review.create({
      data: {
        tutorId,
        reviewerId: req.userId!,
        rating,
        comment: comment ?? null,
      },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    // Re-evaluate TOP_RATED badge
    await checkAndAwardTopRated(tutorId);

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
});

// Delete own review (allows re-reviewing the same tutor)
reviewsRouter.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review || review.reviewerId !== req.userId) {
      throw new AppError(404, "Review not found");
    }
    const tutorId = review.tutorId;
    await prisma.review.delete({ where: { id: req.params.id } });

    // Re-evaluate TOP_RATED badge after deletion
    if (tutorId) {
      await checkAndAwardTopRated(tutorId);
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
