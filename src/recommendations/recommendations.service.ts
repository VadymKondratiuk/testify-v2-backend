import { Injectable, NotFoundException } from '@nestjs/common';
import { LearningGoalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContentBasedRecommendationEngine,
  RecommendationCandidate,
  ScoringAttempt,
  ScoringLearningGoal,
  ScoringTagMastery,
  ScoringTest,
} from './content-based-recommendation.engine';
import { CreateRecommendationEventDto } from './dto/create-recommendation-event.dto';
import { FindRecommendationsQueryDto } from './dto/find-recommendations-query.dto';

type PublishedTest = Prisma.TestGetPayload<{
  include: {
    category: true;
    questions: { include: { tags: true } };
    _count: { select: { questions: true; attempts: true; ratings: true } };
  };
}>;

type UserAttemptSummary = Prisma.AttemptGetPayload<{
  include: {
    test: { select: { id: true; categoryId: true; difficulty: true } };
  };
}>;

type PublishedScoringTest = PublishedTest & ScoringTest;

@Injectable()
export class RecommendationsService {
  private readonly engine = new ContentBasedRecommendationEngine();

  constructor(private readonly prisma: PrismaService) {}

  async findForUser(userId: string, query: FindRecommendationsQueryDto) {
    const limit = query.limit ?? 6;
    const placement = query.placement ?? 'catalog';

    const [tagMasteries, attempts, tests, learningGoals] =
      await this.prisma.$transaction([
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
            deletedAt: null,
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
        this.prisma.learningGoal.findMany({
          where: {
            userId,
            status: LearningGoalStatus.ACTIVE,
          },
          include: {
            goalTags: {
              select: {
                tagId: true,
              },
            },
          },
        }),
      ]);

    const scoringTests = tests.map((test) => this.toScoringTest(test));
    const scoringTagMasteries = tagMasteries.map((mastery) => ({
      attemptsCount: mastery.attemptsCount,
      correctCount: mastery.correctCount,
      wrongCount: mastery.wrongCount,
      masteryScore: mastery.masteryScore,
      tag: {
        id: mastery.tag.id,
        name: mastery.tag.name,
      },
    })) satisfies ScoringTagMastery[];
    const scoringAttempts = attempts.map((attempt) => ({
      testId: attempt.testId,
      score: attempt.score,
      maxScore: attempt.maxScore,
      isPassed: attempt.isPassed,
      test: {
        categoryId: attempt.test.categoryId,
        difficulty: attempt.test.difficulty,
      },
    })) satisfies ScoringAttempt[];
    const scoringLearningGoals = learningGoals.map((goal) => ({
      title: goal.title,
      categoryId: goal.categoryId,
      targetDifficulty: goal.targetDifficulty,
      tagIds: goal.goalTags.map((goalTag) => goalTag.tagId),
    })) satisfies ScoringLearningGoal[];

    const candidates = this.engine
      .scoreTests(
        scoringTests,
        scoringTagMasteries,
        scoringAttempts,
        scoringLearningGoals,
      )
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
        goalMatches: candidate.goalMatches,
        weaknessDetails: candidate.weaknessDetails,
        recommendationType: candidate.recommendationType,
        _count: candidate.test._count,
      })),
      meta: {
        placement,
        total: candidates.length,
      },
    };
  }

  async trackEvent(
    userId: string,
    createEventDto: CreateRecommendationEventDto,
  ) {
    const test = await this.prisma.test.findUnique({
      where: { id: createEventDto.testId },
      select: { id: true, deletedAt: true },
    });

    if (!test || test.deletedAt) {
      throw new NotFoundException(
        `Test with id "${createEventDto.testId}" was not found`,
      );
    }

    return this.prisma.recommendationEvent.create({
      data: {
        userId,
        testId: createEventDto.testId,
        placement: createEventDto.placement,
        eventType: createEventDto.eventType,
        metadata: {
          source: createEventDto.source,
          ...(createEventDto.metadata ?? {}),
        },
      },
    });
  }

  private toScoringTest(test: PublishedTest): PublishedScoringTest {
    const tagsById = new Map<string, { id: string; name: string }>();

    for (const question of test.questions) {
      for (const tag of question.tags) {
        tagsById.set(tag.id, { id: tag.id, name: tag.name });
      }
    }

    return {
      ...test,
      categoryName: test.category?.name,
      tags: [...tagsById.values()],
    };
  }

  private async saveSnapshot(
    userId: string,
    placement: string,
    candidates: RecommendationCandidate<PublishedScoringTest>[],
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
          goalMatches: candidate.goalMatches,
          weaknessDetails: candidate.weaknessDetails,
          recommendationType: candidate.recommendationType,
        })),
      },
    });
  }
}
