import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRe, "startTime must be HH:MM (24h)"),
  endTime: z.string().regex(timeRe, "endTime must be HH:MM (24h)"),
  mode: z.enum(["PHYSICAL", "ONLINE", "EITHER"]).default("EITHER"),
}).refine((d) => d.startTime < d.endTime, { message: "startTime must be before endTime" });

export const availabilityRouter = Router();

availabilityRouter.use(requireAuth);

// Get availability for any tutor (public within auth)
availabilityRouter.get("/:userId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const slots = await prisma.tutorAvailability.findMany({
      where: { userId: req.params.userId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    res.json({ success: true, data: slots });
  } catch (err) {
    next(err);
  }
});

// Add an availability slot (tutor only)
availabilityRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = slotSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message);
    const { dayOfWeek, startTime, endTime, mode } = parsed.data;
    const slot = await prisma.tutorAvailability.create({
      data: { userId: req.userId!, dayOfWeek, startTime, endTime, mode },
    });
    res.status(201).json({ success: true, data: slot });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ success: false, error: "This slot already exists" });
    }
    next(err);
  }
});

// Delete an availability slot (own only)
availabilityRouter.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const slot = await prisma.tutorAvailability.findUnique({ where: { id: req.params.id } });
    if (!slot || slot.userId !== req.userId) {
      return res.status(404).json({ success: false, error: "Slot not found" });
    }
    await prisma.tutorAvailability.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
