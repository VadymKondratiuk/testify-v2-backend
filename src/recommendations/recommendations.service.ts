import { Injectable } from '@nestjs/common';
import { Difficulty, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FindRecommendationsQueryDto } from './dto/find-recommendations-query.dto';

type PublishedTest = Prisma.TestGetPayload<{
  include: {
    category: true;
    questions: { include: { tags: true } };
    _count: { select: { questions: true; attempts: true; ratings: true } };
  };
}>;

type UserAttemptSummary = Prisma.AttemptGetPayload<{
  include: { test: { select: { id: true; categoryId: true; difficulty: true } } };
}>;

type RecommendationCandidate = {
  test: PublishedTest;
  score: number;
  matchedTags: string[];
  reason: string;
  recommendationType: 'knowledge_gap' | 'next_level' | 'popular';
};

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findForUser(userId: string, query: FindRecommendationsQueryDto) {
    const limit = query.limit ?? 6;
    const placement = query.placement ?? 'catalog';

    const [tagMasteries, attempts, tests] = await this.prisma.$transaction([
      this.prisma.userTagMastery.findMany({
        where: { userId },
        include: { tag: true },
        orderBy: [{ masteryScore: 'asc' }, { attemptsCount: 'desc' }],
      }),
      this.prisma.attempt.findMany({
        where: {
          userId,
          completedAt: { not: null },
        },
        orderBy: { completedAt: 'desc' },
        take: 20,
        include: {
          test: {
            select: {
              id: true,
              categoryId: true,
              difficulty: true,
            },
          },
        },
      }),
      this.prisma.test.findMany({
        where: {
          isPublished: true,
          questions: {
            some: {},
          },
        },
        include: {
          category: true,
          questions: {
            include: {
              tags: true,
            },
          },
          _count: {
            select: {
              questions: true,
              attempts: true,
              ratings: true,
            },
          },
        },
      }),
    ]);

    const candidates = tests
      .map((test) => this.scoreTest(test, tagMasteries, attempts))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    await this.saveSnapshot(userId, placement, candidates);

    return {
      items: candidates.map((candidate) => ({
        id: candidate.test.id,
        title: candidate.test.title,
        description: candidate.test.description,
        difficulty: candidate.test.difficulty,
        timeLimit: candidate.test.timeLimit,
        averageRating: candidate.test.averageRating,
        category: candidate.test.category,
        score: candidate.score,
        reason: candidate.reason,
        matchedTags: candidate.matchedTags,
        recommendationType: candidate.recommendationType,
        _count: candidate.test._count,
      })),
      meta: {
        placement,
        total: candidates.length,
      },
    };
  }

  private scoreTest(
    test: PublishedTest,
    tagMasteries: Array<{
      attemptsCount: number;
      masteryScore: number;
      tag: { id: string; name: string };
    }>,
    attempts: UserAttemptSummary[],
  ): RecommendationCandidate {
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

  private buildWeakTagWeights(
    tagMasteries: Array<{
      attemptsCount: number;
      masteryScore: number;
      tag: { id: string };
    }>,
  ) {
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

  private getUniqueTestTags(test: PublishedTest) {
    const tagsById = new Map<string, { id: string; name: string }>();

    for (const question of test.questions) {
      for (const tag of question.tags) {
        tagsById.set(tag.id, { id: tag.id, name: tag.name });
      }
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

  private getCategoryMatch(categoryId: string | null, attempts: UserAttemptSummary[]) {
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
    attempts: UserAttemptSummary[],
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
    test: PublishedTest,
    matchedTags: Array<{ name: string }>,
    attempts: UserAttemptSummary[],
  ) {
    if (matchedTags.length > 0) {
      return `Recommended to practice ${matchedTags
        .slice(0, 3)
        .map((tag) => tag.name)
        .join(', ')}.`;
    }

    if (attempts.length > 0 && attempts[0]?.test.categoryId === test.categoryId) {
      return `Good next step in ${test.category?.name ?? 'this category'}.`;
    }

    return 'Popular test that fits your current learning profile.';
  }

  private getRecommendationType(
    matchedTags: Array<{ name: string }>,
    attempts: UserAttemptSummary[],
  ): RecommendationCandidate['recommendationType'] {
    if (matchedTags.length > 0) {
      return 'knowledge_gap';
    }

    if (attempts.length > 0) {
      return 'next_level';
    }

    return 'popular';
  }

  private async saveSnapshot(
    userId: string,
    placement: string,
    candidates: RecommendationCandidate[],
  ) {
    await this.prisma.recommendationSnapshot.create({
      data: {
        userId,
        placement,
        testIds: candidates.map((candidate) => candidate.test.id),
        payload: candidates.map((candidate) => ({
          testId: candidate.test.id,
          score: candidate.score,
          reason: candidate.reason,
          matchedTags: candidate.matchedTags,
          recommendationType: candidate.recommendationType,
        })),
      },
    });
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
