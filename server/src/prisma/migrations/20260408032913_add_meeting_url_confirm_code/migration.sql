-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "meetingUrl" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "actualDurationMinutes" INTEGER,
ADD COLUMN     "confirmCode" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3);
