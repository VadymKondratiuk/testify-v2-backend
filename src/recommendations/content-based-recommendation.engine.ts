import { Difficulty } from '@prisma/client';

export type ScoringTag = {
  id: string;
  name: string;
};

export type ScoringTest = {
  id: string;
  title: string;
  categoryId: string | null;
  categoryName?: string | null;
  difficulty: Difficulty;
  averageRating: number;
  tags: ScoringTag[];
};

export type ScoringTagMastery = {
  attemptsCount: number;
  correctCount: number;
  wrongCount: number;
  masteryScore: number;
  tag: ScoringTag;
};

export type ScoringAttempt = {
  testId: string;
  score: number;
  maxScore: number;
  isPassed: boolean;
  test: {
    categoryId: string | null;
    difficulty: Difficulty;
  };
};

export type ScoringLearningGoal = {
  title: string;
  categoryId: string | null;
  targetDifficulty: Difficulty | null;
  tagIds: string[];
};

export type RecommendationCandidate<TTest extends ScoringTest = ScoringTest> = {
  test: TTest;
  score: number;
  matchedTags: string[];
  goalMatches: string[];
  weaknessDetails: RecommendationWeaknessDetail[];
  reason: string;
  recommendationType:
    | 'knowledge_gap'
    | 'learning_goal'
    | 'next_level'
    | 'popular';
};

export type RecommendationWeaknessDetail = {
  tagId: string;
  tag: string;
  attemptsCount: number;
  correctCount: number;
  wrongCount: number;
  masteryScore: number;
  weaknessScore: number;
};

export class ContentBasedRecommendationEngine {
  scoreTests<TTest extends ScoringTest>(
    tests: TTest[],
    tagMasteries: ScoringTagMastery[],
    attempts: ScoringAttempt[],
    learningGoals: ScoringLearningGoal[] = [],
  ) {
    return tests
      .map((test) =>
        this.scoreTest(test, tagMasteries, attempts, learningGoals),
      )
      .sort((a, b) => b.score - a.score);
  }

  scoreTest<TTest extends ScoringTest>(
    test: TTest,
    tagMasteries: ScoringTagMastery[],
    attempts: ScoringAttempt[],
    learningGoals: ScoringLearningGoal[] = [],
  ): RecommendationCandidate<TTest> {
    const weakTagProfiles = this.buildWeakTagProfiles(tagMasteries);
    const testTags = this.getUniqueTestTags(test);
    const matchedTags = testTags.filter((tag) => weakTagProfiles.has(tag.id));
    const weaknessDetails = this.getWeaknessDetails(
      matchedTags,
      weakTagProfiles,
    );
    const weakTagMatch = this.getWeakTagMatch(matchedTags, weakTagProfiles);
    const categoryMatch = this.getCategoryMatch(test.categoryId, attempts);
    const difficultyMatch = this.getDifficultyMatch(test.difficulty, attempts);
    const ratingScore = Math.min(test.averageRating / 5, 1);
    const goalMatches = this.getGoalMatches(test, learningGoals);
    const goalMatch = goalMatches[0]?.score ?? 0;
    const noveltyScore = attempts.some((attempt) => attempt.testId === test.id)
      ? 0
      : 1;
    const alreadyPassedPenalty = attempts.some(
      (attempt) => attempt.testId === test.id && attempt.isPassed,
    )
      ? 0.25
      : 0;

    const score = this.roundScore(
      0.4 * weakTagMatch +
        0.2 * categoryMatch +
        0.15 * difficultyMatch +
        0.1 * ratingScore +
        0.1 * noveltyScore -
        alreadyPassedPenalty +
        0.2 * goalMatch,
    );

    return {
      test,
      score,
      matchedTags: matchedTags.map((tag) => tag.name),
      goalMatches: goalMatches.map((goal) => goal.title),
      weaknessDetails,
      reason: this.buildReason(
        test,
        matchedTags,
        weaknessDetails,
        attempts,
        goalMatches.map((goal) => goal.title),
      ),
      recommendationType: this.getRecommendationType(
        matchedTags,
        attempts,
        goalMatches,
      ),
    };
  }

  private buildWeakTagProfiles(tagMasteries: ScoringTagMastery[]) {
    const profiles = new Map<string, RecommendationWeaknessDetail>();

    for (const mastery of tagMasteries) {
      const confidence = Math.min(1, mastery.attemptsCount / 5);
      const weaknessScore = (1 - mastery.masteryScore) * confidence;

      if (weaknessScore >= 0.15) {
        profiles.set(mastery.tag.id, {
          tagId: mastery.tag.id,
          tag: mastery.tag.name,
          attemptsCount: mastery.attemptsCount,
          correctCount: mastery.correctCount,
          wrongCount: mastery.wrongCount,
          masteryScore: this.roundScore(mastery.masteryScore),
          weaknessScore: this.roundScore(weaknessScore),
        });
      }
    }

    return profiles;
  }

  private getUniqueTestTags(test: ScoringTest) {
    const tagsById = new Map<string, ScoringTag>();

    for (const tag of test.tags) {
      tagsById.set(tag.id, tag);
    }

    return [...tagsById.values()];
  }

  private getWeakTagMatch(
    matchedTags: Array<{ id: string }>,
    weakTagProfiles: Map<string, RecommendationWeaknessDetail>,
  ) {
    if (weakTagProfiles.size === 0 || matchedTags.length === 0) {
      return 0;
    }

    const matchedWeight = matchedTags.reduce(
      (total, tag) => total + (weakTagProfiles.get(tag.id)?.weaknessScore ?? 0),
      0,
    );
    const totalWeight = [...weakTagProfiles.values()].reduce(
      (total, profile) => total + profile.weaknessScore,
      0,
    );

    return totalWeight === 0 ? 0 : Math.min(matchedWeight / totalWeight, 1);
  }

  private getWeaknessDetails(
    matchedTags: ScoringTag[],
    weakTagProfiles: Map<string, RecommendationWeaknessDetail>,
  ) {
    return matchedTags
      .map((tag) => weakTagProfiles.get(tag.id))
      .filter((detail): detail is RecommendationWeaknessDetail =>
        Boolean(detail),
      )
      .sort((a, b) => b.weaknessScore - a.weaknessScore);
  }

  private getCategoryMatch(
    categoryId: string | null,
    attempts: ScoringAttempt[],
  ) {
    if (!categoryId || attempts.length === 0) {
      return 0;
    }

    const matchingAttempts = attempts.filter(
      (attempt) => attempt.test.categoryId === categoryId,
    ).length;

    return Math.min(matchingAttempts / 3, 1);
  }

  private getDifficultyMatch(
    difficulty: Difficulty,
    attempts: ScoringAttempt[],
  ) {
    if (attempts.length === 0) {
      return difficulty === Difficulty.BEGINNER ? 1 : 0.5;
    }

    const averageScore =
      attempts.reduce(
        (total, attempt) =>
          total + this.toPercentage(attempt.score, attempt.maxScore),
        0,
      ) / attempts.length;
    const latestDifficulty =
      attempts[0]?.test.difficulty ?? Difficulty.BEGINNER;
    const targetDifficulty = this.getTargetDifficulty(
      latestDifficulty,
      averageScore,
    );

    return difficulty === targetDifficulty ? 1 : 0.35;
  }

  private getTargetDifficulty(current: Difficulty, averageScore: number) {
    if (averageScore < 60) {
      return current === Difficulty.ADVANCED
        ? Difficulty.INTERMEDIATE
        : Difficulty.BEGINNER;
    }

    if (averageScore >= 85) {
      if (current === Difficulty.BEGINNER) {
        return Difficulty.INTERMEDIATE;
      }

      return Difficulty.ADVANCED;
    }

    return current;
  }

  private getGoalMatches(
    test: ScoringTest,
    learningGoals: ScoringLearningGoal[],
  ) {
    if (learningGoals.length === 0) {
      return [];
    }

    const testTagIds = new Set(test.tags.map((tag) => tag.id));

    return learningGoals
      .map((goal) => ({
        title: goal.title,
        score: this.getGoalMatchScore(test, testTagIds, goal),
      }))
      .filter((goal) => goal.score >= 0.35)
      .sort((a, b) => b.score - a.score);
  }

  private getGoalMatchScore(
    test: ScoringTest,
    testTagIds: Set<string>,
    goal: ScoringLearningGoal,
  ) {
    const scores: number[] = [];

    if (goal.categoryId) {
      scores.push(test.categoryId === goal.categoryId ? 1 : 0);
    }

    if (goal.targetDifficulty) {
      scores.push(test.difficulty === goal.targetDifficulty ? 1 : 0.25);
    }

    if (goal.tagIds.length > 0) {
      const matchingTags = goal.tagIds.filter((tagId) => testTagIds.has(tagId));
      scores.push(matchingTags.length / goal.tagIds.length);
    }

    if (scores.length === 0) {
      return 0;
    }

    return scores.reduce((total, score) => total + score, 0) / scores.length;
  }

  private buildReason(
    test: ScoringTest,
    matchedTags: Array<{ name: string }>,
    weaknessDetails: RecommendationWeaknessDetail[],
    attempts: ScoringAttempt[],
    goalMatches: string[],
  ) {
    if (matchedTags.length > 0) {
      const weakestTag = weaknessDetails[0];
      const masteryHint = weakestTag
        ? ` Your ${weakestTag.tag} mastery is ${Math.round(
            weakestTag.masteryScore * 100,
          )}%.`
        : '';

      return `Recommended to practice ${matchedTags
        .slice(0, 3)
        .map((tag) => tag.name)
        .join(', ')}.${masteryHint}`;
    }

    if (goalMatches.length > 0) {
      return `Matches your learning goal: ${goalMatches[0]}.`;
    }

    if (
      attempts.length > 0 &&
      attempts[0]?.test.categoryId === test.categoryId
    ) {
      return `Good next step in ${test.categoryName ?? 'this category'}.`;
    }

    return 'Popular test that fits your current learning profile.';
  }

  private getRecommendationType(
    matchedTags: Array<{ name: string }>,
    attempts: ScoringAttempt[],
    goalMatches: Array<{ title: string; score: number }>,
  ): RecommendationCandidate['recommendationType'] {
    if (matchedTags.length > 0) {
      return 'knowledge_gap';
    }

    if (goalMatches.length > 0) {
      return 'learning_goal';
    }

    if (attempts.length > 0) {
      return 'next_level';
    }

    return 'popular';
  }

  private toPercentage(value: number, total: number) {
    if (total === 0) {
      return 0;
    }

    return (value / total) * 100;
  }

  private roundScore(value: number) {
    return Math.max(0, Math.round(value * 10000) / 10000);
  }
}
