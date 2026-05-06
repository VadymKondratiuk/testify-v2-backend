import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestionType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestDto } from './dto/create-test.dto';
import {
  DurationFilter,
  FindTestsQueryDto,
  QuestionCountFilter,
  RatingFilter,
  TestSortOption,
} from './dto/find-tests-query.dto';
import { FindMyTestsQueryDto } from './dto/find-my-tests-query.dto';
import { PublishTestDto } from './dto/publish-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';

@Injectable()
export class TestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTestDto: CreateTestDto, authorId: string) {
    await this.ensureTeacherCanCreateTests(authorId);
    await this.ensureCategoryExists(createTestDto.categoryId);

    return this.prisma.test.create({
      data: {
        ...createTestDto,
        authorId,
      },
      ...this.defaultTestArgs(),
    });
  }

  async findAll(query: FindTestsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = await this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.test.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        ...this.defaultTestArgs(),
      }),
      this.prisma.test.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        pageCount: Math.ceil(total / limit),
        filters: {
          search: query.search,
          categoryIds: this.resolveCategoryIds(query),
          difficulties: this.resolveDifficulties(query),
          durations: query.durations,
          questionCounts: query.questionCounts,
          rating: query.rating,
          sort: query.sort ?? TestSortOption.NEWEST_FIRST,
        },
      },
    };
  }

  async findMy(query: FindMyTestsQueryDto, teacherId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.TestWhereInput = {
      authorId: teacherId,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = {
      [query.sortBy ?? 'updatedAt']: query.sortOrder ?? 'desc',
    } satisfies Prisma.TestOrderByWithRelationInput;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.test.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              questions: true,
              attempts: true,
            },
          },
        },
      }),
      this.prisma.test.count({ where }),
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

  async findOne(id: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      ...this.defaultTestArgs(),
    });

    if (!test) {
      throw new NotFoundException(`Test with id "${id}" was not found`);
    }

    return test;
  }

  async findForTaking(id: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: {
        category: true,
        questions: {
          select: {
            id: true,
            text: true,
            type: true,
            points: true,
            tags: true,
            options: {
              select: {
                id: true,
                text: true,
                questionId: true,
              },
              orderBy: { text: 'asc' },
            },
          },
          orderBy: { text: 'asc' },
        },
      },
    });

    if (!test) {
      throw new NotFoundException(`Test with id "${id}" was not found`);
    }

    if (!test.isPublished) {
      throw new NotFoundException(`Test with id "${id}" was not found`);
    }

    return test;
  }

  async update(id: string, updateTestDto: UpdateTestDto, teacherId: string) {
    await this.ensureTeacherOwnsTest(id, teacherId);

    await this.ensureCategoryExists(updateTestDto.categoryId);

    return this.prisma.test.update({
      where: { id },
      data: updateTestDto,
      ...this.defaultTestArgs(),
    });
  }

  async publish(id: string, publishTestDto: PublishTestDto, teacherId: string) {
    await this.ensureTeacherOwnsTest(id, teacherId);

    if (publishTestDto.isPublished) {
      await this.ensureTestCanBePublished(id);
    }

    return this.prisma.test.update({
      where: { id },
      data: { isPublished: publishTestDto.isPublished },
      ...this.defaultTestArgs(),
    });
  }

  async remove(id: string, teacherId: string) {
    await this.ensureTeacherOwnsTest(id, teacherId);
    await this.ensureTestHasNoAttempts(id);

    await this.prisma.test.delete({
      where: { id },
    });

    return { id };
  }

  private async ensureTestHasNoAttempts(id: string) {
    const attemptsCount = await this.prisma.attempt.count({
      where: { testId: id },
    });

    if (attemptsCount > 0) {
      throw new BadRequestException(
        'Test cannot be deleted because it already has attempts',
      );
    }
  }

  private async buildWhere(
    query: FindTestsQueryDto,
  ): Promise<Prisma.TestWhereInput> {
    const categoryIds = this.resolveCategoryIds(query);
    const difficulties = this.resolveDifficulties(query);
    const questionCountIds = await this.findTestIdsByQuestionCount(
      query.questionCounts,
    );

    if (questionCountIds && questionCountIds.length === 0) {
      return { id: { in: [] } };
    }

    const and: Prisma.TestWhereInput[] = [];

    if (query.durations?.length) {
      and.push(this.buildDurationWhere(query.durations));
    }

    const ratingWhere = this.buildRatingWhere(query.rating);

    if (Object.keys(ratingWhere).length) {
      and.push(ratingWhere);
    }

    if (query.search) {
      and.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    return {
      authorId: query.authorId,
      categoryId: categoryIds.length ? { in: categoryIds } : undefined,
      difficulty: difficulties.length ? { in: difficulties } : undefined,
      isPublished: query.isPublished,
      ...(questionCountIds ? { id: { in: questionCountIds } } : {}),
      ...(and.length ? { AND: and } : {}),
    };
  }

  private buildDurationWhere(
    durations?: DurationFilter[],
  ): Prisma.TestWhereInput {
    if (!durations?.length) {
      return {};
    }

    return {
      OR: durations.map((duration) => {
        switch (duration) {
          case DurationFilter.UNDER_15:
            return { timeLimit: { lt: 15 } };
          case DurationFilter.FROM_15_TO_30:
            return { timeLimit: { gte: 15, lte: 30 } };
          case DurationFilter.FROM_31_TO_60:
            return { timeLimit: { gte: 31, lte: 60 } };
          case DurationFilter.OVER_60:
            return { timeLimit: { gt: 60 } };
        }
      }),
    };
  }

  private buildRatingWhere(rating?: RatingFilter): Prisma.TestWhereInput {
    switch (rating) {
      case RatingFilter.THREE_PLUS:
        return { averageRating: { gte: 3 } };
      case RatingFilter.FOUR_PLUS:
        return { averageRating: { gte: 4 } };
      case RatingFilter.FIVE:
        return { averageRating: { gte: 5 } };
      case RatingFilter.ANY:
      default:
        return {};
    }
  }

  private buildOrderBy(query: FindTestsQueryDto) {
    if (query.sortBy) {
      return [
        { [query.sortBy]: query.sortOrder ?? 'desc' },
      ] satisfies Prisma.TestOrderByWithRelationInput[];
    }

    switch (query.sort ?? TestSortOption.NEWEST_FIRST) {
      case TestSortOption.MOST_POPULAR:
        return [
          { ratingCount: 'desc' },
          { averageRating: 'desc' },
          { createdAt: 'desc' },
        ] satisfies Prisma.TestOrderByWithRelationInput[];
      case TestSortOption.HIGHEST_RATED:
        return [
          { averageRating: 'desc' },
          { ratingCount: 'desc' },
          { createdAt: 'desc' },
        ] satisfies Prisma.TestOrderByWithRelationInput[];
      case TestSortOption.SHORTEST_FIRST:
        return [
          { timeLimit: { sort: 'asc', nulls: 'last' } },
          { title: 'asc' },
        ] satisfies Prisma.TestOrderByWithRelationInput[];
      case TestSortOption.A_TO_Z:
        return [
          { title: 'asc' },
        ] satisfies Prisma.TestOrderByWithRelationInput[];
      case TestSortOption.NEWEST_FIRST:
      default:
        return [
          { createdAt: 'desc' },
        ] satisfies Prisma.TestOrderByWithRelationInput[];
    }
  }

  private resolveCategoryIds(query: FindTestsQueryDto) {
    return [
      ...(query.categoryIds ?? []),
      ...(query.categoryId ? [query.categoryId] : []),
    ];
  }

  private resolveDifficulties(query: FindTestsQueryDto) {
    return [
      ...(query.difficulties ?? []),
      ...(query.difficulty ? [query.difficulty] : []),
    ];
  }

  private async findTestIdsByQuestionCount(
    filters?: QuestionCountFilter[],
  ): Promise<string[] | undefined> {
    if (!filters?.length) {
      return undefined;
    }

    const havingParts = filters.map((filter) => {
      switch (filter) {
        case QuestionCountFilter.FROM_1_TO_10:
          return Prisma.sql`COUNT(q.id) BETWEEN 1 AND 10`;
        case QuestionCountFilter.FROM_11_TO_30:
          return Prisma.sql`COUNT(q.id) BETWEEN 11 AND 30`;
        case QuestionCountFilter.FROM_31_TO_50:
          return Prisma.sql`COUNT(q.id) BETWEEN 31 AND 50`;
        case QuestionCountFilter.OVER_50:
          return Prisma.sql`COUNT(q.id) > 50`;
      }
    });

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT t.id
      FROM "Test" t
      LEFT JOIN "Question" q ON q."testId" = t.id
      GROUP BY t.id
      HAVING ${Prisma.join(havingParts, ' OR ')}
    `;

    return rows.map((row) => row.id);
  }

  private defaultTestArgs() {
    return {
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        category: true,
        _count: {
          select: {
            questions: true,
            attempts: true,
            ratings: true,
          },
        },
      },
    } satisfies Prisma.TestDefaultArgs;
  }

  private async ensureTestExists(id: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!test) {
      throw new NotFoundException(`Test with id "${id}" was not found`);
    }
  }

  private async ensureTeacherOwnsTest(id: string, teacherId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!test) {
      throw new NotFoundException(`Test with id "${id}" was not found`);
    }

    if (test.authorId !== teacherId) {
      throw new ForbiddenException('You can manage only your own tests');
    }
  }

  private async ensureTestCanBePublished(id: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!test) {
      throw new NotFoundException(`Test with id "${id}" was not found`);
    }

    const validationErrors: string[] = [];

    if (test.passingScore < 0 || test.passingScore > 100) {
      validationErrors.push('passingScore must be between 0 and 100');
    }

    if (test.timeLimit !== null && test.timeLimit < 1) {
      validationErrors.push('timeLimit must be greater than 0');
    }

    if (test.questions.length === 0) {
      validationErrors.push('test must have at least one question');
    }

    for (const question of test.questions) {
      const label = `Question "${question.text}"`;

      if (question.text.trim().length === 0) {
        validationErrors.push('question text cannot be empty');
      }

      if (question.points < 1) {
        validationErrors.push(`${label} must have at least 1 point`);
      }

      if (question.type === QuestionType.TEXT_ANSWER) {
        if (question.options.length > 0) {
          validationErrors.push(`${label} cannot have options`);
        }

        continue;
      }

      if (question.options.length < 2) {
        validationErrors.push(`${label} must have at least two options`);
      }

      const correctOptionsCount = question.options.filter(
        (option) => option.isCorrect,
      ).length;

      if (question.type === QuestionType.SINGLE_CHOICE) {
        if (correctOptionsCount !== 1) {
          validationErrors.push(
            `${label} must have exactly one correct option`,
          );
        }
      }

      if (
        question.type === QuestionType.MULTIPLE_CHOICE &&
        correctOptionsCount < 1
      ) {
        validationErrors.push(`${label} must have at least one correct option`);
      }
    }

    if (validationErrors.length > 0) {
      throw new BadRequestException({
        message: 'Test cannot be published',
        errors: validationErrors,
      });
    }
  }

  private async ensureTeacherCanCreateTests(authorId: string) {
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, role: true },
    });

    if (!author) {
      throw new BadRequestException(
        `Author with id "${authorId}" was not found`,
      );
    }

    if (author.role !== Role.TEACHER) {
      throw new BadRequestException('Only teachers can create tests');
    }
  }

  private async ensureCategoryExists(categoryId?: string | null) {
    if (!categoryId) {
      return;
    }

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException(
        `Category with id "${categoryId}" was not found`,
      );
    }
  }
}
