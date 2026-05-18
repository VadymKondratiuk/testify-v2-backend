import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
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

  async findMyDashboard(studentId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        email: true,
        attempts: {
          where: {
            completedAt: { not: null },
          },
          include: {
            test: {
              select: {
                categoryId: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${studentId}" was not found`);
    }

    const completedAttempts = user.attempts;
    const testsTaken = completedAttempts.length;
    const averageScore = this.average(
      completedAttempts.map((attempt) =>
        this.toPercentage(attempt.score, attempt.maxScore),
      ),
    );
    const masteredCategoryIds = new Set(
      completedAttempts
        .filter((attempt) => attempt.isPassed && attempt.test.categoryId)
        .map((attempt) => attempt.test.categoryId),
    );
    const totalTimeSpentSeconds = completedAttempts.reduce(
      (total, attempt) =>
        total + this.getTimeSpentSeconds(attempt.startedAt, attempt.completedAt),
      0,
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      stats: {
        testsTaken,
        averageScore,
        skillsMastered: masteredCategoryIds.size,
        hoursSpent: this.roundToTwo(totalTimeSpentSeconds / 3600),
        timeSpent:
          totalTimeSpentSeconds < 3600
            ? {
                value: this.roundToTwo(totalTimeSpentSeconds / 60),
                unit: 'minutes',
              }
            : {
                value: this.roundToTwo(totalTimeSpentSeconds / 3600),
                unit: 'hours',
              },
        totalTimeSpentSeconds,
      },
    };
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

  async changePassword(id: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" was not found`);
    }

    const isCurrentPasswordValid = await this.verifyPassword(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        password: await this.hashPassword(changePasswordDto.newPassword),
      },
      ...this.defaultUserArgs(),
    });
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

  private getTimeSpentSeconds(startedAt: Date, completedAt: Date | null) {
    if (!completedAt) {
      return 0;
    }

    return Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);
  }

  private roundToTwo(value: number) {
    return Math.round(value * 100) / 100;
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
