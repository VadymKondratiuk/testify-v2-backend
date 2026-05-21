import { UserKnowledgeService } from './user-knowledge.service';

describe('UserKnowledgeService', () => {
  const createPrismaMock = () => ({
    userTagMastery: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    tag: {
      findUniqueOrThrow: jest.fn(),
    },
  });

  let prisma: ReturnType<typeof createPrismaMock>;
  let service: UserKnowledgeService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UserKnowledgeService(prisma as never);
  });

  it('stores a progress snapshot for an existing tag mastery', async () => {
    prisma.userTagMastery.findUnique.mockResolvedValue({
      correctCount: 2,
      wrongCount: 2,
      tag: {
        id: 'tag-oop',
        name: 'oop',
      },
    });

    const progress = await service.updateTagMastery(
      'user-1',
      [{ tagId: 'tag-oop', isCorrect: false }],
      prisma as never,
    );

    expect(prisma.userTagMastery.upsert).toHaveBeenCalledWith({
      where: {
        userId_tagId: {
          userId: 'user-1',
          tagId: 'tag-oop',
        },
      },
      create: {
        userId: 'user-1',
        tagId: 'tag-oop',
        correctCount: 2,
        wrongCount: 3,
        attemptsCount: 5,
        masteryScore: 0.4,
        lastSeenAt: expect.any(Date),
      },
      update: {
        correctCount: 2,
        wrongCount: 3,
        attemptsCount: 5,
        masteryScore: 0.4,
        lastSeenAt: expect.any(Date),
      },
    });
    expect(progress).toEqual([
      {
        tagId: 'tag-oop',
        tag: 'oop',
        attemptsCountBefore: 4,
        attemptsCountAfter: 5,
        correctCountBefore: 2,
        correctCountAfter: 2,
        wrongCountBefore: 2,
        wrongCountAfter: 3,
        masteryBefore: 0.5,
        masteryAfter: 0.4,
        masteryDelta: -0.1,
        result: 'declined',
      },
    ]);
  });

  it('creates a progress snapshot for a new tag mastery', async () => {
    prisma.userTagMastery.findUnique.mockResolvedValue(null);
    prisma.tag.findUniqueOrThrow.mockResolvedValue({
      id: 'tag-sql',
      name: 'sql',
    });

    const progress = await service.updateTagMastery(
      'user-1',
      [
        { tagId: 'tag-sql', isCorrect: true },
        { tagId: 'tag-sql', isCorrect: true },
        { tagId: 'tag-sql', isCorrect: false },
      ],
      prisma as never,
    );

    expect(prisma.tag.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'tag-sql' },
      select: {
        id: true,
        name: true,
      },
    });
    expect(progress).toEqual([
      {
        tagId: 'tag-sql',
        tag: 'sql',
        attemptsCountBefore: 0,
        attemptsCountAfter: 3,
        correctCountBefore: 0,
        correctCountAfter: 2,
        wrongCountBefore: 0,
        wrongCountAfter: 1,
        masteryBefore: 0,
        masteryAfter: 0.6667,
        masteryDelta: 0.6667,
        result: 'improved',
      },
    ]);
  });

  it('does not touch storage when there are no tag results', async () => {
    const progress = await service.updateTagMastery('user-1', [], prisma as never);

    expect(progress).toEqual([]);
    expect(prisma.userTagMastery.findUnique).not.toHaveBeenCalled();
    expect(prisma.userTagMastery.upsert).not.toHaveBeenCalled();
  });
});
