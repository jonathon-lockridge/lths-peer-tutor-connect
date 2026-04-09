import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { createNotification } from "../utils/notify";
import { sendEmail, matchAcceptedEmail, generateICS } from "../utils/email";
import { sendSms } from "../utils/sms";
import { z } from "zod";
import { MatchStatus } from "@prisma/client";

export const matchesRouter = Router();

matchesRouter.use(requireAuth);

const acceptSchema = z.object({
  scheduledAt: z.string().datetime(),
  location: z.string().min(1).max(200),
});

// List matches for current user (as tutor or tutee)
matchesRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role } = req.query;
    const matches = await prisma.match.findMany({
      where: {
        ...(role === "tutor"
          ? { tutorId: req.userId }
          : role === "tutee"
          ? { request: { requesterId: req.userId } }
          : { OR: [{ tutorId: req.userId }, { request: { requesterId: req.userId } }] }),
      },
      include: {
        request: {
          include: {
            requester: { select: { id: true, firstName: true, lastName: true, grade: true, avatarUrl: true } },
            subject: true,
          },
        },
        tutor: { select: { id: true, firstName: true, lastName: true, grade: true, avatarUrl: true } },
        sessions: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: matches });
  } catch (err) {
    next(err);
  }
});

// Accept a match (tutor sets time and location)
matchesRouter.post("/:id/accept", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { request: { include: { subject: true, requester: true } } },
    });
    if (!match) throw new AppError(404, "Match not found");
    if (match.tutorId !== req.userId) throw new AppError(403, "Only the tutor can accept this match");
    if (match.status !== "PENDING") throw new AppError(400, "Match is not in PENDING state");

    // Cannot tutor own request
    if (match.request.requesterId === req.userId) {
      throw new AppError(400, "You cannot tutor your own request.");
    }

    const parsed = acceptSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    // Generate a unique Jitsi Meet room for this session
    const roomId = `lths-${req.params.id.slice(-8)}`;
    const meetingUrl = `https://meet.jit.si/${roomId}`;

    const [updated] = await prisma.$transaction([
      prisma.match.update({
        where: { id: req.params.id },
        data: {
          status: "ACCEPTED",
          scheduledAt: new Date(parsed.data.scheduledAt),
          location: parsed.data.location,
          meetingUrl,
        },
      }),
      prisma.tutoringRequest.update({
        where: { id: match.requestId },
        data: { status: "IN_PROGRESS" },
      }),
    ]);

    const appUrl = process.env.CLIENT_URL ?? "http://localhost:5173";
    const subjectName = match.request.subject.name;
    const scheduledStr = new Date(parsed.data.scheduledAt).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });

    // Notify the student their request was accepted
    await createNotification(
      match.request.requesterId,
      "MATCH_ACCEPTED",
      "Tutor accepted your request!",
      `Your ${subjectName} session is scheduled for ${scheduledStr} at ${parsed.data.location}.`,
      "/sessions"
    );

    // Rich email + SMS — student info already included via requester
    const student = await prisma.user.findUnique({
      where: { id: match.request.requesterId },
      select: { email: true, phone: true, firstName: true },
    });
    const tutorUser = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { email: true, phone: true, firstName: true, lastName: true },
    });
    const tutorName = tutorUser ? `${tutorUser.firstName} ${tutorUser.lastName}` : "Your tutor";

    // Generate ICS calendar invite
    const sessionStart = new Date(parsed.data.scheduledAt);
    const sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000); // default 1hr
    const icsBuffer = generateICS({
      title: `${subjectName} Tutoring Session`,
      description: `Tutoring session between ${tutorName} and ${student?.firstName ?? "student"} for ${subjectName}.`,
      start: sessionStart,
      end: sessionEnd,
      location: parsed.data.location,
      meetingUrl,
      organizerEmail: `noreply@student-tutors.com`,
    });

    if (student?.email) {
      await sendEmail(
        student.email,
        "Your tutor accepted your request!",
        matchAcceptedEmail(student.firstName ?? "there", tutorName, subjectName, scheduledStr, parsed.data.location, `${appUrl}/sessions`, meetingUrl),
        [{ filename: "tutoring-session.ics", content: icsBuffer }]
      );
    }
    if (student?.phone) {
      await sendSms(student.phone, `${tutorName} accepted your ${subjectName} request! ${scheduledStr} at ${parsed.data.location}. Join meeting: ${meetingUrl}`);
    }

    // Also send ICS to tutor
    if (tutorUser?.email) {
      await sendEmail(
        tutorUser.email,
        `Session confirmed: ${subjectName}`,
        matchAcceptedEmail(tutorUser.firstName ?? "there", tutorName, subjectName, scheduledStr, parsed.data.location, `${appUrl}/sessions`, meetingUrl),
        [{ filename: "tutoring-session.ics", content: icsBuffer }]
      );
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Decline a match
matchesRouter.post("/:id/decline", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { request: true },
    });
    if (!match) throw new AppError(404, "Match not found");
    if (match.tutorId !== req.userId) throw new AppError(403, "Only the tutor can decline");
    if (match.status !== "PENDING") throw new AppError(400, "Match is not PENDING");

    await prisma.match.update({ where: { id: req.params.id }, data: { status: "DECLINED" } });
    await prisma.tutoringRequest.update({ where: { id: match.requestId }, data: { status: "OPEN" } });

    await createNotification(
      match.request.requesterId,
      "MATCH_DECLINED",
      "Tutor unavailable",
      "A tutor was unable to take your request. It's back open — another tutor can still help!",
      "/find-tutor"
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Complete a match
matchesRouter.post("/:id/complete", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { request: true },
    });
    if (!match) throw new AppError(404, "Match not found");

    const isParty =
      match.tutorId === req.userId || match.request.requesterId === req.userId;
    if (!isParty) throw new AppError(403, "Forbidden");
    if (match.status !== "ACCEPTED") throw new AppError(400, "Match must be ACCEPTED first");

    const updated = await prisma.match.update({
      where: { id: req.params.id },
      data: { status: "COMPLETED" },
    });

    await prisma.tutoringRequest.update({
      where: { id: match.requestId },
      data: { status: "COMPLETED" },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
