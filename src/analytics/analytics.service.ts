import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { FindAnalyticsAttemptsQueryDto } from './dto/find-analytics-attempts-query.dto';

type ScoreBucket = '0-20' | '21-40' | '41-60' | '61-80' | '81-100';

const scoreBuckets: ScoreBucket[] = [
  '0-20',
  '21-40',
  '41-60',
  '61-80',
  '81-100',
];

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(testId: string, user: JwtPayload) {
    await this.ensureCanAccessTest(testId, user);

    const test = await this.prisma.test.findUniqueOrThrow({
      where: { id: testId },
      include: {
        questions: {
          include: {
            options: true,
          },
          orderBy: { text: 'asc' },
        },
        attempts: {
          where: {
            completedAt: { not: null },
          },
          include: {
            userAnswers: {
              select: {
                attemptId: true,
                questionId: true,
                optionId: true,
                isCorrect: true,
              },
            },
          },
        },
      },
    });

    const completedAttempts = test.attempts;
    const totalAttempts = completedAttempts.length;
    const scorePercentages = completedAttempts.map((attempt) =>
      this.toPercentage(attempt.score, attempt.maxScore),
    );
    const averageScore = this.average(scorePercentages);
    const completionRate = this.toPercentage(
      completedAttempts.filter((attempt) => attempt.isPassed).length,
      totalAttempts,
    );
    const averageTimeSpent = this.average(
      completedAttempts.map((attempt) =>
        this.getTimeSpentMinutes(attempt.startedAt, attempt.completedAt),
      ),
    );
    const scoreDistribution = this.buildScoreDistribution(scorePercentages);
    const toughestQuestions = this.buildToughestQuestions(
      test.questions,
      completedAttempts,
    );

    return {
      test: {
        id: test.id,
        title: test.title,
      },
      totalAttempts,
      averageScore,
      completionRate,
      averageTimeSpent,
      scoreDistribution,
      toughestQuestions,
    };
  }

  async getAttempts(
    testId: string,
    query: FindAnalyticsAttemptsQueryDto,
    user: JwtPayload,
  ) {
    await this.ensureCanAccessTest(testId, user);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildCompletedAttemptsWhere(testId, query.search);

    const [attempts, total] = await this.prisma.$transaction([
      this.prisma.attempt.findMany({
        where,
        orderBy: { completedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.attempt.count({ where }),
    ]);

    return {
      items: attempts.map((attempt) => ({
        id: attempt.id,
        student: attempt.user,
        score: attempt.score,
        maxScore: attempt.maxScore,
        scorePercentage: this.toPercentage(attempt.score, attempt.maxScore),
        isPassed: attempt.isPassed,
        timeSpent: {
          minutes: this.getTimeSpentMinutes(
            attempt.startedAt,
            attempt.completedAt,
          ),
          seconds: this.getTimeSpentSeconds(
            attempt.startedAt,
            attempt.completedAt,
          ),
        },
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
      })),
      meta: {
        total,
        page,
        limit,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async getQuestions(testId: string, user: JwtPayload) {
    await this.ensureCanAccessTest(testId, user);

    const test = await this.prisma.test.findUniqueOrThrow({
      where: { id: testId },
      include: {
        questions: {
          include: {
            options: {
              orderBy: { text: 'asc' },
            },
          },
          orderBy: { text: 'asc' },
        },
        attempts: {
          where: {
            completedAt: { not: null },
          },
          include: {
            userAnswers: {
              select: {
                attemptId: true,
                questionId: true,
                optionId: true,
                isCorrect: true,
              },
            },
          },
        },
      },
    });

    const answerStatsByQuestion = this.buildQuestionAnswerStats(test.attempts);

    return {
      test: {
        id: test.id,
        title: test.title,
      },
      items: test.questions.map((question) => {
        const questionStats = answerStatsByQuestion.get(question.id);
        const totalAnswers = questionStats?.answeredAttemptIds.size ?? 0;

        return {
          id: question.id,
          text: question.text,
          type: question.type,
          points: question.points,
          totalAnswers,
          options: question.options.map((option) => {
            const selectedCount =
              questionStats?.optionSelectionCounts.get(option.id) ?? 0;

            return {
              id: option.id,
              text: option.text,
              isCorrect: option.isCorrect,
              selectedCount,
              selectionPercentage: this.toPercentage(
                selectedCount,
                totalAnswers,
              ),
            };
          }),
        };
      }),
    };
  }

  private async ensureCanAccessTest(testId: string, user: JwtPayload) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!test) {
      throw new NotFoundException(`Test with id "${testId}" was not found`);
    }

    if (user.role === Role.TEACHER && test.authorId !== user.sub) {
      throw new ForbiddenException(
        'You can view analytics only for your own tests',
      );
    }
  }

  private buildCompletedAttemptsWhere(testId: string, search?: string) {
    return {
      testId,
      completedAt: { not: null },
      ...(search
        ? {
            user: {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    } satisfies Prisma.AttemptWhereInput;
  }

  private buildScoreDistribution(scorePercentages: number[]) {
    const distribution = scoreBuckets.reduce(
      (result, bucket) => ({ ...result, [bucket]: 0 }),
      {} as Record<ScoreBucket, number>,
    );

    for (const scorePercentage of scorePercentages) {
      distribution[this.getScoreBucket(scorePercentage)] += 1;
    }

    return distribution;
  }

  private getScoreBucket(scorePercentage: number): ScoreBucket {
    if (scorePercentage <= 20) {
      return '0-20';
    }

    if (scorePercentage <= 40) {
      return '21-40';
    }

    if (scorePercentage <= 60) {
      return '41-60';
    }

    if (scorePercentage <= 80) {
      return '61-80';
    }

    return '81-100';
  }

  private buildToughestQuestions(
    questions: Array<{ id: string; text: string }>,
    attempts: Array<{
      id: string;
      userAnswers: Array<{
        questionId: string;
        isCorrect: boolean;
      }>;
    }>,
  ) {
    const answerStatsByQuestion = this.buildQuestionAnswerStats(attempts);
    const totalAttempts = attempts.length;

    return questions
      .map((question) => {
        const stats = answerStatsByQuestion.get(question.id);
        const correctAttempts = stats?.correctAttemptIds.size ?? 0;

        return {
          id: question.id,
          text: question.text,
          totalAttempts,
          answeredAttempts: stats?.answeredAttemptIds.size ?? 0,
          correctAttempts,
          correctPercentage: this.toPercentage(correctAttempts, totalAttempts),
        };
      })
      .sort((a, b) => a.correctPercentage - b.correctPercentage)
      .slice(0, 5);
  }

  private buildQuestionAnswerStats(
    attempts: Array<{
      id: string;
      userAnswers: Array<{
        attemptId?: string;
        questionId: string;
        optionId?: string | null;
        isCorrect: boolean;
      }>;
    }>,
  ) {
    const statsByQuestion = new Map<
      string,
      {
        answeredAttemptIds: Set<string>;
        correctAttemptIds: Set<string>;
        optionSelectionCounts: Map<string, number>;
      }
    >();

    for (const attempt of attempts) {
      for (const answer of attempt.userAnswers) {
        const stats = this.getOrCreateQuestionStats(
          statsByQuestion,
          answer.questionId,
        );

        stats.answeredAttemptIds.add(attempt.id);

        if (answer.isCorrect) {
          stats.correctAttemptIds.add(attempt.id);
        }

        if (answer.optionId) {
          stats.optionSelectionCounts.set(
            answer.optionId,
            (stats.optionSelectionCounts.get(answer.optionId) ?? 0) + 1,
          );
        }
      }
    }

    return statsByQuestion;
  }

  private getOrCreateQuestionStats(
    statsByQuestion: Map<
      string,
      {
        answeredAttemptIds: Set<string>;
        correctAttemptIds: Set<string>;
        optionSelectionCounts: Map<string, number>;
      }
    >,
    questionId: string,
  ) {
    const existingStats = statsByQuestion.get(questionId);

    if (existingStats) {
      return existingStats;
    }

    const stats = {
      answeredAttemptIds: new Set<string>(),
      correctAttemptIds: new Set<string>(),
      optionSelectionCounts: new Map<string, number>(),
    };

    statsByQuestion.set(questionId, stats);

    return stats;
  }

  private getTimeSpentMinutes(startedAt: Date, completedAt: Date | null) {
    if (!completedAt) {
      return 0;
    }

    return this.roundToTwo(
      (completedAt.getTime() - startedAt.getTime()) / 1000 / 60,
    );
  }

  private getTimeSpentSeconds(startedAt: Date, completedAt: Date | null) {
    if (!completedAt) {
      return 0;
    }

    return Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);
  }

  private average(values: number[]) {
    if (values.length === 0) {
      return 0;
    }

    return this.roundToTwo(
      values.reduce((total, value) => total + value, 0) / values.length,
    );
  }

  private toPercentage(value: number, total: number) {
    if (total === 0) {
      return 0;
    }

    return this.roundToTwo((value / total) * 100);
  }

  private roundToTwo(value: number) {
    return Math.round(value * 100) / 100;
  }
}
