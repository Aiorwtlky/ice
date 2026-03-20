-- 班級競賽（河內塔）：若資料庫是舊版、尚未含此功能，執行 `npx prisma migrate deploy` 會套用本 migration。

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "CompetitionKind" AS ENUM ('HANOI_TOWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CompetitionMode" AS ENUM ('TIME_LIMIT', 'MOVE_LIMIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'OPEN', 'PAUSED', 'ENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "class_competitions" (
    "id" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CompetitionKind" NOT NULL DEFAULT 'HANOI_TOWER',
    "mode" "CompetitionMode" NOT NULL,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
    "discCount" INTEGER NOT NULL,
    "timeLimitSec" INTEGER,
    "moveLimit" INTEGER,
    "rulesText" TEXT,
    "openedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "pauseStartedAt" TIMESTAMP(3),
    "totalPausedMs" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_competitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "class_competition_scores" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bestSteps" INTEGER NOT NULL,
    "bestTimeMs" INTEGER,
    "lastPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB,

    CONSTRAINT "class_competition_scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "class_competition_logs" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "timeDiffMs" INTEGER,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_competition_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "class_competitions_classGroupId_status_idx" ON "class_competitions"("classGroupId", "status");
CREATE INDEX IF NOT EXISTS "class_competition_scores_competitionId_bestSteps_idx" ON "class_competition_scores"("competitionId", "bestSteps");
CREATE UNIQUE INDEX IF NOT EXISTS "class_competition_scores_competitionId_userId_key" ON "class_competition_scores"("competitionId", "userId");
CREATE INDEX IF NOT EXISTS "class_competition_logs_competitionId_userId_createdAt_idx" ON "class_competition_logs"("competitionId", "userId", "createdAt");

-- AddForeignKey（若已存在則略過）
DO $$ BEGIN
    ALTER TABLE "class_competitions" ADD CONSTRAINT "class_competitions_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "class_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "class_competitions" ADD CONSTRAINT "class_competitions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "class_competition_scores" ADD CONSTRAINT "class_competition_scores_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "class_competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "class_competition_scores" ADD CONSTRAINT "class_competition_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "class_competition_logs" ADD CONSTRAINT "class_competition_logs_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "class_competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "class_competition_logs" ADD CONSTRAINT "class_competition_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
