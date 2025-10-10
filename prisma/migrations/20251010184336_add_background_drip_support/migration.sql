/*
  Warnings:

  - You are about to drop the column `endedAt` on the `DripSession` table. All the data in the column will be lost.
  - You are about to drop the column `planSnapshot` on the `DripSession` table. All the data in the column will be lost.
  - You are about to drop the column `totalWordsAppended` on the `DripSession` table. All the data in the column will be lost.
  - You are about to drop the column `totalWordsPlanned` on the `DripSession` table. All the data in the column will be lost.
  - You are about to drop the `DripAppend` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `docId` to the `DripSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `durationMin` to the `DripSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endsAt` to the `DripSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nextAt` to the `DripSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `text` to the `DripSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalWords` to the `DripSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `DripSession` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."DripStatus" AS ENUM ('RUNNING', 'PAUSED', 'DONE', 'ERROR', 'CANCELED');

-- DropForeignKey
ALTER TABLE "public"."DripAppend" DROP CONSTRAINT "DripAppend_sessionId_fkey";

-- AlterTable
ALTER TABLE "public"."DripSession" DROP COLUMN "endedAt",
DROP COLUMN "planSnapshot",
DROP COLUMN "totalWordsAppended",
DROP COLUMN "totalWordsPlanned",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "docId" TEXT NOT NULL,
ADD COLUMN     "doneWords" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "durationMin" INTEGER NOT NULL,
ADD COLUMN     "endsAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "nextAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "public"."DripStatus" NOT NULL DEFAULT 'RUNNING',
ADD COLUMN     "text" TEXT NOT NULL,
ADD COLUMN     "totalWords" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "gAccessToken" TEXT,
ADD COLUMN     "gAccessTokenExp" INTEGER,
ADD COLUMN     "gRefreshToken" TEXT;

-- DropTable
DROP TABLE "public"."DripAppend";

-- CreateIndex
CREATE INDEX "DripSession_status_nextAt_idx" ON "public"."DripSession"("status", "nextAt");

-- CreateIndex
CREATE INDEX "DripSession_userId_idx" ON "public"."DripSession"("userId");
