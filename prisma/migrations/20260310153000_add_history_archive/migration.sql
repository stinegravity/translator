ALTER TABLE "TranslationHistory"
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "TranslationHistory_archivedAt_createdAt_idx"
ON "TranslationHistory"("archivedAt", "createdAt");
