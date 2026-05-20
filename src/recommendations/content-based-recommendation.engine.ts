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

export type RecommendationCandidate<TTest extends ScoringTest = ScoringTest> = {
  test: TTest;
  score: number;
  matchedTags: string[];
  reason: string;
  recommendationType: 'knowledge_gap' | 'next_level' | 'popular';
};

export class ContentBasedRecommendationEngine {
  scoreTests<TTest extends ScoringTest>(
    tests: TTest[],
    tagMasteries: ScoringTagMastery[],
    attempts: ScoringAttempt[],
  ) {
    return tests
      .map((test) => this.scoreTest(test, tagMasteries, attempts))
      .sort((a, b) => b.score - a.score);
  }

  scoreTest<TTest extends ScoringTest>(
    test: TTest,
    tagMasteries: ScoringTagMastery[],
    attempts: ScoringAttempt[],
  ): RecommendationCandidate<TTest> {
    const weakTagWeights = this.buildWeakTagWeights(tagMasteries);
    const testTags = this.getUniqueTestTags(test);
    const matchedTags = testTags.filter((tag) => weakTagWeights.has(tag.id));
    const weakTagMatch = this.getWeakTagMatch(matchedTags, weakTagWeights);
    const categoryMatch = this.getCategoryMatch(test.categoryId, attempts);
    const difficultyMatch = this.getDifficultyMatch(test.difficulty, attempts);
    const ratingScore = Math.min(test.averageRating / 5, 1);
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
        alreadyPassedPenalty,
    );

    return {
      test,
      score,
      matchedTags: matchedTags.map((tag) => tag.name),
      reason: this.buildReason(test, matchedTags, attempts),
      recommendationType: this.getRecommendationType(matchedTags, attempts),
    };
  }

  private buildWeakTagWeights(tagMasteries: ScoringTagMastery[]) {
    const weights = new Map<string, number>();

    for (const mastery of tagMasteries) {
      const confidence = Math.min(1, mastery.attemptsCount / 5);
      const weaknessScore = (1 - mastery.masteryScore) * confidence;

      if (weaknessScore >= 0.15) {
        weights.set(mastery.tag.id, weaknessScore);
      }
    }

    return weights;
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
    weakTagWeights: Map<string, number>,
  ) {
    if (weakTagWeights.size === 0 || matchedTags.length === 0) {
      return 0;
    }

    const matchedWeight = matchedTags.reduce(
      (total, tag) => total + (weakTagWeights.get(tag.id) ?? 0),
      0,
    );
    const totalWeight = [...weakTagWeights.values()].reduce(
      (total, weight) => total + weight,
      0,
    );

    return totalWeight === 0 ? 0 : Math.min(matchedWeight / totalWeight, 1);
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
    const latestDifficulty = attempts[0]?.test.difficulty ?? Difficulty.BEGINNER;
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

  private buildReason(
    test: ScoringTest,
    matchedTags: Array<{ name: string }>,
    attempts: ScoringAttempt[],
  ) {
    if (matchedTags.length > 0) {
      return `Recommended to practice ${matchedTags
        .slice(0, 3)
        .map((tag) => tag.name)
        .join(', ')}.`;
    }

    if (attempts.length > 0 && attempts[0]?.test.categoryId === test.categoryId) {
      return `Good next step in ${test.categoryName ?? 'this category'}.`;
    }

    return 'Popular test that fits your current learning profile.';
  }

  private getRecommendationType(
    matchedTags: Array<{ name: string }>,
    attempts: ScoringAttempt[],
  ): RecommendationCandidate['recommendationType'] {
    if (matchedTags.length > 0) {
      return 'knowledge_gap';
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
