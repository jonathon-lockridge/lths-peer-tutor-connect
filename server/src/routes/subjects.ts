import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { z } from "zod";
import { SubjectCategory } from "@prisma/client";

export const subjectsRouter = Router();

subjectsRouter.use(requireAuth);

const createSubjectSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.nativeEnum(SubjectCategory),
});

// List all subjects
subjectsRouter.get("/", async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" } });
    res.json({ success: true, data: subjects });
  } catch (err) {
    next(err);
  }
});

// Create subject (admin only)
subjectsRouter.post("/", requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createSubjectSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);
    const subject = await prisma.subject.create({ data: parsed.data });
    res.status(201).json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
});
