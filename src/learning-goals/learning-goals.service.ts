import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Difficulty, LearningGoalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLearningGoalDto } from './dto/create-learning-goal.dto';
import { UpdateLearningGoalDto } from './dto/update-learning-goal.dto';

type LearningGoalWithRelations = Prisma.LearningGoalGetPayload<{
  include: {
    category: true;
    goalTags: {
      include: {
        tag: true;
      };
    };
  };
}>;

type ProgressAttempt = Prisma.AttemptGetPayload<{
  include: {
    test: {
      select: {
        categoryId: true;
        difficulty: true;
      };
    };
  };
}>;

@Injectable()
export class LearningGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: string) {
    const [goals, masteries, attempts] = await this.prisma.$transaction([
      this.prisma.learningGoal.findMany({
        where: {
          userId,
          status: {
            not: LearningGoalStatus.ARCHIVED,
          },
        },
        include: this.defaultInclude(),
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.userTagMastery.findMany({
        where: { userId },
        include: { tag: true },
      }),
      this.prisma.attempt.findMany({
        where: {
          userId,
          completedAt: { not: null },
        },
        include: {
          test: {
            select: {
              categoryId: true,
              difficulty: true,
            },
          },
        },
      }),
    ]);
    const masteriesByTagId = new Map(
      masteries.map((mastery) => [mastery.tagId, mastery]),
    );

    return {
      items: goals.map((goal) =>
        this.toResponse(goal, masteriesByTagId, attempts),
      ),
    };
  }

  async create(userId: string, createLearningGoalDto: CreateLearningGoalDto) {
    const tagIds = this.getUniqueTagIds(createLearningGoalDto.tagIds ?? []);

    if (
      !createLearningGoalDto.categoryId &&
      !createLearningGoalDto.targetDifficulty &&
      tagIds.length === 0
    ) {
      throw new BadRequestException(
        'Learning goal requires a category, difficulty, or at least one tag',
      );
    }

    const [category, tags] = await Promise.all([
      createLearningGoalDto.categoryId
        ? this.prisma.category.findUnique({
            where: { id: createLearningGoalDto.categoryId },
          })
        : null,
      tagIds.length > 0
        ? this.prisma.tag.findMany({
            where: {
              id: {
                in: tagIds,
              },
            },
          })
        : [],
    ]);

    if (createLearningGoalDto.categoryId && !category) {
      throw new NotFoundException('Learning goal category was not found');
    }

    if (tags.length !== tagIds.length) {
      throw new NotFoundException(
        'One or more learning goal tags were not found',
      );
    }

    const goal = await this.prisma.learningGoal.create({
      data: {
        userId,
        title:
          createLearningGoalDto.title ||
          this.buildGoalTitle(category?.name, createLearningGoalDto, tags),
        categoryId: createLearningGoalDto.categoryId,
        targetDifficulty: createLearningGoalDto.targetDifficulty,
        targetScore: createLearningGoalDto.targetScore ?? 80,
        deadline: createLearningGoalDto.deadline
          ? new Date(createLearningGoalDto.deadline)
          : undefined,
        goalTags: {
          createMany: {
            data: tagIds.map((tagId) => ({ tagId })),
          },
        },
      },
      include: this.defaultInclude(),
    });

    return this.hydrateGoal(userId, goal);
  }

  async update(
    userId: string,
    goalId: string,
    updateLearningGoalDto: UpdateLearningGoalDto,
  ) {
    await this.ensureGoalOwner(userId, goalId);

    const tagIds = updateLearningGoalDto.tagIds
      ? this.getUniqueTagIds(updateLearningGoalDto.tagIds)
      : undefined;

    if (updateLearningGoalDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateLearningGoalDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Learning goal category was not found');
      }
    }

    if (tagIds) {
      const tags = await this.prisma.tag.findMany({
        where: {
          id: {
            in: tagIds,
          },
        },
      });

      if (tags.length !== tagIds.length) {
        throw new NotFoundException(
          'One or more learning goal tags were not found',
        );
      }
    }

    const goal = await this.prisma.$transaction(async (tx) => {
      if (tagIds) {
        await tx.learningGoalTag.deleteMany({
          where: { goalId },
        });

        if (tagIds.length > 0) {
          await tx.learningGoalTag.createMany({
            data: tagIds.map((tagId) => ({
              goalId,
              tagId,
            })),
          });
        }
      }

      return tx.learningGoal.update({
        where: { id: goalId },
        data: {
          title: updateLearningGoalDto.title,
          categoryId: updateLearningGoalDto.categoryId,
          targetDifficulty: updateLearningGoalDto.targetDifficulty,
          targetScore: updateLearningGoalDto.targetScore,
          deadline: updateLearningGoalDto.deadline
            ? new Date(updateLearningGoalDto.deadline)
            : undefined,
          status: updateLearningGoalDto.status,
        },
        include: this.defaultInclude(),
      });
    });

    return this.hydrateGoal(userId, goal);
  }

  async archive(userId: string, goalId: string) {
    await this.ensureGoalOwner(userId, goalId);

    return this.update(userId, goalId, {
      status: LearningGoalStatus.ARCHIVED,
    });
  }

  private async hydrateGoal(userId: string, goal: LearningGoalWithRelations) {
    const [masteries, attempts] = await Promise.all([
      this.prisma.userTagMastery.findMany({
        where: { userId },
        include: { tag: true },
      }),
      this.prisma.attempt.findMany({
        where: {
          userId,
          completedAt: { not: null },
        },
        include: {
          test: {
            select: {
              categoryId: true,
              difficulty: true,
            },
          },
        },
      }),
    ]);
    const masteriesByTagId = new Map(
      masteries.map((mastery) => [mastery.tagId, mastery]),
    );

    return this.toResponse(goal, masteriesByTagId, attempts);
  }

  private async ensureGoalOwner(userId: string, goalId: string) {
    const goal = await this.prisma.learningGoal.findFirst({
      where: {
        id: goalId,
        userId,
      },
      select: { id: true },
    });

    if (!goal) {
      throw new NotFoundException(
        `Learning goal with id "${goalId}" was not found`,
      );
    }
  }

  private toResponse(
    goal: LearningGoalWithRelations,
    masteriesByTagId: Map<
      string,
      {
        masteryScore: number;
      }
    >,
    attempts: ProgressAttempt[],
  ) {
    const tagIds = goal.goalTags.map((goalTag) => goalTag.tagId);
    const tagScore =
      tagIds.length === 0
        ? null
        : this.average(
            tagIds.map(
              (tagId) => masteriesByTagId.get(tagId)?.masteryScore ?? 0,
            ),
          ) * 100;
    const matchingAttempts = attempts.filter((attempt) =>
      this.doesAttemptMatchGoal(attempt, goal),
    );
    const attemptScore =
      matchingAttempts.length === 0
        ? null
        : this.average(
            matchingAttempts.map((attempt) =>
              this.toPercentage(attempt.score, attempt.maxScore),
            ),
          );
    const currentScore = this.roundToTwo(
      tagScore !== null && attemptScore !== null
        ? tagScore * 0.65 + attemptScore * 0.35
        : (tagScore ?? attemptScore ?? 0),
    );
    const progressPercentage =
      goal.targetScore === 0
        ? 0
        : Math.min(100, Math.round((currentScore / goal.targetScore) * 100));

    return {
      id: goal.id,
      title: goal.title,
      targetScore: goal.targetScore,
      targetDifficulty: goal.targetDifficulty,
      deadline: goal.deadline,
      status: goal.status,
      currentScore,
      progressPercentage,
      completedTests: matchingAttempts.length,
      category: goal.category
        ? {
            id: goal.category.id,
            name: goal.category.name,
          }
        : null,
      tags: goal.goalTags.map((goalTag) => ({
        id: goalTag.tag.id,
        name: goalTag.tag.name,
      })),
      recommendationHint: this.buildRecommendationHint(
        goal,
        progressPercentage,
      ),
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
  }

  private doesAttemptMatchGoal(
    attempt: ProgressAttempt,
    goal: LearningGoalWithRelations,
  ) {
    if (goal.categoryId && attempt.test.categoryId !== goal.categoryId) {
      return false;
    }

    if (
      goal.targetDifficulty &&
      attempt.test.difficulty !== goal.targetDifficulty
    ) {
      return false;
    }

    return Boolean(goal.categoryId || goal.targetDifficulty);
  }

  private buildGoalTitle(
    categoryName: string | undefined,
    dto: CreateLearningGoalDto,
    tags: Array<{ name: string }>,
  ) {
    if (tags.length > 0) {
      return `Improve ${tags
        .slice(0, 2)
        .map((tag) => tag.name)
        .join(', ')}`;
    }

    if (categoryName && dto.targetDifficulty) {
      return `${this.toTitleCase(dto.targetDifficulty)} ${categoryName}`;
    }

    if (categoryName) {
      return `Improve ${categoryName}`;
    }

    if (dto.targetDifficulty) {
      return `${this.toTitleCase(dto.targetDifficulty)} practice`;
    }

    return 'Learning goal';
  }

  private buildRecommendationHint(
    goal: LearningGoalWithRelations,
    progressPercentage: number,
  ) {
    if (goal.status === LearningGoalStatus.COMPLETED) {
      return 'Goal completed. Keep this skill warm with occasional review.';
    }

    if (progressPercentage >= 100) {
      return 'You are ready to mark this goal as completed.';
    }

    if (progressPercentage >= 70) {
      return 'Close to target. Prioritize one more focused test.';
    }

    return 'Recommendations will prioritize tests that match this goal.';
  }

  private getUniqueTagIds(tagIds: string[]) {
    return [...new Set(tagIds.filter(Boolean))];
  }

  private average(values: number[]) {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  private toPercentage(value: number, total: number) {
    if (total === 0) {
      return 0;
    }

    return (value / total) * 100;
  }

  private roundToTwo(value: number) {
    return Math.round(value * 100) / 100;
  }

  private toTitleCase(difficulty: Difficulty) {
    return difficulty.charAt(0) + difficulty.slice(1).toLowerCase();
  }

  private defaultInclude() {
    return {
      category: true,
      goalTags: {
        include: {
          tag: true,
        },
      },
    } satisfies Prisma.LearningGoalInclude;
  }
}
