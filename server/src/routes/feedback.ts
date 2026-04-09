import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";

export const feedbackRouter = Router();

feedbackRouter.use(requireAuth);

const submitSchema = z.object({
  body: z.string().min(5).max(500),
});

// Submit app feedback
feedbackRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    const feedback = await prisma.appFeedback.create({
      data: { userId: req.userId!, body: parsed.data.body },
    });

    res.status(201).json({ success: true, data: feedback });
  } catch (err) {
    next(err);
  }
});

// Admin: list recent feedback
feedbackRouter.get("/", requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const feedback = await prisma.appFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    res.json({ success: true, data: feedback });
  } catch (err) {
    next(err);
  }
});
