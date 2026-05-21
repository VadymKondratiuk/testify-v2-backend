-- CreateEnum
CREATE TYPE "LearningGoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "LearningGoal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetScore" INTEGER NOT NULL DEFAULT 80,
    "targetDifficulty" "Difficulty",
    "deadline" TIMESTAMP(3),
    "status" "LearningGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,

    CONSTRAINT "LearningGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningGoalTag" (
    "goalId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "LearningGoalTag_pkey" PRIMARY KEY ("goalId","tagId")
);

-- CreateIndex
CREATE INDEX "LearningGoal_userId_status_idx" ON "LearningGoal"("userId", "status");

-- CreateIndex
CREATE INDEX "LearningGoalTag_tagId_idx" ON "LearningGoalTag"("tagId");

-- AddForeignKey
ALTER TABLE "LearningGoal" ADD CONSTRAINT "LearningGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningGoal" ADD CONSTRAINT "LearningGoal_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningGoalTag" ADD CONSTRAINT "LearningGoalTag_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LearningGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningGoalTag" ADD CONSTRAINT "LearningGoalTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
