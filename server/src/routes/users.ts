import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, optionalAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { z } from "zod";

export const usersRouter = Router();

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  grade: z.number().int().min(9).max(12).optional(),
  bio: z.string().max(500).nullable().optional(),
  phone: z.string().regex(/^[\d\s\-\+\(\)\.]{7,20}$/, "Invalid phone number format").nullable().optional(),
  isTutor: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  avatarUrl: z.string()
    .refine((val) => val.startsWith("data:image/") || /^https?:\/\//.test(val), "Invalid image")
    .nullable().optional(),
});

// List tutors (public — optionalAuth so unauthenticated visitors can browse)
usersRouter.get("/tutors", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { subjectId, grade, search } = req.query;
    const tutors = await prisma.user.findMany({
      where: {
        isTutor: true,
        ...(grade ? { grade: Number(grade) } : {}),
        ...(subjectId
          ? { tutorSubjects: { some: { subjectId: subjectId as string } } }
          : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search as string, mode: "insensitive" } },
                { lastName: { contains: search as string, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        tutorSubjects: { include: { subject: true } },
        volunteerHours: true,
        badges: true,
        availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      },
      orderBy: { firstName: "asc" },
    });

    // Compute average rating & total hours for each tutor
    const tutorProfiles = await Promise.all(
      tutors.map(async (t) => {
        const reviews = await prisma.review.findMany({ where: { tutorId: t.id } });
        const avgRating =
          reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : null;
        const totalMinutes = t.volunteerHours.reduce((sum, h) => sum + h.totalMinutes, 0);
        return {
          ...t,
          averageRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
          totalHoursTutored: Math.round(totalMinutes / 60),
        };
      })
    );

    res.json({ success: true, data: tutorProfiles });
  } catch (err) {
    next(err);
  }
});

// Get single user/tutor profile (public)
usersRouter.get("/:id", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        tutorSubjects: { include: { subject: true } },
        volunteerHours: true,
        badges: true,
        availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      },
    });
    if (!user) throw new AppError(404, "User not found");

    const reviews = await prisma.review.findMany({
      where: { tutorId: user.id },
      include: { reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    res.json({
      success: true,
      data: {
        ...user,
        averageRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        totalHoursTutored: Math.round(
          user.volunteerHours.reduce((sum, h) => sum + h.totalMinutes, 0) / 60
        ),
        recentReviews: reviews,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update own profile (requires auth)
usersRouter.patch("/me", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: parsed.data,
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});
