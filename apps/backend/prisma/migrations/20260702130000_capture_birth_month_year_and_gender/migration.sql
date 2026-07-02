-- Issue #25: capture birth month+year (age band becomes DERIVED at read time, no longer
-- stored on Child) and an optional inclusive gender field. Trend history keeps the band
-- each screening used (DomainProfileRecord.ageBand snapshot).
--
-- Hand-written (not auto-generated) because existing rows need a backfill: the generated
-- ALTER would fail on any non-empty Child table. Backfill strategy for pre-migration
-- children (which only have a stored ageBand): approximate a mid-band birth month/year
-- relative to now(). This is an approximation of already-coarse data — the derived band
-- for such a child stays the same band the caregiver originally picked.

-- 1. New Child columns, nullable first so existing rows survive the ALTER.
ALTER TABLE "Child"
  ADD COLUMN "birthMonth" INTEGER,
  ADD COLUMN "birthYear" INTEGER,
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "genderDetail" TEXT;

-- 2. Backfill existing children from their stored band (mid-band age, in months):
--    toddler 24, preschool 54, primary 114, teen 192, young_adult 270.
UPDATE "Child" SET
  "birthMonth" = EXTRACT(MONTH FROM (now() - make_interval(months => CASE "ageBand"
      WHEN 'toddler' THEN 24
      WHEN 'preschool' THEN 54
      WHEN 'primary' THEN 114
      WHEN 'teen' THEN 192
      WHEN 'young_adult' THEN 270
      ELSE 24 END)))::int,
  "birthYear" = EXTRACT(YEAR FROM (now() - make_interval(months => CASE "ageBand"
      WHEN 'toddler' THEN 24
      WHEN 'preschool' THEN 54
      WHEN 'primary' THEN 114
      WHEN 'teen' THEN 192
      WHEN 'young_adult' THEN 270
      ELSE 24 END)))::int
WHERE "birthMonth" IS NULL;

ALTER TABLE "Child"
  ALTER COLUMN "birthMonth" SET NOT NULL,
  ALTER COLUMN "birthYear" SET NOT NULL;

-- 3. Trend history: stamp each computed screening snapshot with the band it used.
--    Backfill existing snapshots from the child's stored band BEFORE that column drops.
ALTER TABLE "DomainProfileRecord" ADD COLUMN "ageBand" TEXT;

UPDATE "DomainProfileRecord" d
SET "ageBand" = c."ageBand"
FROM "Child" c
WHERE d."childId" = c."id" AND d."ageBand" IS NULL;

ALTER TABLE "DomainProfileRecord" ALTER COLUMN "ageBand" SET NOT NULL;

-- 4. The stored band is now fully replaced by derivation.
ALTER TABLE "Child" DROP COLUMN "ageBand";
