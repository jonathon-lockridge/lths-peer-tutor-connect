import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";

export const tutorSubjectsRouter = Router();

tutorSubjectsRouter.use(requireAuth);

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
