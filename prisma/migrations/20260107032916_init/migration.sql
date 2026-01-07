-- CreateEnum
CREATE TYPE "PlayerState" AS ENUM ('IDLE', 'PLAYING');

-- CreateTable
CREATE TABLE "Player" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" "PlayerState" NOT NULL DEFAULT 'IDLE',
    "gold" INTEGER NOT NULL DEFAULT 0,
    "lp" INTEGER NOT NULL DEFAULT 1000,
    "tier" TEXT NOT NULL DEFAULT 'SILVER IV',
    "championId" TEXT,
    "role" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "dailyWaveUsed" INTEGER NOT NULL DEFAULT 0,
    "waveCount" INTEGER NOT NULL DEFAULT 0,
    "lastWaveRecoverAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dailyWaveResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActionAt" TIMESTAMP(3),
    "lastSurrenderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("roomId","userId","slot")
);

-- CreateTable
CREATE TABLE "SkillOwned" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "skillLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillOwned_pkey" PRIMARY KEY ("roomId","userId","skillId")
);
