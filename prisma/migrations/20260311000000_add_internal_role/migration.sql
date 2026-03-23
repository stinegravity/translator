CREATE TYPE "InternalRole" AS ENUM ('CUSTOMER', 'OPS', 'ADMIN');

ALTER TABLE "User"
ADD COLUMN "internalRole" "InternalRole" NOT NULL DEFAULT 'CUSTOMER';

UPDATE "User"
SET "internalRole" = CASE
  WHEN "portalAccess" = true THEN 'ADMIN'::"InternalRole"
  ELSE 'CUSTOMER'::"InternalRole"
END;
