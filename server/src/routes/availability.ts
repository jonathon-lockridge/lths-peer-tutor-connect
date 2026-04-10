import { Router, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";

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
    const { dayOfWeek, startTime, endTime } = req.body;
    if (dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: "dayOfWeek, startTime, endTime required" });
    }
    if (typeof dayOfWeek !== "number" || dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ success: false, error: "dayOfWeek must be 0–6" });
    }
    // Validate HH:MM format
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRe.test(startTime) || !timeRe.test(endTime)) {
      return res.status(400).json({ success: false, error: "Times must be HH:MM (24h)" });
    }
    if (startTime >= endTime) {
      return res.status(400).json({ success: false, error: "startTime must be before endTime" });
    }
    const slot = await prisma.tutorAvailability.create({
      data: { userId: req.userId!, dayOfWeek, startTime, endTime },
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
