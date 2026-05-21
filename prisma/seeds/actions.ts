import { Difficulty, Prisma, QuestionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { prisma } from './client';
import { categories, tests, users } from './data';

const bcryptSaltRounds = 12;

type DemoSkillProgressInput = {
  tagName: string;
  correctCountBefore: number;
  wrongCountBefore: number;
  correctCountAfter: number;
  wrongCountAfter: number;
};

type DemoAttemptTest = Prisma.TestGetPayload<{
  include: {
    questions: {
      include: {
        options: true;
        tags: true;
      };
    };
  };
}>;

export async function clearDatabase() {
  await prisma.recommendationEvent.deleteMany();
  await prisma.recommendationSnapshot.deleteMany();
  await prisma.learningGoalTag.deleteMany();
  await prisma.learningGoal.deleteMany();
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
    focusAreas: ['Knowledge retention', 'Next-level practice'],
    studyRecommendation:
      'Great result. Keep practicing JavaScript basics while moving toward more challenging topics.',
    skillProgress: [
      {
        tagName: 'variables',
        correctCountBefore: 3,
        wrongCountBefore: 0,
        correctCountAfter: 4,
        wrongCountAfter: 0,
      },
      {
        tagName: 'scope',
        correctCountBefore: 2,
        wrongCountBefore: 1,
        correctCountAfter: 3,
        wrongCountAfter: 1,
      },
      {
        tagName: 'arrays',
        correctCountBefore: 3,
        wrongCountBefore: 0,
        correctCountAfter: 4,
        wrongCountAfter: 0,
      },
    ],
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
    skillProgress: [
      {
        tagName: 'sql',
        correctCountBefore: 0,
        wrongCountBefore: 2,
        correctCountAfter: 1,
        wrongCountAfter: 4,
      },
      {
        tagName: 'grouping',
        correctCountBefore: 1,
        wrongCountBefore: 2,
        correctCountAfter: 1,
        wrongCountAfter: 3,
      },
      {
        tagName: 'joins',
        correctCountBefore: 1,
        wrongCountBefore: 2,
        correctCountAfter: 1,
        wrongCountAfter: 3,
      },
      {
        tagName: 'filtering',
        correctCountBefore: 1,
        wrongCountBefore: 1,
        correctCountAfter: 2,
        wrongCountAfter: 1,
      },
    ],
    answerStrategy: (question) =>
      !question.tags.some((tag) => ['joins', 'grouping'].includes(tag.name)),
  });

  await seedDemoTagMasteries(student.id);
  await seedDemoLearningGoals(student.id);
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
  skillProgress,
  answerStrategy,
}: {
  userId: string;
  test: DemoAttemptTest;
  score: number;
  maxScore: number;
  isPassed: boolean;
  completedDaysAgo: number;
  focusAreas: string[];
  studyRecommendation: string;
  skillProgress: DemoSkillProgressInput[];
  answerStrategy: (question: { tags: Array<{ name: string }> }) => boolean;
}) {
  const completedAt = new Date(
    Date.now() - completedDaysAgo * 24 * 60 * 60 * 1000,
  );
  const startedAt = new Date(completedAt.getTime() - 12 * 60 * 1000);
  const userAnswers: Prisma.UserAnswerCreateWithoutAttemptInput[] = [];
  const skillProgressSnapshot =
    await buildDemoSkillProgressSnapshot(skillProgress);

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
      skillProgress: skillProgressSnapshot as unknown as Prisma.InputJsonValue,
      studyRecommendation,
      userAnswers: {
        create: userAnswers,
      },
    },
  });
}

async function buildDemoSkillProgressSnapshot(
  progressItems: DemoSkillProgressInput[],
) {
  if (progressItems.length === 0) {
    return [];
  }

  const tags = await prisma.tag.findMany({
    where: {
      name: {
        in: progressItems.map((item) => item.tagName),
      },
    },
    select: {
      id: true,
      name: true,
    },
  });
  const tagsByName = new Map(tags.map((tag) => [tag.name, tag]));

  return progressItems.map((item) => {
    const tag = tagsByName.get(item.tagName);

    if (!tag) {
      throw new Error(`Demo skill progress tag was not found: ${item.tagName}`);
    }

    const attemptsCountBefore = item.correctCountBefore + item.wrongCountBefore;
    const attemptsCountAfter = item.correctCountAfter + item.wrongCountAfter;
    const masteryBefore = calculateMasteryScore(
      item.correctCountBefore,
      attemptsCountBefore,
    );
    const masteryAfter = calculateMasteryScore(
      item.correctCountAfter,
      attemptsCountAfter,
    );
    const masteryDelta = roundToFour(masteryAfter - masteryBefore);

    return {
      tagId: tag.id,
      tag: tag.name,
      attemptsCountBefore,
      attemptsCountAfter,
      correctCountBefore: item.correctCountBefore,
      correctCountAfter: item.correctCountAfter,
      wrongCountBefore: item.wrongCountBefore,
      wrongCountAfter: item.wrongCountAfter,
      masteryBefore,
      masteryAfter,
      masteryDelta,
      result: getProgressResult(masteryDelta),
    };
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
  await prisma.learningGoal.deleteMany({
    where: { userId },
  });
  await prisma.attempt.deleteMany({
    where: {
      userId,
      testId: { in: testIds },
    },
  });
}

async function seedDemoLearningGoals(userId: string) {
  const category = await prisma.category.findUnique({
    where: { name: 'Databases' },
  });
  const tags = await prisma.tag.findMany({
    where: {
      name: {
        in: ['sql', 'joins', 'grouping'],
      },
    },
  });

  if (!category) {
    throw new Error('Demo learning goal category was not found: Databases');
  }

  if (tags.length !== 3) {
    throw new Error('Demo learning goal tags were not found');
  }

  await prisma.learningGoal.create({
    data: {
      userId,
      title: 'Improve SQL querying',
      targetScore: 80,
      targetDifficulty: Difficulty.INTERMEDIATE,
      categoryId: category.id,
      goalTags: {
        createMany: {
          data: tags.map((tag) => ({
            tagId: tag.id,
          })),
        },
      },
    },
  });
}

async function seedDemoTagMasteries(userId: string) {
  const masteries = [
    { tagName: 'sql', attemptsCount: 5, correctCount: 1, wrongCount: 4 },
    { tagName: 'joins', attemptsCount: 4, correctCount: 1, wrongCount: 3 },
    { tagName: 'grouping', attemptsCount: 4, correctCount: 1, wrongCount: 3 },
    { tagName: 'filtering', attemptsCount: 3, correctCount: 2, wrongCount: 1 },
    { tagName: 'variables', attemptsCount: 4, correctCount: 4, wrongCount: 0 },
    { tagName: 'arrays', attemptsCount: 4, correctCount: 4, wrongCount: 0 },
    { tagName: 'scope', attemptsCount: 4, correctCount: 3, wrongCount: 1 },
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
        masteryScore: calculateMasteryScore(
          mastery.correctCount,
          mastery.attemptsCount,
        ),
        lastSeenAt: new Date(),
      },
    });
  }
}

async function seedDemoRecommendationSnapshots(userId: string) {
  const matchedTags = ['sql', 'joins', 'grouping'];
  const weaknessDetails = await getDemoWeaknessDetails(userId, matchedTags);
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
        reason:
          test.title === 'SQL Query Practice'
            ? 'Recommended because SQL, joins, and grouping are currently weak tags.'
            : 'Recommended as a lower-difficulty database review before another SQL attempt.',
        matchedTags,
        goalMatches: ['Improve SQL querying'],
        weaknessDetails,
        recommendationType: 'knowledge_gap',
      })),
    },
  });
}

async function getDemoWeaknessDetails(userId: string, tagNames: string[]) {
  const masteries = await prisma.userTagMastery.findMany({
    where: {
      userId,
      tag: {
        name: {
          in: tagNames,
        },
      },
    },
    include: {
      tag: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  const masteriesByTagName = new Map(
    masteries.map((mastery) => [mastery.tag.name, mastery]),
  );

  return tagNames.map((tagName) => {
    const mastery = masteriesByTagName.get(tagName);

    if (!mastery) {
      throw new Error(`Demo weakness tag mastery was not found: ${tagName}`);
    }

    return {
      tagId: mastery.tag.id,
      tag: mastery.tag.name,
      attemptsCount: mastery.attemptsCount,
      correctCount: mastery.correctCount,
      wrongCount: mastery.wrongCount,
      masteryScore: roundToFour(mastery.masteryScore),
      weaknessScore: roundToFour(1 - mastery.masteryScore),
    };
  });
}

function calculateMasteryScore(correctCount: number, attemptsCount: number) {
  if (attemptsCount === 0) {
    return 0;
  }

  return roundToFour(correctCount / attemptsCount);
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}

function getProgressResult(masterDelta: number) {
  if (masterDelta > 0) {
    return 'improved';
  }

  if (masterDelta < 0) {
    return 'declined';
  }

  return 'stable';
}
