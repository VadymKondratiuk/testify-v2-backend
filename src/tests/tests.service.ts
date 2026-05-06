import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestDto } from './dto/create-test.dto';
import { FindTestsQueryDto } from './dto/find-tests-query.dto';
import { PublishTestDto } from './dto/publish-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';

@Injectable()
export class TestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTestDto: CreateTestDto) {
    await this.ensureAuthorCanCreateTests(createTestDto.authorId);
    await this.ensureCategoryExists(createTestDto.categoryId);

    return this.prisma.test.create({
      data: createTestDto,
      ...this.defaultTestArgs(),
    });
  }

  async findAll(query: FindTestsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(query);
    const orderBy = {
      [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
    } as Prisma.TestOrderByWithRelationInput;

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

  async update(id: string, updateTestDto: UpdateTestDto) {
    await this.ensureTestExists(id);

    if (updateTestDto.authorId) {
      await this.ensureAuthorCanCreateTests(updateTestDto.authorId);
    }

    await this.ensureCategoryExists(updateTestDto.categoryId);

    return this.prisma.test.update({
      where: { id },
      data: updateTestDto,
      ...this.defaultTestArgs(),
    });
  }

  async publish(id: string, publishTestDto: PublishTestDto) {
    await this.ensureTestExists(id);

    return this.prisma.test.update({
      where: { id },
      data: { isPublished: publishTestDto.isPublished },
      ...this.defaultTestArgs(),
    });
  }

  async remove(id: string) {
    await this.ensureTestExists(id);

    await this.prisma.test.delete({
      where: { id },
    });

    return { id };
  }

  private buildWhere(query: FindTestsQueryDto): Prisma.TestWhereInput {
    return {
      authorId: query.authorId,
      categoryId: query.categoryId,
      difficulty: query.difficulty,
      isPublished: query.isPublished,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
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

  private async ensureAuthorCanCreateTests(authorId: string) {
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, role: true },
    });

    if (!author) {
      throw new BadRequestException(`Author with id "${authorId}" was not found`);
    }

    if (author.role === Role.STUDENT) {
      throw new BadRequestException('Only teachers and admins can create tests');
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
