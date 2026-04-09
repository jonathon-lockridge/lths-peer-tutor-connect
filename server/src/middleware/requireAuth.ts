import { Request, Response, NextFunction } from "express";
import { getAuth, createClerkClient } from "@clerk/express";
import { prisma } from "../utils/prisma";
import { AppError } from "./errorHandler";
import { isAdminEmail } from "../routes/auth";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

export interface AuthRequest extends Request {
  userId?: string;
  clerkUserId?: string;
}

export async function requireAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      throw new AppError(401, "Unauthorized");
    }

    let user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });

    // Auto-create user on first login (no webhook needed for local dev)
    if (!user) {
      const clerkUser = await clerk.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
      user = await prisma.user.create({
        data: {
          clerkId: clerkUserId,
          email,
          firstName: clerkUser.firstName ?? "",
          lastName: clerkUser.lastName ?? "",
          grade: 10,
          role: isAdminEmail(email) ? "ADMIN" : "STUDENT",
          avatarUrl: clerkUser.imageUrl ?? null,
        },
      });
    }

    req.userId = user.id;
    req.clerkUserId = clerkUserId;
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAdmin(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId) throw new AppError(401, "Unauthorized");
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.role !== "ADMIN") {
      throw new AppError(403, "Forbidden: Admin access required");
    }
    next();
  } catch (err) {
    next(err);
  }
}
