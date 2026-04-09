import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { z } from "zod";

export const reviewsRouter = Router();

reviewsRouter.use(requireAuth);

const createSchema = z.object({
  sessionId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(300).optional(),
});

// List reviews for a tutor
reviewsRouter.get("/tutor/:tutorId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { session: { match: { tutorId: req.params.tutorId } } },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        session: { select: { date: true, durationMinutes: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: reviews });
  } catch (err) {
    next(err);
  }
});

// Sessions current user can still review for a given tutor (confirmed, no review yet)
reviewsRouter.get("/reviewable/:tutorId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        tutorConfirmed: true,
        tuteeConfirmed: true,
        match: {
          tutorId: req.params.tutorId,
          request: { requesterId: req.userId },
        },
        reviews: { none: { reviewerId: req.userId } },
      },
      include: {
        match: { include: { request: { include: { subject: true } } } },
      },
      orderBy: { date: "desc" },
    });

    const result = sessions.map((s) => ({
      sessionId: s.id,
      subjectName: s.match.request.subject.name,
      date: s.date,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Create a review
reviewsRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    const session = await prisma.session.findUnique({
      where: { id: parsed.data.sessionId },
      include: { match: { include: { request: true } } },
    });
    if (!session) throw new AppError(404, "Session not found");

    // Only tutee can review
    if (session.match.request.requesterId !== req.userId) {
      throw new AppError(403, "Only the tutee can leave a review");
    }

    // Session must be fully confirmed
    if (!session.tutorConfirmed || !session.tuteeConfirmed) {
      throw new AppError(400, "Session must be fully confirmed before reviewing");
    }

    // No duplicate reviews
    const existing = await prisma.review.findFirst({
      where: { sessionId: parsed.data.sessionId, reviewerId: req.userId },
    });
    if (existing) throw new AppError(409, "You already reviewed this session");

    const review = await prisma.review.create({
      data: {
        sessionId: parsed.data.sessionId,
        reviewerId: req.userId!,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
});
