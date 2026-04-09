import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { stringify } from "csv-stringify/sync";

export const hoursRouter = Router();

hoursRouter.use(requireAuth);

// Get hour summary for current user
hoursRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.volunteerHourLog.findMany({
      where: { userId: req.userId },
      orderBy: { period: "desc" },
    });
    const totalMinutes = logs.reduce((sum, l) => sum + l.totalMinutes, 0);
    const now = new Date();
    const currentPeriod =
      now.getMonth() < 6
        ? `${now.getFullYear() - 1}-${now.getFullYear()} Spring`
        : `${now.getFullYear()}-${now.getFullYear() + 1} Fall`;

    res.json({
      success: true,
      data: {
        totalMinutes,
        totalHours: Math.round(totalMinutes / 60),
        currentPeriod,
        logs,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Leaderboard (opt-in tutors, top 20)
hoursRouter.get("/leaderboard", async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const currentPeriod =
      now.getMonth() < 6
        ? `${now.getFullYear() - 1}-${now.getFullYear()} Spring`
        : `${now.getFullYear()}-${now.getFullYear() + 1} Fall`;

    const logs = await prisma.volunteerHourLog.findMany({
      where: { period: currentPeriod },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, grade: true, avatarUrl: true } },
      },
      orderBy: { totalMinutes: "desc" },
      take: 20,
    });

    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

// Export CSV — admin only, professional multi-section format
hoursRouter.get("/export", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.role !== "ADMIN") throw new AppError(403, "Admin only");

    const { period } = req.query;
    const periodFilter = period ? { period: period as string } : {};
    const exportedAt = new Date();

    // ── Pull all confirmed sessions for the period ───────────────────────────
    const sessions = await prisma.session.findMany({
      where: {
        tutorConfirmed: true,
        tuteeConfirmed: true,
        match: {
          ...(period
            ? {
                scheduledAt: {
                  gte: new Date(`${(period as string).split("-")[0]}-01-01`),
                  lte: new Date(`${(period as string).split("-")[1]?.split(" ")[0] ?? new Date().getFullYear()}-12-31`),
                },
              }
            : {}),
        },
      },
      include: {
        match: {
          include: {
            tutor: { select: { id: true, firstName: true, lastName: true, email: true, grade: true } },
            request: {
              include: {
                requester: { select: { id: true, firstName: true, lastName: true, email: true, grade: true } },
                subject: true,
              },
            },
          },
        },
      },
      orderBy: [{ date: "asc" }],
    });

    // ── Summary rows (one row per tutor) ────────────────────────────────────
    const logs = await prisma.volunteerHourLog.findMany({
      where: periodFilter,
      include: { user: true },
      orderBy: [{ totalMinutes: "desc" }],
    });

    const generatedStr = exportedAt.toLocaleString("en-US", {
      month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
    const periodLabel = (period as string) ?? "All Time";

    // ── Build CSV sections ───────────────────────────────────────────────────
    const lines: string[] = [];

    // Header block
    lines.push(`"LAKE TRAVIS HIGH SCHOOL — PEER TUTOR CONNECT"`);
    lines.push(`"Volunteer Hours Report"`);
    lines.push(`"Period:","${periodLabel}"`);
    lines.push(`"Generated:","${generatedStr}"`);
    lines.push(`"Exported by:","${user.firstName} ${user.lastName} (${user.email})"`);
    lines.push("");

    // ── Section 1: Summary ──────────────────────────────────────────────────
    lines.push(`"=== TUTOR SUMMARY ==="`);
    lines.push(stringify([], { header: true, columns: [
      "Rank", "First Name", "Last Name", "Email", "Grade",
      "Total Sessions", "Total Hours", "Total Minutes", "Previously Exported",
    ]}));

    const summaryRows = logs.map((l, i) => {
      const tutorSessions = sessions.filter((s) => s.match.tutorId === l.userId);
      return {
        "Rank": i + 1,
        "First Name": l.user.firstName,
        "Last Name": l.user.lastName,
        "Email": l.user.email,
        "Grade": `${l.user.grade}th`,
        "Total Sessions": tutorSessions.length,
        "Total Hours": (l.totalMinutes / 60).toFixed(2),
        "Total Minutes": l.totalMinutes,
        "Previously Exported": l.exportedAt ? "Yes" : "No",
      };
    });
    lines.push(stringify(summaryRows, { header: false, columns: [
      "Rank", "First Name", "Last Name", "Email", "Grade",
      "Total Sessions", "Total Hours", "Total Minutes", "Previously Exported",
    ]}));
    lines.push("");

    // ── Section 2: Session detail ───────────────────────────────────────────
    lines.push(`"=== SESSION DETAIL ==="`);
    const detailRows = sessions.map((s) => ({
      "Date": new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      "Tutor First": s.match.tutor.firstName,
      "Tutor Last": s.match.tutor.lastName,
      "Tutor Email": s.match.tutor.email,
      "Tutor Grade": `${s.match.tutor.grade}th`,
      "Student First": s.match.request.requester.firstName,
      "Student Last": s.match.request.requester.lastName,
      "Student Email": s.match.request.requester.email,
      "Student Grade": `${s.match.request.requester.grade}th`,
      "Subject": s.match.request.subject.name,
      "Duration (min)": s.actualDurationMinutes ?? s.durationMinutes,
      "Duration (hrs)": ((s.actualDurationMinutes ?? s.durationMinutes) / 60).toFixed(2),
      "Notes": s.notes ?? "",
    }));
    lines.push(stringify(detailRows, { header: true, columns: [
      "Date", "Tutor First", "Tutor Last", "Tutor Email", "Tutor Grade",
      "Student First", "Student Last", "Student Email", "Student Grade",
      "Subject", "Duration (min)", "Duration (hrs)", "Notes",
    ]}));
    lines.push("");

    // ── Section 3: Totals ───────────────────────────────────────────────────
    const totalMinutesAll = logs.reduce((s, l) => s + l.totalMinutes, 0);
    lines.push(`"=== TOTALS ==="`);
    lines.push(`"Active Tutors:","${logs.length}"`);
    lines.push(`"Total Confirmed Sessions:","${sessions.length}"`);
    lines.push(`"Total Hours Logged:","${(totalMinutesAll / 60).toFixed(2)}"`);
    lines.push(`"Total Minutes Logged:","${totalMinutesAll}"`);

    const csv = lines.join("\n");

    // Mark as exported
    await prisma.volunteerHourLog.updateMany({
      where: { ...periodFilter, exportedAt: null },
      data: { exportedAt: exportedAt },
    });

    const filename = `LTHS-PeerTutorConnect-VolunteerHours-${(periodLabel).replace(/\s+/g, "-")}-${exportedAt.toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});
