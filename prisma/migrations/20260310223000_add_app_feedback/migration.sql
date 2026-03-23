-- CreateTable
CREATE TABLE "AppFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "overallRating" INTEGER NOT NULL,
    "performanceRating" INTEGER NOT NULL,
    "reliabilityRating" INTEGER NOT NULL,
    "easeRating" INTEGER NOT NULL,
    "notes" TEXT,
    "currentPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppFeedback_userId_createdAt_idx" ON "AppFeedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AppFeedback_createdAt_idx" ON "AppFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "AppFeedback_overallRating_createdAt_idx" ON "AppFeedback"("overallRating", "createdAt");

-- AddForeignKey
ALTER TABLE "AppFeedback" ADD CONSTRAINT "AppFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
