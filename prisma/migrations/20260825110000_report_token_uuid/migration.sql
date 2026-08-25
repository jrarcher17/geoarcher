-- Personalized report links (/r/[token]) use UUID v4, not CUID.
ALTER TABLE "Prospect" ALTER COLUMN "reportToken" SET DEFAULT gen_random_uuid()::text;

UPDATE "Prospect"
SET "reportToken" = gen_random_uuid()::text
WHERE "reportToken" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
