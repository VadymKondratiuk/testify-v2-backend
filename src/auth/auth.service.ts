import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { Tokens } from './types/tokens.type';

const bcryptSaltRounds = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<Tokens> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const password = await this.hashData(registerDto.password);

    let user: User;

    try {
      user = await this.prisma.user.create({
        data: {
          email: registerDto.email,
          password,
          name: registerDto.name,
        },
      });
    } catch (error) {
      this.handleKnownRequestError(error);
    }

    const tokens = await this.getTokens(user);
    await this.updateRtHash(user.id, tokens.refreshToken);

    return tokens;
  }

  async login(loginDto: LoginDto): Promise<Tokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.getTokens(user);
    await this.updateRtHash(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string): Promise<{ success: true }> {
    await this.prisma.user.updateMany({
      where: {
        id: userId,
        hashedRt: {
          not: null,
        },
      },
      data: {
        hashedRt: null,
      },
    });

    return { success: true };
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<Tokens> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.hashedRt) {
      throw new ForbiddenException('Access denied');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.hashedRt,
    );

    if (!isRefreshTokenValid) {
      throw new ForbiddenException('Access denied');
    }

    const tokens = await this.getTokens(user);
    await this.updateRtHash(user.id, tokens.refreshToken);

    return tokens;
  }

  async hashData(data: string): Promise<string> {
    return bcrypt.hash(data, bcryptSaltRounds);
  }

  private async updateRtHash(userId: string, refreshToken: string) {
    // У БД ніколи не зберігаємо refresh token у відкритому вигляді.
    const hashedRt = await this.hashData(refreshToken);

    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRt },
    });
  }

  private async getTokens(
    user: Pick<User, 'id' | 'email' | 'role'>,
  ): Promise<Tokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessSecret = this.getRequiredEnv('JWT_ACCESS_SECRET');
    const refreshSecret = this.getRequiredEnv('JWT_REFRESH_SECRET');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
      throw new Error(`${name} is not defined`);
    }

    return value;
  }

  handleKnownRequestError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('User with this email already exists');
    }

    throw error;
  }
}
