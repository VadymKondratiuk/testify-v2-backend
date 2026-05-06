import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const bcryptSaltRounds = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const password = await this.hashPassword(createUserDto.password);

    try {
      return await this.prisma.user.create({
        data: {
          ...createUserDto,
          password,
        },
        ...this.defaultUserArgs(),
      });
    } catch (error) {
      this.handleKnownRequestError(error);
      throw error;
    }
  }

  async findAll(query: FindUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(query);
    const orderBy = {
      [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
    } as Prisma.UserOrderByWithRelationInput;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        ...this.defaultUserArgs(),
      }),
      this.prisma.user.count({ where }),
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
    const user = await this.prisma.user.findUnique({
      where: { id },
      ...this.defaultUserArgs(),
    });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" was not found`);
    }

    return user;
  }

  async findByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: JwtPayload,
  ) {
    await this.ensureUserExists(id);

    if (updateUserDto.role && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can change user roles');
    }

    const data: Prisma.UserUpdateInput = {
      email: updateUserDto.email,
      name: updateUserDto.name,
      role: currentUser.role === Role.ADMIN ? updateUserDto.role : undefined,
      ...(updateUserDto.password
        ? { password: await this.hashPassword(updateUserDto.password) }
        : {}),
    };

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        ...this.defaultUserArgs(),
      });
    } catch (error) {
      this.handleKnownRequestError(error);
      throw error;
    }
  }

  async remove(id: string, currentUser: JwtPayload) {
    if (currentUser.sub === id) {
      throw new ForbiddenException('Admins cannot delete their own account');
    }

    await this.ensureUserExists(id);

    await this.prisma.user.delete({
      where: { id },
    });

    return { id };
  }

  async findUserTests(id: string) {
    await this.ensureUserExists(id);

    return this.prisma.test.findMany({
      where: { authorId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        _count: {
          select: {
            questions: true,
            attempts: true,
            ratings: true,
          },
        },
      },
    });
  }

  async findUserAttempts(id: string) {
    await this.ensureUserExists(id);

    return this.prisma.attempt.findMany({
      where: { userId: id },
      orderBy: { startedAt: 'desc' },
      include: {
        test: {
          select: {
            id: true,
            title: true,
            difficulty: true,
            passingScore: true,
          },
        },
        _count: {
          select: {
            userAnswers: true,
          },
        },
      },
    });
  }

  async findUserRatings(id: string) {
    await this.ensureUserExists(id);

    return this.prisma.rating.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        test: {
          select: {
            id: true,
            title: true,
            averageRating: true,
            ratingCount: true,
          },
        },
      },
    });
  }

  async verifyPassword(plainPassword: string, storedPassword: string) {
    return bcrypt.compare(plainPassword, storedPassword);
  }

  private buildWhere(query: FindUsersQueryDto): Prisma.UserWhereInput {
    return {
      role: query.role,
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private defaultUserArgs() {
    return {
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tests: true,
            attempts: true,
            ratings: true,
          },
        },
      },
    } satisfies Prisma.UserDefaultArgs;
  }

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" was not found`);
    }
  }

  private async hashPassword(password: string) {
    return bcrypt.hash(password, bcryptSaltRounds);
  }

  private handleKnownRequestError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('User with this email already exists');
    }
  }
}
