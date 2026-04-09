import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

// Overall stats
adminRouter.get("/stats", async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers,
      totalTutors,
      totalRequests,
      openRequests,
      totalSessions,
      confirmedSessions,
      totalMinutes,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { isTutor: true } }),
      prisma.tutoringRequest.count({ where: { status: { not: "CANCELLED" } } }),
      prisma.tutoringRequest.count({ where: { status: "OPEN" } }),
      prisma.session.count(),
      prisma.session.count({ where: { tutorConfirmed: true, tuteeConfirmed: true } }),
      prisma.session.aggregate({
        _sum: { durationMinutes: true },
        where: { tutorConfirmed: true, tuteeConfirmed: true },
      }),
    ]);

    // Most requested subjects — exclude cancelled requests
    const topSubjects = await prisma.tutoringRequest.groupBy({
      by: ["subjectId"],
      where: { status: { not: "CANCELLED" } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    });
    const subjectIds = topSubjects.map((s) => s.subjectId);
    const subjects = await prisma.subject.findMany({ where: { id: { in: subjectIds } } });
    const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s.name]));

    res.json({
      success: true,
      data: {
        totalUsers,
        totalTutors,
        totalRequests,
        openRequests,
        totalSessions,
        confirmedSessions,
        totalHours: Math.round((totalMinutes._sum.durationMinutes ?? 0) / 60),
        topSubjects: topSubjects.map((s) => ({
          subjectId: s.subjectId,
          subjectName: subjectMap[s.subjectId],
          count: s._count.id,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// List all users (paginated)
adminRouter.get("/users", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const users = await prisma.user.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { volunteerHours: true },
    });
    const total = await prisma.user.count();
    res.json({ success: true, data: { users, total, page, limit } });
  } catch (err) {
    next(err);
  }
});

// Flag a suspicious hour log
adminRouter.post("/flag-session/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!session) throw new AppError(404, "Session not found");
    // Mark as unconfirmed so hours aren't credited
    const updated = await prisma.session.update({
      where: { id: req.params.id },
      data: { tutorConfirmed: false, tuteeConfirmed: false },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Promote user to admin
adminRouter.post("/users/:id/promote", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: "ADMIN" },
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});
