import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { createNotification } from "../utils/notify";
import { sendEmail, matchAcceptedEmail, generateICS } from "../utils/email";
import { sendSms } from "../utils/sms";
import { z } from "zod";

export const matchesRouter = Router();

matchesRouter.use(requireAuth);

const acceptSchema = z.object({
  scheduledAt: z.string().datetime(),
  location: z.string().min(1).max(200).optional(),
  sessionMode: z.enum(["PHYSICAL", "ONLINE"]).optional(),
});

const bookingSchema = z.object({
  tutorId: z.string().min(1),
  subjectId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  note: z.string().max(500).optional(),
  sessionMode: z.enum(["PHYSICAL", "ONLINE"]).optional(),
});

/** Helper: resolve the student user ID from a match (works for both direct bookings and request-based) */
function getStudentId(match: { studentId?: string | null; request?: { requesterId: string } | null }): string | null {
  return match.studentId ?? match.request?.requesterId ?? null;
}

// List matches for current user (as tutor or tutee)
matchesRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role } = req.query;
    const matches = await prisma.match.findMany({
      where: {
        ...(role === "tutor"
          ? { tutorId: req.userId }
          : role === "tutee"
          ? { OR: [{ studentId: req.userId }, { request: { requesterId: req.userId } }] }
          : {
              OR: [
                { tutorId: req.userId },
                { studentId: req.userId },
                { request: { requesterId: req.userId } },
              ],
            }),
      },
      include: {
        request: {
          include: {
            requester: { select: { id: true, firstName: true, lastName: true, grade: true, avatarUrl: true } },
            subject: true,
          },
        },
        student: { select: { id: true, firstName: true, lastName: true, grade: true, avatarUrl: true } },
        subject: true,
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

// Get booked (taken) datetimes for a tutor within next 7 days
matchesRouter.get("/booked/:tutorId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const booked = await prisma.match.findMany({
      where: {
        tutorId: req.params.tutorId,
        scheduledAt: { gte: now, lte: sevenDaysOut },
        status: { notIn: ["CANCELLED", "DECLINED"] },
      },
      select: { scheduledAt: true },
    });
    res.json({ success: true, data: booked.map((m) => m.scheduledAt) });
  } catch (err) {
    next(err);
  }
});

// Direct booking from student (no TutoringRequest required)
matchesRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    const { tutorId, subjectId, scheduledAt, note, sessionMode: sessionModeInput } = parsed.data;

    if (tutorId === req.userId) throw new AppError(400, "You cannot book yourself");

    // Tutor must exist and be a tutor
    const tutor = await prisma.user.findUnique({
      where: { id: tutorId },
      select: { id: true, firstName: true, isTutor: true, tutorSubjects: { select: { subjectId: true } } },
    });
    if (!tutor || !tutor.isTutor) throw new AppError(404, "Tutor not found");

    // Tutor must teach this subject
    if (!tutor.tutorSubjects.some((ts) => ts.subjectId === subjectId)) {
      throw new AppError(400, "This tutor does not offer that subject");
    }

    // Scheduled time must be within tutor's availability for that day-of-week
    const scheduledDate = new Date(scheduledAt);
    const dayOfWeek = scheduledDate.getDay();
    const hhmm = scheduledDate.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", timeZone: "America/Chicago" });

    const slots = await prisma.tutorAvailability.findMany({
      where: { userId: tutorId, dayOfWeek },
    });
    const matchingSlot = slots.find((s) => hhmm >= s.startTime && hhmm < s.endTime);
    if (!matchingSlot) {
      throw new AppError(400, "Selected time is outside the tutor's availability");
    }

    // Determine session mode from the slot's tutoring mode
    let sessionMode: string;
    if (matchingSlot.mode === "EITHER") {
      if (!sessionModeInput) {
        throw new AppError(400, "Please select In-Person or Online for this session");
      }
      sessionMode = sessionModeInput;
    } else {
      sessionMode = matchingSlot.mode;
    }

    // Booking must be within 7 days
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (scheduledDate <= now || scheduledDate > sevenDaysOut) {
      throw new AppError(400, "Booking must be within the next 7 days");
    }

    // Slot exclusivity — only one active booking per (tutor, scheduledAt)
    const conflict = await prisma.match.findFirst({
      where: {
        tutorId,
        scheduledAt: scheduledDate,
        status: { notIn: ["CANCELLED", "DECLINED"] },
      },
    });
    if (conflict) {
      throw new AppError(409, "This time slot is already taken. Please choose a different time.");
    }

    const match = await prisma.match.create({
      data: {
        tutorId,
        studentId: req.userId!,
        subjectId,
        note: note ?? null,
        scheduledAt: scheduledDate,
        sessionMode,
        status: "PENDING",
      },
    });

    const student = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { firstName: true, lastName: true },
    });
    const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
    const studentName = student ? `${student.firstName} ${student.lastName}` : "A student";
    const scheduledStr = scheduledDate.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });

    await createNotification(
      tutorId,
      "NEW_BOOKING",
      `New booking request from ${studentName}`,
      `${studentName} wants to book a ${subject?.name ?? "tutoring"} session on ${scheduledStr}.`,
      "/sessions"
    );

    res.status(201).json({ success: true, data: match });
  } catch (err) {
    next(err);
  }
});

// Accept a match (tutor confirms time + location; for direct bookings these may already be set)
matchesRouter.post("/:id/accept", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        request: { include: { subject: true, requester: true } },
        student: true,
        subject: true,
      },
    });
    if (!match) throw new AppError(404, "Match not found");
    if (match.tutorId !== req.userId) throw new AppError(403, "Only the tutor can accept this match");
    if (match.status !== "PENDING") throw new AppError(400, "Match is not in PENDING state");

    const studentId = getStudentId(match);
    if (studentId === req.userId) throw new AppError(400, "You cannot tutor yourself");

    // For direct bookings, scheduledAt is already set; for request-based, tutor provides it
    let scheduledAt: Date;
    let location: string | null;
    let finalSessionMode: string;

    if (match.requestId) {
      // Request-based: tutor provides time, mode, and optionally location
      const parsed = acceptSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);
      scheduledAt = new Date(parsed.data.scheduledAt);
      finalSessionMode = parsed.data.sessionMode ?? "ONLINE";
      location = finalSessionMode === "PHYSICAL"
        ? (parsed.data.location ?? "TBD")
        : null;
    } else {
      // Direct booking: time already set; sessionMode set by student
      if (!match.scheduledAt) throw new AppError(400, "No scheduled time on this booking");
      scheduledAt = match.scheduledAt;
      finalSessionMode = match.sessionMode ?? "ONLINE";
      location = finalSessionMode === "PHYSICAL"
        ? (req.body.location ?? "TBD")
        : null;
    }

    // Only generate a meeting URL for online sessions
    const meetingUrl = finalSessionMode !== "PHYSICAL"
      ? `https://meet.jit.si/lths-${req.params.id.slice(-8)}`
      : null;

    const appUrl = process.env.CLIENT_URL ?? "http://localhost:5173";
    const subjectName = match.request?.subject.name ?? match.subject?.name ?? "tutoring";

    const updateData: Record<string, unknown> = {
      status: "ACCEPTED",
      scheduledAt,
      location,
      meetingUrl,
      ...(match.requestId ? { sessionMode: finalSessionMode } : {}),
    };

    const updated = await prisma.match.update({ where: { id: req.params.id }, data: updateData });
    if (match.requestId) {
      await prisma.tutoringRequest.update({ where: { id: match.requestId }, data: { status: "IN_PROGRESS" } });
    }
    const scheduledStr = scheduledAt.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });

    // Auto-message for in-person sessions so student knows the location
    if (finalSessionMode === "PHYSICAL" && studentId && location) {
      const autoMsg = [
        `Hi! I've confirmed our ${subjectName} session.`,
        `📍 Location: ${location}`,
        `🗓 Time: ${scheduledStr}`,
        `See you there!`,
      ].join("\n");
      await prisma.message.create({
        data: { matchId: req.params.id, senderId: req.userId!, body: autoMsg },
      });
    }

    if (studentId) {
      await createNotification(
        studentId,
        "MATCH_ACCEPTED",
        "Your session is confirmed!",
        location
          ? `Your ${subjectName} session is confirmed for ${scheduledStr} at ${location}.`
          : `Your ${subjectName} session is confirmed for ${scheduledStr}.`,
        "/sessions",
        { skipEmail: true }
      );

      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { email: true, phone: true, firstName: true },
      });
      const tutorUser = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { email: true, phone: true, firstName: true, lastName: true },
      });
      const tutorName = tutorUser ? `${tutorUser.firstName} ${tutorUser.lastName}` : "Your tutor";

      const sessionStart = scheduledAt;
      const sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000);
      const icsBuffer = generateICS({
        title: `${subjectName} Tutoring Session`,
        description: `Tutoring session between ${tutorName} and ${student?.firstName ?? "student"} for ${subjectName}.`,
        start: sessionStart,
        end: sessionEnd,
        location: location ?? "Online",
        meetingUrl: meetingUrl ?? undefined,
        organizerEmail: `noreply@student-tutors.com`,
      });

      if (student?.email) {
        await sendEmail(
          student.email,
          "Your tutoring session is confirmed!",
          matchAcceptedEmail(student.firstName ?? "there", tutorName, subjectName, scheduledStr, location ?? "Online", `${appUrl}/sessions`, meetingUrl ?? undefined),
          [{ filename: "tutoring-session.ics", content: icsBuffer }]
        );
      }
      if (student?.phone) {
        const smsDetails = location ? `${scheduledStr} at ${location}` : scheduledStr;
        const smsJoin = meetingUrl ? ` Join: ${meetingUrl}` : "";
        await sendSms(student.phone, `${tutorName} confirmed your ${subjectName} session! ${smsDetails}.${smsJoin}`);
      }
      if (tutorUser?.email) {
        await sendEmail(
          tutorUser.email,
          `Session confirmed: ${subjectName}`,
          matchAcceptedEmail(tutorUser.firstName ?? "there", tutorName, subjectName, scheduledStr, location ?? "Online", `${appUrl}/sessions`, meetingUrl ?? undefined),
          [{ filename: "tutoring-session.ics", content: icsBuffer }]
        );
      }
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
    if (match.requestId) {
      await prisma.tutoringRequest.update({ where: { id: match.requestId }, data: { status: "OPEN" } });
    }

    const studentId = getStudentId(match);
    if (studentId) {
      await createNotification(
        studentId,
        "MATCH_DECLINED",
        "Booking declined",
        "The tutor was unable to take this session. Try booking another time or a different tutor.",
        "/find-tutor"
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Cancel a match — either the student OR the tutor, > 2 hours before scheduledAt
matchesRouter.post("/:id/cancel", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        request: { include: { subject: true } },
        subject: true,
        tutor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!match) throw new AppError(404, "Match not found");

    const studentId = getStudentId(match);
    const isStudent = studentId === req.userId;
    const isTutor = match.tutorId === req.userId;
    if (!isStudent && !isTutor) throw new AppError(403, "Not part of this session");

    if (!["PENDING", "ACCEPTED"].includes(match.status)) {
      throw new AppError(400, "This session cannot be cancelled");
    }

    if (match.scheduledAt) {
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
      if (match.scheduledAt <= twoHoursFromNow) {
        throw new AppError(400, "Cannot cancel within 2 hours of the scheduled session");
      }
    }

    await prisma.match.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" },
    });

    if (match.requestId) {
      await prisma.tutoringRequest.update({
        where: { id: match.requestId },
        data: { status: "OPEN" },
      });
    }

    const subjectName = match.request?.subject?.name ?? match.subject?.name ?? "tutoring";
    const cancellerLabel = isTutor ? "Tutor" : "Student";

    // Notify the other party
    const notifyId = isTutor ? studentId : match.tutorId;
    if (notifyId) {
      await createNotification(
        notifyId,
        "MATCH_DECLINED",
        "Session cancelled",
        `${cancellerLabel} cancelled the ${subjectName} session.`,
        "/sessions"
      );
    }

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

    const studentId = getStudentId(match);
    const isParty = match.tutorId === req.userId || studentId === req.userId;
    if (!isParty) throw new AppError(403, "Forbidden");
    if (match.status !== "ACCEPTED") throw new AppError(400, "Match must be ACCEPTED first");

    const updated = await prisma.match.update({
      where: { id: req.params.id },
      data: { status: "COMPLETED" },
    });

    if (match.requestId) {
      await prisma.tutoringRequest.update({
        where: { id: match.requestId },
        data: { status: "COMPLETED" },
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
