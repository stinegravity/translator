CREATE TYPE "ReviewerAccessStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "User"
ADD COLUMN "reviewerAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reviewerAccessStatus" "ReviewerAccessStatus" NOT NULL DEFAULT 'NONE';

CREATE TABLE "ReviewerApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ReviewerAccessStatus" NOT NULL DEFAULT 'PENDING',
  "organization" TEXT,
  "roleTitle" TEXT,
  "languages" TEXT,
  "credentials" TEXT NOT NULL,
  "reviewUseCase" TEXT,
  "portfolioUrl" TEXT,
  "notes" TEXT,
  "reviewerDecisionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  CONSTRAINT "ReviewerApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReviewerApplication_userId_createdAt_idx" ON "ReviewerApplication"("userId", "createdAt");
CREATE INDEX "ReviewerApplication_status_createdAt_idx" ON "ReviewerApplication"("status", "createdAt");

ALTER TABLE "ReviewerApplication"
ADD CONSTRAINT "ReviewerApplication_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
