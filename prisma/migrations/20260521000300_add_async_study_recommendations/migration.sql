-- CreateEnum
CREATE TYPE "StudyRecommendationStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Attempt"
ADD COLUMN "studyRecommendationStatus" "StudyRecommendationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN "studyRecommendationGeneratedAt" TIMESTAMP(3);

-- Backfill existing completed attempts so old result pages do not poll forever.
UPDATE "Attempt"
SET
  "studyRecommendationStatus" = CASE
    WHEN "studyRecommendation" IS NOT NULL THEN 'COMPLETED'::"StudyRecommendationStatus"
    WHEN "completedAt" IS NOT NULL THEN 'FAILED'::"StudyRecommendationStatus"
    ELSE 'NOT_REQUESTED'::"StudyRecommendationStatus"
  END,
  "studyRecommendationGeneratedAt" = CASE
    WHEN "studyRecommendation" IS NOT NULL THEN "completedAt"
    ELSE NULL
  END;
