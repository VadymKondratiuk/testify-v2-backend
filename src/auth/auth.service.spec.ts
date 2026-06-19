import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  const createPrismaMock = () => ({
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  });

  const createJwtServiceMock = () => ({
    signAsync: jest.fn(),
  });

  const createUser = (overrides: Partial<User> = {}): User => ({
    id: 'user-1',
    email: 'student@example.com',
    password: 'hashed-password',
    hashedRt: null,
    name: 'Student',
    role: Role.STUDENT,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });

  let prisma: ReturnType<typeof createPrismaMock>;
  let jwtService: ReturnType<typeof createJwtServiceMock>;
  let service: AuthService;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'access-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';

    prisma = createPrismaMock();
    jwtService = createJwtServiceMock();
    service = new AuthService(prisma as never, jwtService as never);

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-value');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtService.signAsync.mockImplementation((_payload, options) =>
      Promise.resolve(
        options.expiresIn === '15m' ? 'access-token' : 'refresh-token',
      ),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registers a new user and stores only a hashed refresh token', async () => {
    const createdUser = createUser();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(createdUser);

    const tokens = await service.register({
      email: createdUser.email,
      name: createdUser.name,
      password: 'password123',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: createdUser.email,
        name: createdUser.name,
        password: 'hashed-value',
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: createdUser.id },
      data: { hashedRt: 'hashed-value' },
    });
    expect(tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('rejects registration when email is already used', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.register({
        email: 'student@example.com',
        name: 'Student',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('logs in a user with valid credentials and rotates refresh token hash', async () => {
    const user = createUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const tokens = await service.login({
      email: user.email,
      password: 'password123',
    });

    expect(bcrypt.compare).toHaveBeenCalledWith('password123', user.password);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { hashedRt: 'hashed-value' },
    });
    expect(tokens.accessToken).toBe('access-token');
    expect(tokens.refreshToken).toBe('refresh-token');
  });

  it('rejects login when password is invalid', async () => {
    prisma.user.findUnique.mockResolvedValue(createUser());
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'student@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('clears refresh token hash on logout', async () => {
    await expect(service.logout('user-1')).resolves.toEqual({ success: true });

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        hashedRt: {
          not: null,
        },
      },
      data: {
        hashedRt: null,
      },
    });
  });

  it('refreshes tokens only when refresh token matches stored hash', async () => {
    const user = createUser({ hashedRt: 'hashed-refresh-token' });
    prisma.user.findUnique.mockResolvedValue(user);

    const tokens = await service.refreshTokens('user-1', 'refresh-token');

    expect(bcrypt.compare).toHaveBeenCalledWith(
      'refresh-token',
      'hashed-refresh-token',
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { hashedRt: 'hashed-value' },
    });
    expect(tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('rejects refresh when stored refresh token hash is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(createUser({ hashedRt: null }));

    await expect(
      service.refreshTokens('user-1', 'refresh-token'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(bcrypt.compare).not.toHaveBeenCalled();
  });
});
