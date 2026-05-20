ALTER TABLE "Test" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Test_deletedAt_idx" ON "Test"("deletedAt");
