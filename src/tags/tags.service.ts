import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FindTagsQueryDto } from './dto/find-tags-query.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindTagsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tag.findMany({
        where,
        orderBy: [{ questions: { _count: 'desc' } }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              questions: true,
            },
          },
        },
      }),
      this.prisma.tag.count({ where }),
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

  private buildWhere(query: FindTagsQueryDto): Prisma.TagWhereInput {
    return {
      ...(query.search
        ? {
            name: {
              contains: query.search.trim().toLowerCase(),
              mode: 'insensitive',
            },
          }
        : {}),
    };
  }
}
