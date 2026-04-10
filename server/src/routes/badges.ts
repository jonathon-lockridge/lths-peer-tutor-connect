import { Router, Response, NextFunction } from "express";
import { BadgeType, PrismaClient } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/requireAuth";

export const badgesRouter = Router();

badgesRouter.use(requireAuth);

// Get badges for any tutor
badgesRouter.get("/:userId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const badges = await prisma.tutorBadge.findMany({
      where: { userId: req.params.userId },
      orderBy: { awardedAt: "desc" },
    });
    res.json({ success: true, data: badges });
  } catch (err) {
    next(err);
  }
});

// Admin: assign RECOMMENDED or HIGHLY_SKILLED badge
badgesRouter.post("/admin/:userId", requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { badge } = req.body as { badge: BadgeType };
    if (!["RECOMMENDED", "HIGHLY_SKILLED"].includes(badge)) {
      return res.status(400).json({ success: false, error: "Only RECOMMENDED or HIGHLY_SKILLED can be manually assigned" });
    }
    const result = await prisma.tutorBadge.upsert({
      where: { userId_badge: { userId: req.params.userId, badge } },
      update: {},
      create: { userId: req.params.userId, badge },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Admin: revoke a badge
badgesRouter.delete("/admin/:userId/:badge", requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const badge = req.params.badge as BadgeType;
    await prisma.tutorBadge.deleteMany({
      where: { userId: req.params.userId, badge },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Internal helper — call after session confirm or review delete
export async function checkAndAwardTopRated(tutorId: string, db: PrismaClient = prisma) {
  const confirmedSessions = await db.session.count({
    where: {
      match: { tutorId },
      tutorConfirmed: true,
      tuteeConfirmed: true,
    },
  });

  const reviewAgg = await db.review.aggregate({
    _avg: { rating: true },
    _count: { rating: true },
    where: { tutorId },
  });

  const avg = reviewAgg._avg.rating ?? 0;
  const eligible = confirmedSessions >= 2 && avg >= 4.5 && (reviewAgg._count.rating ?? 0) >= 1;

  if (eligible) {
    await db.tutorBadge.upsert({
      where: { userId_badge: { userId: tutorId, badge: "TOP_RATED" } },
      update: {},
      create: { userId: tutorId, badge: "TOP_RATED" },
    });
  } else {
    await db.tutorBadge.deleteMany({
      where: { userId: tutorId, badge: "TOP_RATED" },
    });
  }
}
