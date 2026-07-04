-- Issue #33: idempotent intake ingestion. (childId, questionId, timestamp) becomes the
-- natural idempotency key — the mobile client stamps a whole submission batch with one
-- timestamp, so an exact replay (double-tap, network retry, offline-sync re-delivery)
-- carries identical pairs and is skipped via createMany({ skipDuplicates }). Genuine
-- re-answers arrive in later submissions with fresh timestamps, so answer history is
-- still retained (scoring reads only the latest per question).
--
-- Hand-written (not auto-generated) because pre-existing exact-duplicate rows — the very
-- bug this fixes — would make CREATE UNIQUE INDEX fail. Deleting them is safe: rows
-- identical on the key are replays of the same answer event, and the scoring engine
-- (dedupeLatestByQuestion) never counted more than one of them anyway.

-- 1. Drop exact replays, keeping one row per (childId, questionId, timestamp). Prefer the
--    row a free-text analysis already attached to (analyzedAt set), then the oldest ctid
--    for determinism.
DELETE FROM "IntakeResponseRecord" a
USING "IntakeResponseRecord" b
WHERE a."childId" = b."childId"
  AND a."questionId" = b."questionId"
  AND a."timestamp" = b."timestamp"
  AND a."id" <> b."id"
  AND (
    (a."analyzedAt" IS NULL AND b."analyzedAt" IS NOT NULL)
    OR (
      (a."analyzedAt" IS NULL) = (b."analyzedAt" IS NULL)
      AND a.ctid > b.ctid
    )
  );

-- 2. The idempotency key itself.
CREATE UNIQUE INDEX "IntakeResponseRecord_childId_questionId_timestamp_key"
  ON "IntakeResponseRecord"("childId", "questionId", "timestamp");
