import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { rateLimit } from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { errorHandler } from "./middleware/errorHandler";
import { requireAuth, AuthRequest } from "./middleware/requireAuth";
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
import { availabilityRouter } from "./routes/availability";
import { badgesRouter } from "./routes/badges";
import { prisma } from "./utils/prisma";
import { createNotification } from "./utils/notify";
import { sendEmail, sessionReminderEmail } from "./utils/email";

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Railway/Vercel/Heroku reverse proxy so express-rate-limit
// and req.ip work correctly behind load balancers
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-origin" },
  })
);

const allowedOrigins = [
  "http://localhost:5173",
  "https://student-tutors.com",
  "https://www.student-tutors.com",
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Global rate limit — 100 req / 15 min per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many requests, please try again later." },
  })
);

// Tighter limit for state-changing endpoints — 30 mutations / 15 min per IP
const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later." },
});
app.use("/api/auth/onboard", mutationLimiter);
app.use("/api/auth/accept-terms", mutationLimiter);
app.use("/api/requests", mutationLimiter);
app.use("/api/verification", mutationLimiter);
app.use("/api/reviews", mutationLimiter);

// Clerk middleware (must come before routes)
app.use(clerkMiddleware());

// Body parsing — /api/auth/webhook needs raw body for Svix signature verification
app.use("/api/auth/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" })); // 10mb was too permissive for an API server

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
app.use("/api/availability", availabilityRouter);
app.use("/api/badges", badgesRouter);
// Serve uploaded files — requires authentication so files aren't world-accessible.
// In production with S3 configured, files are served directly from R2/S3 and this
// route only handles any files that exist locally (e.g. dev uploads).
app.use("/api/uploads", requireAuth, (req: AuthRequest, res: express.Response) => {
  // path.basename strips any directory components, preventing path traversal attacks
  const filename = path.basename(req.path);
  if (!filename || filename === ".") {
    res.status(400).json({ success: false, error: "Invalid filename" });
    return;
  }
  const filepath = path.resolve(path.join(__dirname, "../uploads", filename));
  // Double-check the resolved path is still inside the uploads directory
  const uploadDir = path.resolve(path.join(__dirname, "../uploads"));
  if (!filepath.startsWith(uploadDir + path.sep)) {
    res.status(400).json({ success: false, error: "Invalid filename" });
    return;
  }
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ success: false, error: "File not found" });
    return;
  }
  res.sendFile(filepath);
});

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
            tutor: true,
            student: true,
            subject: true,
            request: { include: { requester: true, subject: true } },
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

      // Handle both request-based and direct bookings
      const subjectName =
        session.match.request?.subject?.name ??
        (session.match as any).subject?.name ??
        "tutoring session";
      const studentId =
        (session.match as any).studentId ??
        session.match.request?.requesterId ??
        null;
      const studentUser =
        (session.match as any).student ??
        session.match.request?.requester ??
        null;

      const msg = `Your ${subjectName} session starts in about 1 hour.`;
      const scheduledStr = session.startTime
        ? new Date(session.startTime).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : "soon";
      const location = (session.match as any).location ?? "TBD";
      const appUrl = process.env.CLIENT_URL ?? "http://localhost:5173";

      await createNotification(session.match.tutorId, "SESSION_REMINDER", "Session reminder", msg, "/sessions");
      if (studentId) {
        await createNotification(studentId, "SESSION_REMINDER", "Session reminder", msg, "/sessions");
      }

      // Email + SMS reminders for both parties
      const tutor = session.match.tutor as any;

      if (tutor?.email) {
        await sendEmail(tutor.email, "Session reminder — 1 hour away",
          sessionReminderEmail(tutor.firstName, subjectName, scheduledStr, location, `${appUrl}/sessions`));
      }

      if (studentUser?.email) {
        await sendEmail(studentUser.email, "Session reminder — 1 hour away",
          sessionReminderEmail(studentUser.firstName, subjectName, scheduledStr, location, `${appUrl}/sessions`));
      }
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
            tutor: true,
            student: true,
            subject: true,
            request: { include: { requester: true, subject: true } },
          },
        },
      },
    });

    for (const session of expired) {
      // Handle both request-based and direct bookings
      const subjectName =
        session.match.request?.subject?.name ??
        (session.match as any).subject?.name ??
        "session";
      const studentId =
        (session.match as any).studentId ??
        session.match.request?.requesterId ??
        null;

      if (!session.tutorConfirmed) {
        await createNotification(
          session.match.tutorId,
          "SESSION_CONFIRMED",
          "Session expired without confirmation",
          `A ${subjectName} session was not confirmed in time and has expired. No hours were credited.`,
          "/sessions"
        );
      }
      if (!session.tuteeConfirmed && studentId) {
        await createNotification(
          studentId,
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
