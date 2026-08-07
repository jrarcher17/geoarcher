-- New Site / Scan rows use UUID v4 instead of CUID (public URL ids).
ALTER TABLE "Site" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Scan" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- Remap existing non-UUID Site ids. Child FKs use ON UPDATE CASCADE.
UPDATE "Site"
SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Remap Scan ids; keep GeoConfig.sourceScanId (no FK) in sync.
CREATE TEMP TABLE "_scan_id_remap" AS
SELECT
  "id" AS "old_id",
  gen_random_uuid()::text AS "new_id"
FROM "Scan"
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "Scan" AS s
SET "id" = m."new_id"
FROM "_scan_id_remap" AS m
WHERE s."id" = m."old_id";

UPDATE "GeoConfig" AS g
SET "sourceScanId" = m."new_id"
FROM "_scan_id_remap" AS m
WHERE g."sourceScanId" = m."old_id";

DROP TABLE "_scan_id_remap";
