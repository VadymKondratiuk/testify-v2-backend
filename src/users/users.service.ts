import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const scrypt = promisify(scryptCallback);
const passwordKeyLength = 64;

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

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.ensureUserExists(id);

    const data: Prisma.UserUpdateInput = {
      email: updateUserDto.email,
      name: updateUserDto.name,
      role: updateUserDto.role,
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

  async remove(id: string) {
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
    const [salt, key] = storedPassword.split(':');

    if (!salt || !key) {
      return false;
    }

    const hashedBuffer = (await scrypt(
      plainPassword,
      salt,
      passwordKeyLength,
    )) as Buffer;
    const storedBuffer = Buffer.from(key, 'hex');

    return (
      storedBuffer.length === hashedBuffer.length &&
      timingSafeEqual(storedBuffer, hashedBuffer)
    );
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
    const salt = randomBytes(16).toString('hex');
    const hashedPassword = (await scrypt(
      password,
      salt,
      passwordKeyLength,
    )) as Buffer;

    return `${salt}:${hashedPassword.toString('hex')}`;
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
