import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TagAnswerResult = {
  tagId: string;
  isCorrect: boolean;
};

@Injectable()
export class UserKnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async updateTagMastery(
    userId: string,
    tagResults: TagAnswerResult[],
    tx?: Prisma.TransactionClient,
  ) {
    if (tagResults.length === 0) {
      return;
    }

    const prisma = tx ?? this.prisma;
    const statsByTag = this.buildTagStats(tagResults);

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
        },
      });

      const correctCount = (current?.correctCount ?? 0) + stats.correctCount;
      const wrongCount = (current?.wrongCount ?? 0) + stats.wrongCount;
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
    }
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

    return Math.round((correctCount / attemptsCount) * 10000) / 10000;
  }
}
