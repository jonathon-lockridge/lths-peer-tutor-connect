import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { createNotification } from "../utils/notify";
import { sendEmail, newRequestEmail } from "../utils/email";
import { sendSms } from "../utils/sms";
import { z } from "zod";
import { Urgency, RequestStatus } from "@prisma/client";
const MAX_OPEN_REQUESTS = 5;

export const requestsRouter = Router();

requestsRouter.use(requireAuth);

const createSchema = z.object({
  subjectId: z.string().min(1),
  description: z.string().min(10).max(1000),
  urgency: z.nativeEnum(Urgency).default("MEDIUM"),
  targetTutorId: z.string().optional(),
});

const statusSchema = z.object({
  status: z.nativeEnum(RequestStatus),
});

// List requests (own or all open)
requestsRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mine, status, subjectId } = req.query;
    const requests = await prisma.tutoringRequest.findMany({
      where: {
        ...(mine === "true" ? { requesterId: req.userId } : {}),
        ...(status ? { status: status as RequestStatus } : {}),
        ...(subjectId ? { subjectId: subjectId as string } : {}),
        ...(!mine && !status ? { status: "OPEN" } : {}),
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, grade: true, avatarUrl: true } },
        subject: true,
        matches: { where: { status: { not: "DECLINED" } }, take: 1 },
      },
      orderBy: [{ urgency: "asc" }, { createdAt: "desc" }],
    });
    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
});

// Get single request
requestsRouter.get("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const request = await prisma.tutoringRequest.findUnique({
      where: { id: req.params.id },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, grade: true, avatarUrl: true } },
        subject: true,
        matches: {
          include: {
            tutor: { select: { id: true, firstName: true, lastName: true, grade: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!request) throw new AppError(404, "Request not found");
    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
});

// Create request
requestsRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    // Max 5 open requests
    const openCount = await prisma.tutoringRequest.count({
      where: { requesterId: req.userId, status: "OPEN" },
    });
    if (openCount >= MAX_OPEN_REQUESTS) {
      throw new AppError(400, `You can have at most ${MAX_OPEN_REQUESTS} open requests at a time.`);
    }

    const { subjectId, description, urgency, targetTutorId } = parsed.data;

    // If targetTutorId, validate they tutor that subject and aren't the requester
    if (targetTutorId) {
      if (targetTutorId === req.userId) throw new AppError(400, "You cannot request yourself.");
      const tutorSubject = await prisma.tutorSubject.findFirst({
        where: { userId: targetTutorId, subjectId },
      });
      if (!tutorSubject) throw new AppError(400, "That tutor does not offer this subject.");
    }

    const request = await prisma.tutoringRequest.create({
      data: { requesterId: req.userId!, subjectId, description, urgency },
      include: { requester: true, subject: true },
    });

    // If a specific tutor was targeted, auto-create a pending match
    if (targetTutorId) {
      await prisma.match.create({
        data: { requestId: request.id, tutorId: targetTutorId, status: "PENDING" },
      });
      await prisma.tutoringRequest.update({ where: { id: request.id }, data: { status: "MATCHED" } });

      const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
      const subjectName = subject?.name ?? "a subject";
      const tutor = await prisma.user.findUnique({
        where: { id: targetTutorId },
        select: { email: true, phone: true, firstName: true },
      });
      const studentName = `${request.requester.firstName} ${request.requester.lastName}`;
      const appUrl = process.env.CLIENT_URL ?? "http://localhost:5173";

      await createNotification(
        targetTutorId,
        "NEW_REQUEST",
        "A student requested your help!",
        `${studentName} needs help with ${subjectName}. Accept or decline in your inbox.`,
        "/",
        { skipEmail: true }
      );

      // Rich email with tutor-specific template
      if (tutor?.email) {
        await sendEmail(
          tutor.email,
          `New tutoring request: ${subjectName}`,
          newRequestEmail(tutor.firstName ?? "there", studentName, subjectName, appUrl)
        );
      }
      if (tutor?.phone) {
        await sendSms(tutor.phone, `Hi ${tutor.firstName}, ${studentName} requested your help with ${subjectName}! Log in to accept: ${appUrl}`);
      }
    }

    res.status(201).json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
});

// Cancel own request
requestsRouter.patch("/:id/status", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const request = await prisma.tutoringRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.requesterId !== req.userId) throw new AppError(404, "Not found");

    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);

    const allowed: RequestStatus[] = ["CANCELLED"];
    if (!allowed.includes(parsed.data.status)) {
      throw new AppError(400, "You can only cancel your own requests.");
    }

    const updated = await prisma.tutoringRequest.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
      include: {
        subject: true,
        matches: { where: { status: { in: ["PENDING", "ACCEPTED"] } }, include: { tutor: true } },
      },
    });

    // Notify any matched tutor that the request was cancelled
    if (parsed.data.status === "CANCELLED") {
      for (const match of (updated as any).matches) {
        await createNotification(
          match.tutorId,
          "REQUEST_CANCELLED",
          "Request cancelled",
          `A student cancelled their ${(updated as any).subject.name} tutoring request.`,
          "/my-requests"
        );
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
