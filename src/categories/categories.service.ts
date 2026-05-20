import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { FindCategoriesQueryDto } from './dto/find-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: createCategoryDto,
        ...this.defaultCategoryArgs(),
      });
    } catch (error) {
      this.handleKnownRequestError(error);
      throw error;
    }
  }

  async findAll(query: FindCategoriesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        orderBy: {
          [query.sortBy ?? 'name']: query.sortOrder ?? 'asc',
        },
        skip: (page - 1) * limit,
        take: limit,
        ...this.defaultCategoryArgs(),
      }),
      this.prisma.category.count({ where }),
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
    const category = await this.prisma.category.findUnique({
      where: { id },
      ...this.defaultCategoryArgs(),
    });

    if (!category) {
      throw new NotFoundException(`Category with id "${id}" was not found`);
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    await this.ensureCategoryExists(id);

    try {
      return await this.prisma.category.update({
        where: { id },
        data: updateCategoryDto,
        ...this.defaultCategoryArgs(),
      });
    } catch (error) {
      this.handleKnownRequestError(error);
      throw error;
    }
  }

  async remove(id: string) {
    await this.ensureCategoryExists(id);

    const result = await this.prisma.$transaction(async (tx) => {
      const detachedTests = await tx.test.updateMany({
        where: { categoryId: id },
        data: {
          categoryId: null,
          isPublished: false,
        },
      });

      await tx.category.delete({
        where: { id },
      });

      return detachedTests;
    });

    return { id, detachedTestsCount: result.count };
  }

  private buildWhere(query: FindCategoriesQueryDto): Prisma.CategoryWhereInput {
    return {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
  }

  private defaultCategoryArgs() {
    return {
      include: {
        _count: {
          select: {
            tests: true,
          },
        },
      },
    } satisfies Prisma.CategoryDefaultArgs;
  }

  private async ensureCategoryExists(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException(`Category with id "${id}" was not found`);
    }
  }

  private handleKnownRequestError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Category with this name already exists');
    }
  }
}
