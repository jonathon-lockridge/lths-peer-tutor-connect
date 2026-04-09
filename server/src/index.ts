import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { rateLimit } from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { subjectsRouter } from "./routes/subjects";
import { tutorSubjectsRouter } from "./routes/tutorSubjects";
import { requestsRouter } from "./routes/requests";
import { matchesRouter } from "./routes/matches";
import { sessionsRouter } from "./routes/sessions";
import { hoursRouter } from "./routes/hours";
import { reviewsRouter } from "./routes/reviews";
import { adminRouter } from "./routes/admin";
import { notificationsRouter } from "./routes/notifications";
import { messagesRouter } from "./routes/messages";
import { verificationRouter } from "./routes/verification";
import { feedbackRouter } from "./routes/feedback";
import { uploadRouter } from "./routes/upload";
import { prisma } from "./utils/prisma";
import { createNotification } from "./utils/notify";
import { sendEmail, sessionReminderEmail } from "./utils/email";
import { sendSms } from "./utils/sms";

const app = express();
const PORT = process.env.PORT || 3001;

// Security
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Clerk middleware (must come before routes)
app.use(clerkMiddleware());

// Body parsing — /api/auth/webhook needs raw body for Svix signature verification
app.use("/api/auth/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/subjects", subjectsRouter);
app.use("/api/tutor-subjects", tutorSubjectsRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/hours", hoursRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/verification", verificationRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check
app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Session reminder job — runs every 30 minutes
async function sendSessionReminders() {
  try {
    const now = new Date();
    const in45 = new Date(now.getTime() + 45 * 60 * 1000);
    const in75 = new Date(now.getTime() + 75 * 60 * 1000);

    const sessions = await prisma.session.findMany({
      where: { startTime: { gte: in45, lte: in75 } },
      include: {
        match: {
          include: {
            request: { include: { requester: true, subject: true } },
            tutor: true,
          },
        },
      },
    });

    for (const session of sessions) {
      // Avoid duplicate reminders — check if one was sent in last 2 hours
      const alreadySent = await prisma.notification.findFirst({
        where: {
          type: "SESSION_REMINDER",
          linkTo: "/sessions",
          userId: session.match.tutorId,
          createdAt: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
        },
      });
      if (alreadySent) continue;

      const subject = session.match.request.subject as any;
      const subjectName = subject?.name ?? "tutoring session";
      const msg = `Your ${subjectName} session starts in about 1 hour.`;
      const scheduledStr = session.startTime
        ? new Date(session.startTime).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : "soon";
      const location = (session as any).match?.location ?? "TBD";
      const appUrl = process.env.CLIENT_URL ?? "http://localhost:5173";

      await createNotification(session.match.tutorId, "SESSION_REMINDER", "Session reminder", msg, "/sessions");
      await createNotification(session.match.request.requesterId, "SESSION_REMINDER", "Session reminder", msg, "/sessions");

      // Email + SMS reminders for both parties
      const tutor = session.match.tutor as any;
      const student = session.match.request.requester as any;

      if (tutor?.email) {
        await sendEmail(tutor.email, "Session reminder — 1 hour away",
          sessionReminderEmail(tutor.firstName, subjectName, scheduledStr, location, `${appUrl}/sessions`));
      }
      if (tutor?.phone) await sendSms(tutor.phone, `Reminder: Your ${subjectName} session is in ~1 hour at ${location}.`);

      if (student?.email) {
        await sendEmail(student.email, "Session reminder — 1 hour away",
          sessionReminderEmail(student.firstName, subjectName, scheduledStr, location, `${appUrl}/sessions`));
      }
      if (student?.phone) await sendSms(student.phone, `Reminder: Your ${subjectName} session is in ~1 hour at ${location}.`);
    }
  } catch (e) {
    console.error("Reminder job error:", e);
  }
}

setInterval(sendSessionReminders, 30 * 60 * 1000);

// Auto-expire unconfirmed sessions — runs once per hour
async function expireUnconfirmedSessions() {
  try {
    const expired = await prisma.session.findMany({
      where: {
        expiresAt: { lte: new Date() },
        OR: [{ tutorConfirmed: false }, { tuteeConfirmed: false }],
      },
      include: {
        match: {
          include: {
            request: { include: { requester: true, subject: true } },
            tutor: true,
          },
        },
      },
    });

    for (const session of expired) {
      const subjectName = (session.match.request.subject as any)?.name ?? "session";
      if (!session.tutorConfirmed) {
        await createNotification(
          session.match.tutorId,
          "SESSION_CONFIRMED",
          "Session expired without confirmation",
          `A ${subjectName} session was not confirmed in time and has expired. No hours were credited.`,
          "/sessions"
        );
      }
      if (!session.tuteeConfirmed) {
        await createNotification(
          session.match.request.requesterId,
          "SESSION_CONFIRMED",
          "Session expired without confirmation",
          `A ${subjectName} session was not confirmed in time and has expired.`,
          "/sessions"
        );
      }
      // Delete so it no longer appears
      await prisma.session.delete({ where: { id: session.id } });
    }
  } catch (e) {
    console.error("Expire job error:", e);
  }
}

setInterval(expireUnconfirmedSessions, 60 * 60 * 1000);

export default app;
