import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { createNotification } from "../utils/notify";
import { z } from "zod";

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

const sendSchema = z.object({ body: z.string().min(1).max(2000) });

/** Resolve the student side of a match regardless of how it was created */
function getMatchStudentId(match: { studentId?: string | null; request?: { requesterId: string } | null }): string | null {
  return match.studentId ?? match.request?.requesterId ?? null;
}

// Get all conversations (matches the user is part of, with latest message)
messagesRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { tutorId: req.userId },
          { studentId: req.userId },
          { request: { requesterId: req.userId } },
        ],
        status: { notIn: ["DECLINED"] },
      },
      include: {
        tutor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        student: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        subject: true,
        request: {
          include: {
            requester: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            subject: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: { select: { firstName: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Add unread count per match
    const withUnread = await Promise.all(
      matches.map(async (m) => {
        const unread = await prisma.message.count({
          where: { matchId: m.id, read: false, senderId: { not: req.userId } },
        });
        return { ...m, unreadCount: unread };
      })
    );

    res.json({ success: true, data: { conversations: withUnread, currentUserId: req.userId } });
  } catch (err) {
    next(err);
  }
});

// Get messages for a specific match
messagesRouter.get("/:matchId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.matchId },
      include: {
        tutor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true } },
        student: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true } },
        subject: true,
        request: {
          include: {
            requester: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true } },
            subject: true,
          },
        },
      },
    });
    if (!match) throw new AppError(404, "Conversation not found");

    const studentId = getMatchStudentId(match);
    const isParty = match.tutorId === req.userId || studentId === req.userId;
    if (!isParty) throw new AppError(403, "Not part of this conversation");

    // Mark all incoming messages as read
    await prisma.message.updateMany({
      where: { matchId: req.params.matchId, senderId: { not: req.userId }, read: false },
      data: { read: true },
    });

    const messages = await prisma.message.findMany({
      where: { matchId: req.params.matchId },
      include: { sender: { select: { id: true, firstName: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, data: { match, messages, currentUserId: req.userId } });
  } catch (err) {
    next(err);
  }
});

// Send a message
messagesRouter.post("/:matchId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    const match = await prisma.match.findUnique({
      where: { id: req.params.matchId },
      include: {
        student: { select: { id: true } },
        request: { select: { requesterId: true } },
      },
    });
    if (!match) throw new AppError(404, "Conversation not found");

    const studentId = getMatchStudentId(match);
    const isParty = match.tutorId === req.userId || studentId === req.userId;
    if (!isParty) throw new AppError(403, "Not part of this conversation");

    const message = await prisma.message.create({
      data: {
        matchId: req.params.matchId,
        senderId: req.userId!,
        body: parsed.data.body,
      },
      include: { sender: { select: { id: true, firstName: true, avatarUrl: true } } },
    });

    // Notify the other party
    const recipientId = req.userId === match.tutorId ? studentId : match.tutorId;

    if (recipientId) {
      const sender = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { firstName: true },
      });
      await createNotification(
        recipientId,
        "NEW_MESSAGE",
        `New message from ${sender?.firstName ?? "Someone"}`,
        parsed.data.body.slice(0, 80),
        `/messages/${req.params.matchId}`
      );
    }

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
});
