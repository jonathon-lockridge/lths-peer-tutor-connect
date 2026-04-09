import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { createNotification } from "../utils/notify";
import { z } from "zod";
const MIN_SESSION_MINUTES = 15;
const MAX_SESSION_MINUTES = 180;

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

const createSessionSchema = z.object({
  matchId: z.string().min(1),
  date: z.string().date(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  actualDurationMinutes: z.number().int().min(MIN_SESSION_MINUTES).max(MAX_SESSION_MINUTES).optional(),
  notes: z.string().max(1000).optional(),
});

const confirmSchema = z.object({
  code: z.string().length(4).optional(),
});

function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// List own sessions
sessionsRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        match: {
          OR: [
            { tutorId: req.userId },
            { request: { requesterId: req.userId } },
          ],
        },
      },
      include: {
        match: {
          include: {
            tutor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            request: {
              include: {
                requester: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
                subject: true,
              },
            },
            // include meetingUrl so client can show Join button
          },
        },
        reviews: true,
      },
      orderBy: { date: "desc" },
    });
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
});

// Log a session (tutor or student initiates)
sessionsRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    const match = await prisma.match.findUnique({
      where: { id: parsed.data.matchId },
      include: { request: { include: { subject: true } } },
    });
    if (!match) throw new AppError(404, "Match not found");

    const isParty = match.tutorId === req.userId || match.request.requesterId === req.userId;
    if (!isParty) throw new AppError(403, "Forbidden");
    if (match.status !== "ACCEPTED") throw new AppError(400, "Match must be ACCEPTED to log a session");

    const todayStr = new Date().toLocaleDateString("en-CA");
    if (parsed.data.date > todayStr) {
      throw new AppError(400, "Session date must be today or in the past.");
    }

    const start = new Date(parsed.data.startTime);
    const end = new Date(parsed.data.endTime);
    const scheduledDuration = Math.round((end.getTime() - start.getTime()) / 60000);

    if (scheduledDuration < MIN_SESSION_MINUTES || scheduledDuration > MAX_SESSION_MINUTES) {
      throw new AppError(400, `Session duration must be between ${MIN_SESSION_MINUTES} and ${MAX_SESSION_MINUTES} minutes.`);
    }

    const isTutor = match.tutorId === req.userId;
    const durationMinutes = parsed.data.actualDurationMinutes ?? scheduledDuration;
    const confirmCode = generateCode();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await prisma.session.create({
      data: {
        matchId: parsed.data.matchId,
        date: new Date(parsed.data.date),
        startTime: start,
        endTime: end,
        durationMinutes,
        actualDurationMinutes: parsed.data.actualDurationMinutes ?? null,
        notes: parsed.data.notes,
        tutorConfirmed: isTutor,
        tuteeConfirmed: !isTutor,
        confirmCode,
        expiresAt,
      },
    });

    // Notify the other party — include the confirm code in the message
    const subjectName = (match.request as any).subject?.name ?? "your session";
    const notifyId = isTutor ? match.request.requesterId : match.tutorId;
    await createNotification(
      notifyId,
      "SESSION_CONFIRMED",
      "Confirm your session",
      `A ${subjectName} session has been logged. Enter code ${confirmCode} in the app to confirm and credit hours.`,
      "/sessions"
    );

    res.status(201).json({ success: true, data: { ...session, confirmCode } });
  } catch (err) {
    next(err);
  }
});

// Confirm a session — requires the 4-digit code the other party has
sessionsRouter.post("/:id/confirm", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { match: { include: { request: { include: { subject: true } } } } },
    });
    if (!session) throw new AppError(404, "Session not found");

    // Check not expired
    if (session.expiresAt && new Date() > session.expiresAt) {
      throw new AppError(410, "This session has expired and can no longer be confirmed.");
    }

    const { match } = session;
    const isTutor = match.tutorId === req.userId;
    const isTutee = match.request.requesterId === req.userId;
    if (!isTutor && !isTutee) throw new AppError(403, "Forbidden");

    // Idempotency
    if ((isTutor && session.tutorConfirmed) || (isTutee && session.tuteeConfirmed)) {
      return res.json({ success: true, data: session });
    }

    // Validate confirm code — the person who DIDN'T log must enter the code
    const alreadyConfirmedSide = isTutor ? session.tutorConfirmed : session.tuteeConfirmed;
    if (!alreadyConfirmedSide && session.confirmCode) {
      if (!parsed.data.code) throw new AppError(400, "Please enter the 4-digit confirmation code.");
      if (parsed.data.code !== session.confirmCode) throw new AppError(400, "Incorrect confirmation code.");
    }

    const updated = await prisma.session.update({
      where: { id: req.params.id },
      data: {
        tutorConfirmed: isTutor ? true : session.tutorConfirmed,
        tuteeConfirmed: isTutee ? true : session.tuteeConfirmed,
      },
    });

    // Both confirmed — credit volunteer hours and notify both parties
    if (updated.tutorConfirmed && updated.tuteeConfirmed) {
      const now = new Date();
      const period = now.getMonth() < 6
        ? `${now.getFullYear() - 1}-${now.getFullYear()} Spring`
        : `${now.getFullYear()}-${now.getFullYear() + 1} Fall`;

      const creditMinutes = updated.actualDurationMinutes ?? updated.durationMinutes;

      await prisma.volunteerHourLog.upsert({
        where: { userId_period: { userId: match.tutorId, period } },
        update: { totalMinutes: { increment: creditMinutes } },
        create: { userId: match.tutorId, totalMinutes: creditMinutes, period },
      });

      const hrs = Math.floor(creditMinutes / 60);
      const mins = creditMinutes % 60;
      const timeStr = hrs > 0 ? `${hrs}h${mins > 0 ? ` ${mins}m` : ""}` : `${mins}m`;

      // Notify tutor — hours credited
      await createNotification(
        match.tutorId,
        "HOUR_MILESTONE",
        "Session confirmed — hours credited!",
        `${timeStr} of volunteer credit added to your record for this semester.`,
        "/hours"
      );

      // Notify tutee — session confirmed, invite them to leave a review
      await createNotification(
        match.request.requesterId,
        "SESSION_CONFIRMED",
        "Session confirmed!",
        `Your session has been confirmed by both parties. Head to Sessions to leave a review.`,
        "/sessions"
      );
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
