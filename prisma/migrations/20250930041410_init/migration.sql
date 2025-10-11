-- CreateEnum
CREATE TYPE "public"."Plan" AS ENUM ('FREE', 'STARTER', 'PRO', 'DAYPASS', 'DEV');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" "public"."Plan" NOT NULL DEFAULT 'FREE',
    "tz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "wordsUsed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DripSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planSnapshot" "public"."Plan" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "totalWordsPlanned" INTEGER,
    "totalWordsAppended" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DripSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DripAppend" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "wordsAppended" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DripAppend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DailyUsage_userId_dateKey_key" ON "public"."DailyUsage"("userId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "DripAppend_sessionId_sequence_key" ON "public"."DripAppend"("sessionId", "sequence");

-- AddForeignKey
ALTER TABLE "public"."DailyUsage" ADD CONSTRAINT "DailyUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DripSession" ADD CONSTRAINT "DripSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DripAppend" ADD CONSTRAINT "DripAppend_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."DripSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
