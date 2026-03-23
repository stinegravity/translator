ALTER TABLE "User"
ADD COLUMN "portalAccess" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "portalAccess" = true
WHERE "email" = 'admin@kyerease.com';
