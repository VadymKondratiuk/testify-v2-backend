import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { FindRatingsQueryDto } from './dto/find-ratings-query.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    testId: string,
    studentId: string,
    createRatingDto: CreateRatingDto,
  ) {
    await this.ensurePublishedTestExists(testId);
    await this.ensureStudentCompletedTest(testId, studentId);

    const existingRating = await this.prisma.rating.findUnique({
      where: {
        userId_testId: {
          userId: studentId,
          testId,
        },
      },
      select: { id: true },
    });

    if (existingRating) {
      throw new ConflictException('You have already rated this test');
    }

    return this.prisma.$transaction(async (tx) => {
      const rating = await tx.rating.create({
        data: {
          ...createRatingDto,
          userId: studentId,
          testId,
        },
        ...this.defaultRatingArgs(),
      });

      await this.recalculateTestRating(tx, testId);

      return rating;
    });
  }

  async findByTest(testId: string, query: FindRatingsQueryDto) {
    await this.ensureTestExists(testId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { testId } satisfies Prisma.RatingWhereInput;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.rating.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        ...this.defaultRatingArgs(),
      }),
      this.prisma.rating.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async findMy(studentId: string, query: FindRatingsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { userId: studentId } satisfies Prisma.RatingWhereInput;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.rating.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        ...this.defaultRatingArgs(),
      }),
      this.prisma.rating.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: JwtPayload) {
    const rating = await this.findExistingRating(id);

    if (user.role === Role.ADMIN || rating.userId === user.sub) {
      return rating;
    }

    throw new ForbiddenException('You cannot access this rating');
  }

  async update(
    id: string,
    studentId: string,
    updateRatingDto: UpdateRatingDto,
  ) {
    const rating = await this.findExistingRating(id);

    if (rating.userId !== studentId) {
      throw new ForbiddenException('You can update only your own ratings');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedRating = await tx.rating.update({
        where: { id },
        data: updateRatingDto,
        ...this.defaultRatingArgs(),
      });

      await this.recalculateTestRating(tx, rating.testId);

      return updatedRating;
    });
  }

  async remove(id: string, studentId: string) {
    const rating = await this.findExistingRating(id);

    if (rating.userId !== studentId) {
      throw new ForbiddenException('You can delete only your own ratings');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rating.delete({ where: { id } });
      await this.recalculateTestRating(tx, rating.testId);
    });

    return { id };
  }

  private async findExistingRating(id: string) {
    const rating = await this.prisma.rating.findUnique({
      where: { id },
      ...this.defaultRatingArgs(),
    });

    if (!rating) {
      throw new NotFoundException(`Rating with id "${id}" was not found`);
    }

    return rating;
  }

  private async ensureTestExists(testId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: { id: true },
    });

    if (!test) {
      throw new NotFoundException(`Test with id "${testId}" was not found`);
    }
  }

  private async ensurePublishedTestExists(testId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: {
        id: true,
        isPublished: true,
      },
    });

    if (!test || !test.isPublished) {
      throw new NotFoundException(`Test with id "${testId}" was not found`);
    }
  }

  private async ensureStudentCompletedTest(testId: string, studentId: string) {
    const completedAttempt = await this.prisma.attempt.findFirst({
      where: {
        testId,
        userId: studentId,
        completedAt: { not: null },
      },
      select: { id: true },
    });

    if (!completedAttempt) {
      throw new BadRequestException(
        'You can rate a test only after completing it',
      );
    }
  }

  private async recalculateTestRating(
    tx: Prisma.TransactionClient,
    testId: string,
  ) {
    const aggregate = await tx.rating.aggregate({
      where: { testId },
      _avg: { value: true },
      _count: { value: true },
    });

    await tx.test.update({
      where: { id: testId },
      data: {
        averageRating: aggregate._avg.value ?? 0,
        ratingCount: aggregate._count.value,
      },
    });
  }

  private defaultRatingArgs() {
    return {
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        test: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            averageRating: true,
            ratingCount: true,
          },
        },
      },
    } satisfies Prisma.RatingDefaultArgs;
  }
}
