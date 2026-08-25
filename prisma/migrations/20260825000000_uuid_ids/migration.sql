-- New rows use UUID v4 instead of CUID. Existing non-UUID primary keys are remapped;
-- child FKs already use ON UPDATE CASCADE.

ALTER TABLE "UserSite" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "GeoConfig" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "GeoHit" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "VisibilityReport" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Simulation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Page" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Analysis" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "SeoAudit" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "SeoPageAudit" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "SeoOpportunity" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "SeoLinkSuggestion" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "AutopilotRun" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "SeoKeyword" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "SeoRankCheck" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "LeadCampaign" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Prospect" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Prospect" ALTER COLUMN "reportToken" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "OutreachEmail" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "EmailSuppression" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "SeoSearchOpportunity" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Site" ALTER COLUMN "geoKey" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- Remap SeoAudit first so loose auditId columns can follow.
CREATE TEMP TABLE "_audit_id_remap" AS
SELECT "id" AS "old_id", gen_random_uuid()::text AS "new_id"
FROM "SeoAudit"
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "SeoAudit" AS t
SET "id" = m."new_id"
FROM "_audit_id_remap" AS m
WHERE t."id" = m."old_id";

UPDATE "SeoOpportunity" AS t
SET "auditId" = m."new_id"
FROM "_audit_id_remap" AS m
WHERE t."auditId" = m."old_id";

UPDATE "SeoLinkSuggestion" AS t
SET "auditId" = m."new_id"
FROM "_audit_id_remap" AS m
WHERE t."auditId" = m."old_id";

UPDATE "SeoSearchOpportunity" AS t
SET "auditId" = m."new_id"
FROM "_audit_id_remap" AS m
WHERE t."auditId" = m."old_id";

DROP TABLE "_audit_id_remap";

-- Remaining primary keys (FKs cascade).
UPDATE "UserSite" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "GeoConfig" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "GeoHit" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "VisibilityReport" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "Simulation" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

CREATE TEMP TABLE "_page_id_remap" AS
SELECT "id" AS "old_id", gen_random_uuid()::text AS "new_id"
FROM "Page"
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "Page" AS t
SET "id" = m."new_id"
FROM "_page_id_remap" AS m
WHERE t."id" = m."old_id";

UPDATE "SeoPageAudit" AS t
SET "pageId" = m."new_id"
FROM "_page_id_remap" AS m
WHERE t."pageId" = m."old_id";

DROP TABLE "_page_id_remap";

UPDATE "Analysis" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "SeoPageAudit" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "SeoOpportunity" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "SeoLinkSuggestion" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "AutopilotRun" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "SeoKeyword" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "SeoRankCheck" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "LeadCampaign" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "Prospect" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "OutreachEmail" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "EmailSuppression" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "SeoSearchOpportunity" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "session" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "account" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "verification" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "user" SET "id" = gen_random_uuid()::text
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
