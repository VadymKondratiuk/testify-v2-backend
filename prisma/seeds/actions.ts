import { Prisma, QuestionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { prisma } from './client';
import { categories, tests, users } from './data';

const bcryptSaltRounds = 12;

export async function clearDatabase() {
  await prisma.recommendationEvent.deleteMany();
  await prisma.recommendationSnapshot.deleteMany();
  await prisma.userTagMastery.deleteMany();
  await prisma.userAnswer.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.test.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

export async function seedUsers() {
  const usersWithHashedPasswords = await Promise.all(
    users.map(async (user) => ({
      ...user,
      password: await bcrypt.hash(user.password, bcryptSaltRounds),
    })),
  );

  await prisma.user.createMany({
    data: usersWithHashedPasswords,
    skipDuplicates: true,
  });

  return prisma.user.findMany();
}

export async function seedCategories() {
  await prisma.category.createMany({
    data: categories,
    skipDuplicates: true,
  });

  return prisma.category.findMany();
}

export async function seedTests() {
  const usersByEmail = new Map(
    (await prisma.user.findMany()).map((user) => [user.email, user]),
  );
  const categoriesByName = new Map(
    (await prisma.category.findMany()).map((category) => [
      category.name,
      category,
    ]),
  );

  for (const test of tests) {
    const author = usersByEmail.get(test.authorEmail);
    const category = categoriesByName.get(test.categoryName);

    if (!author) {
      throw new Error(`Seed author was not found: ${test.authorEmail}`);
    }

    if (!category) {
      throw new Error(`Seed category was not found: ${test.categoryName}`);
    }

    await prisma.test.deleteMany({
      where: {
        title: test.title,
        authorId: author.id,
      },
    });

    await prisma.test.create({
      data: {
        title: test.title,
        description: test.description,
        difficulty: test.difficulty,
        isPublished: test.isPublished,
        passingScore: test.passingScore,
        timeLimit: test.timeLimit,
        averageRating: test.averageRating,
        ratingCount: test.ratingCount,
        author: {
          connect: { id: author.id },
        },
        category: {
          connect: { id: category.id },
        },
        questions: {
          create: test.questions,
        },
      },
    });
  }
}

export async function seedDemoRecommendationData() {
  const student = await prisma.user.findUnique({
    where: { email: 'student1@testify.com' },
  });

  if (!student) {
    throw new Error('Demo student was not found');
  }

  const javaScriptFundamentals = await prisma.test.findFirst({
    where: { title: 'JavaScript Fundamentals' },
    include: {
      questions: {
        include: {
          options: true,
          tags: true,
        },
        orderBy: { text: 'asc' },
      },
    },
  });
  const sqlPractice = await prisma.test.findFirst({
    where: { title: 'SQL Query Practice' },
    include: {
      questions: {
        include: {
          options: true,
          tags: true,
        },
        orderBy: { text: 'asc' },
      },
    },
  });

  if (!javaScriptFundamentals || !sqlPractice) {
    throw new Error('Demo tests were not found');
  }

  await clearDemoRecommendationData(student.id, [
    javaScriptFundamentals.id,
    sqlPractice.id,
  ]);

  await createDemoAttempt({
    userId: student.id,
    test: javaScriptFundamentals,
    score: 2,
    maxScore: 2,
    isPassed: true,
    completedDaysAgo: 5,
    focusAreas: [],
    studyRecommendation:
      'Great result. Keep practicing JavaScript basics while moving toward more challenging topics.',
    answerStrategy: () => true,
  });

  await createDemoAttempt({
    userId: student.id,
    test: sqlPractice,
    score: 2,
    maxScore: 5,
    isPassed: false,
    completedDaysAgo: 2,
    focusAreas: ['sql', 'grouping', 'joins'],
    studyRecommendation:
      'Review SQL joins and grouped filtering before moving to advanced database tasks.',
    answerStrategy: (question) =>
      !question.tags.some((tag) => ['joins', 'grouping'].includes(tag.name)),
  });

  await seedDemoTagMasteries(student.id);
  await seedDemoRecommendationSnapshots(student.id);
}

async function createDemoAttempt({
  userId,
  test,
  score,
  maxScore,
  isPassed,
  completedDaysAgo,
  focusAreas,
  studyRecommendation,
  answerStrategy,
}: {
  userId: string;
  test: Prisma.TestGetPayload<{
    include: {
      questions: {
        include: {
          options: true;
          tags: true;
        };
      };
    };
  }>;
  score: number;
  maxScore: number;
  isPassed: boolean;
  completedDaysAgo: number;
  focusAreas: string[];
  studyRecommendation: string;
  answerStrategy: (question: {
    tags: Array<{ name: string }>;
  }) => boolean;
}) {
  const completedAt = new Date(Date.now() - completedDaysAgo * 24 * 60 * 60 * 1000);
  const startedAt = new Date(completedAt.getTime() - 12 * 60 * 1000);
  const userAnswers: Prisma.UserAnswerCreateWithoutAttemptInput[] = [];

  for (const question of test.questions) {
    const isCorrect = answerStrategy(question);

    if (question.type === QuestionType.TEXT_ANSWER) {
      userAnswers.push({
        question: {
          connect: { id: question.id },
        },
        isCorrect,
        earnedPoints: isCorrect ? question.points : 0,
        textAnswer: isCorrect
          ? 'Demo answer with the expected core idea.'
          : 'Needs more practice.',
      });
      continue;
    }

    const selectedOption =
      question.options.find((option) => option.isCorrect === isCorrect) ??
      question.options[0];

    if (!selectedOption) {
      continue;
    }

    userAnswers.push({
      question: {
        connect: { id: question.id },
      },
      option: {
        connect: { id: selectedOption.id },
      },
      isCorrect,
      earnedPoints: isCorrect ? question.points : 0,
    });
  }

  await prisma.attempt.create({
    data: {
      userId,
      testId: test.id,
      score,
      maxScore,
      passingScore: test.passingScore,
      isPassed,
      startedAt,
      completedAt,
      focusAreas,
      studyRecommendation,
      userAnswers: {
        create: userAnswers,
      },
    },
  });
}

async function clearDemoRecommendationData(userId: string, testIds: string[]) {
  await prisma.recommendationSnapshot.deleteMany({
    where: { userId },
  });
  await prisma.recommendationEvent.deleteMany({
    where: { userId },
  });
  await prisma.userTagMastery.deleteMany({
    where: { userId },
  });
  await prisma.attempt.deleteMany({
    where: {
      userId,
      testId: { in: testIds },
    },
  });
}

async function seedDemoTagMasteries(userId: string) {
  const masteries = [
    { tagName: 'sql', attemptsCount: 5, correctCount: 1, wrongCount: 4 },
    { tagName: 'joins', attemptsCount: 4, correctCount: 0, wrongCount: 4 },
    { tagName: 'grouping', attemptsCount: 4, correctCount: 1, wrongCount: 3 },
    { tagName: 'variables', attemptsCount: 4, correctCount: 4, wrongCount: 0 },
    { tagName: 'arrays', attemptsCount: 4, correctCount: 4, wrongCount: 0 },
  ];

  for (const mastery of masteries) {
    const tag = await prisma.tag.findUnique({
      where: { name: mastery.tagName },
    });

    if (!tag) {
      throw new Error(`Demo tag was not found: ${mastery.tagName}`);
    }

    await prisma.userTagMastery.create({
      data: {
        userId,
        tagId: tag.id,
        attemptsCount: mastery.attemptsCount,
        correctCount: mastery.correctCount,
        wrongCount: mastery.wrongCount,
        masteryScore: mastery.correctCount / mastery.attemptsCount,
        lastSeenAt: new Date(),
      },
    });
  }
}

async function seedDemoRecommendationSnapshots(userId: string) {
  const recommendedTests = await prisma.test.findMany({
    where: {
      title: {
        in: ['SQL Query Practice', 'Database Design Basics'],
      },
    },
    select: {
      id: true,
      title: true,
    },
  });

  await prisma.recommendationSnapshot.create({
    data: {
      userId,
      placement: 'catalog',
      testIds: recommendedTests.map((test) => test.id),
      payload: recommendedTests.map((test) => ({
        testId: test.id,
        title: test.title,
        reason: 'Seeded demo recommendation for weak database tags.',
        matchedTags: ['sql', 'joins', 'grouping'],
        recommendationType: 'knowledge_gap',
      })),
    },
  });
}
