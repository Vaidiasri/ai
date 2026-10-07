-- CreateEnum
CREATE TYPE "public"."AgentChannel" AS ENUM ('VOICE', 'TEXT');

-- CreateEnum
CREATE TYPE "public"."AgentLanguage" AS ENUM ('EN', 'HI');

-- CreateEnum
CREATE TYPE "public"."AgentEndReason" AS ENUM ('COMPLETED', 'TIME_LIMIT', 'MESSAGE_LIMIT', 'PROVIDER_ERROR', 'ABANDONED');

-- CreateTable
CREATE TABLE "public"."agent_sessions" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "public"."AgentChannel" NOT NULL,
    "language" "public"."AgentLanguage" NOT NULL,
    "provider" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" "public"."AgentEndReason",
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "transcribeCount" INTEGER NOT NULL DEFAULT 0,
    "appointmentId" TEXT,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_sessions_clinicId_userId_startedAt_idx" ON "public"."agent_sessions"("clinicId", "userId", "startedAt");

-- CreateIndex
CREATE INDEX "agent_sessions_startedAt_idx" ON "public"."agent_sessions"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_id_clinicId_key" ON "public"."appointments"("id", "clinicId");

-- AddForeignKey
ALTER TABLE "public"."agent_sessions" ADD CONSTRAINT "agent_sessions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_sessions" ADD CONSTRAINT "agent_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_sessions" ADD CONSTRAINT "agent_sessions_appointmentId_clinicId_fkey" FOREIGN KEY ("appointmentId", "clinicId") REFERENCES "public"."appointments"("id", "clinicId") ON DELETE NO ACTION ON UPDATE CASCADE;

