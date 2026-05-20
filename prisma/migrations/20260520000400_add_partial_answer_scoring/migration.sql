ALTER TABLE "Attempt"
  ALTER COLUMN "score" TYPE DOUBLE PRECISION USING "score"::DOUBLE PRECISION,
  ALTER COLUMN "maxScore" TYPE DOUBLE PRECISION USING "maxScore"::DOUBLE PRECISION;

ALTER TABLE "UserAnswer" ADD COLUMN "earnedPoints" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "UserAnswer" ua
SET "earnedPoints" = q."points"::DOUBLE PRECISION
FROM "Question" q
WHERE ua."questionId" = q."id"
  AND ua."isCorrect" = true;
