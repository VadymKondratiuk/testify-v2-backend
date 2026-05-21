import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TagAnswerResult = {
  tagId: string;
  isCorrect: boolean;
};

export type SkillProgressItem = {
  tagId: string;
  tag: string;
  attemptsCountBefore: number;
  attemptsCountAfter: number;
  correctCountBefore: number;
  correctCountAfter: number;
  wrongCountBefore: number;
  wrongCountAfter: number;
  masteryBefore: number;
  masteryAfter: number;
  masteryDelta: number;
  result: 'improved' | 'declined' | 'stable';
};

@Injectable()
export class UserKnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async updateTagMastery(
    userId: string,
    tagResults: TagAnswerResult[],
    tx?: Prisma.TransactionClient,
  ): Promise<SkillProgressItem[]> {
    if (tagResults.length === 0) {
      return [];
    }

    const prisma = tx ?? this.prisma;
    const statsByTag = this.buildTagStats(tagResults);
    const progress: SkillProgressItem[] = [];

    for (const [tagId, stats] of statsByTag) {
      const current = await prisma.userTagMastery.findUnique({
        where: {
          userId_tagId: {
            userId,
            tagId,
          },
        },
        select: {
          correctCount: true,
          wrongCount: true,
          tag: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      const tag =
        current?.tag ??
        (await prisma.tag.findUniqueOrThrow({
          where: { id: tagId },
          select: {
            id: true,
            name: true,
          },
        }));
      const correctCountBefore = current?.correctCount ?? 0;
      const wrongCountBefore = current?.wrongCount ?? 0;
      const attemptsCountBefore = correctCountBefore + wrongCountBefore;
      const masteryBefore = this.calculateMasteryScore(
        correctCountBefore,
        attemptsCountBefore,
      );

      const correctCount = correctCountBefore + stats.correctCount;
      const wrongCount = wrongCountBefore + stats.wrongCount;
      const attemptsCount = correctCount + wrongCount;
      const masteryScore = this.calculateMasteryScore(
        correctCount,
        attemptsCount,
      );

      await prisma.userTagMastery.upsert({
        where: {
          userId_tagId: {
            userId,
            tagId,
          },
        },
        create: {
          userId,
          tagId,
          correctCount,
          wrongCount,
          attemptsCount,
          masteryScore,
          lastSeenAt: new Date(),
        },
        update: {
          correctCount,
          wrongCount,
          attemptsCount,
          masteryScore,
          lastSeenAt: new Date(),
        },
      });

      const masteryDelta = this.roundToFour(masteryScore - masteryBefore);

      progress.push({
        tagId: tag.id,
        tag: tag.name,
        attemptsCountBefore,
        attemptsCountAfter: attemptsCount,
        correctCountBefore,
        correctCountAfter: correctCount,
        wrongCountBefore,
        wrongCountAfter: wrongCount,
        masteryBefore,
        masteryAfter: masteryScore,
        masteryDelta,
        result: this.getProgressResult(masteryDelta),
      });
    }

    return progress.sort((left, right) => {
      const absDeltaDiff =
        Math.abs(right.masteryDelta) - Math.abs(left.masteryDelta);

      if (absDeltaDiff !== 0) {
        return absDeltaDiff;
      }

      return left.tag.localeCompare(right.tag);
    });
  }

  private buildTagStats(tagResults: TagAnswerResult[]) {
    const statsByTag = new Map<
      string,
      { correctCount: number; wrongCount: number }
    >();

    for (const result of tagResults) {
      const stats = statsByTag.get(result.tagId) ?? {
        correctCount: 0,
        wrongCount: 0,
      };

      if (result.isCorrect) {
        stats.correctCount += 1;
      } else {
        stats.wrongCount += 1;
      }

      statsByTag.set(result.tagId, stats);
    }

    return statsByTag;
  }

  private calculateMasteryScore(correctCount: number, attemptsCount: number) {
    if (attemptsCount === 0) {
      return 0;
    }

    return this.roundToFour(correctCount / attemptsCount);
  }

  private roundToFour(value: number) {
    return Math.round(value * 10000) / 10000;
  }

  private getProgressResult(
    masteryDelta: number,
  ): SkillProgressItem['result'] {
    if (masteryDelta > 0) {
      return 'improved';
    }

    if (masteryDelta < 0) {
      return 'declined';
    }

    return 'stable';
  }
}
