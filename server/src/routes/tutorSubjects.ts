import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { z } from "zod";

export const tutorSubjectsRouter = Router();

tutorSubjectsRouter.use(requireAuth);

const addSchema = z.object({
  subjectId: z.string().min(1),
  selfRating: z.number().int().min(1).max(5).default(3),
});

// Get own tutor subjects
tutorSubjectsRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.tutorSubject.findMany({
      where: { userId: req.userId },
      include: { subject: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

// Add a subject to tutor
tutorSubjectsRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    const subject = await prisma.subject.findUnique({ where: { id: parsed.data.subjectId } });
    if (!subject) throw new AppError(404, "Subject not found");

    const item = await prisma.tutorSubject.upsert({
      where: { userId_subjectId: { userId: req.userId!, subjectId: parsed.data.subjectId } },
      update: { selfRating: parsed.data.selfRating },
      create: {
        userId: req.userId!,
        subjectId: parsed.data.subjectId,
        selfRating: parsed.data.selfRating,
      },
      include: { subject: true },
    });

    // Ensure user is marked as tutor
    await prisma.user.update({ where: { id: req.userId }, data: { isTutor: true } });

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// Remove a subject
tutorSubjectsRouter.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.tutorSubject.findUnique({ where: { id: req.params.id } });
    if (!item || item.userId !== req.userId) throw new AppError(404, "Not found");

    await prisma.tutorSubject.delete({ where: { id: req.params.id } });

    // If no more subjects, remove tutor flag
    const remaining = await prisma.tutorSubject.count({ where: { userId: req.userId } });
    if (remaining === 0) {
      await prisma.user.update({ where: { id: req.userId }, data: { isTutor: false } });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
