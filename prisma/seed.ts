import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Difficulty,
  Prisma,
  PrismaClient,
  QuestionType,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const bcryptSaltRounds = 12;

type SeedTest = {
  title: string;
  description: string;
  difficulty: Difficulty;
  isPublished: boolean;
  passingScore: number;
  timeLimit: number;
  averageRating: number;
  ratingCount: number;
  authorEmail: string;
  categoryName: string;
  questions: Prisma.QuestionCreateWithoutTestInput[];
};

const users = [
  {
    email: 'admin@testify.com',
    password: 'password123',
    name: 'Admin User',
    role: Role.ADMIN,
  },
  {
    email: 'teacher1@testify.com',
    password: 'password123',
    name: 'Ivan Teacher',
    role: Role.TEACHER,
  },
  {
    email: 'teacher2@testify.com',
    password: 'password123',
    name: 'Maria Mentor',
    role: Role.TEACHER,
  },
  {
    email: 'student1@testify.com',
    password: 'password123',
    name: 'Oleh Student',
    role: Role.STUDENT,
  },
  {
    email: 'student2@testify.com',
    password: 'password123',
    name: 'Anna Student',
    role: Role.STUDENT,
  },
] satisfies Prisma.UserCreateManyInput[];

const categories = [
  {
    name: 'JavaScript',
    description: 'Core language syntax, runtime, and browser APIs.',
  },
  {
    name: 'React',
    description: 'Components, hooks, state, and rendering patterns.',
  },
  {
    name: 'NestJS',
    description:
      'Backend architecture with modules, services, and controllers.',
  },
  {
    name: 'Databases',
    description: 'SQL, schema design, relations, and query basics.',
  },
] satisfies Prisma.CategoryCreateManyInput[];

const tests: SeedTest[] = [
  {
    title: 'JavaScript Fundamentals',
    description: 'Variables, types, functions, arrays, and basic control flow.',
    difficulty: Difficulty.BEGINNER,
    isPublished: true,
    passingScore: 60,
    timeLimit: 10,
    averageRating: 4.5,
    ratingCount: 12,
    authorEmail: 'teacher1@testify.com',
    categoryName: 'JavaScript',
    questions: [
      {
        text: 'Which keyword declares a block-scoped variable?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        teacherInsight:
          'let and const are block-scoped; var is function-scoped.',
        tags: {
          connectOrCreate: [
            {
              where: { name: 'variables' },
              create: { name: 'variables' },
            },
            {
              where: { name: 'scope' },
              create: { name: 'scope' },
            },
          ],
        },
        options: {
          create: [
            { text: 'var', isCorrect: false },
            { text: 'let', isCorrect: true },
            { text: 'function', isCorrect: false },
            { text: 'import', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which array method creates a new array by transforming every item?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: {
          connectOrCreate: [
            {
              where: { name: 'arrays' },
              create: { name: 'arrays' },
            },
          ],
        },
        options: {
          create: [
            { text: 'map', isCorrect: true },
            { text: 'push', isCorrect: false },
            { text: 'forEach', isCorrect: false },
            { text: 'includes', isCorrect: false },
          ],
        },
      },
    ],
  },
  {
    title: 'Closures and this',
    description: 'Scope chains, lexical closures, and function context.',
    difficulty: Difficulty.ADVANCED,
    isPublished: true,
    passingScore: 80,
    timeLimit: 45,
    averageRating: 3.8,
    ratingCount: 7,
    authorEmail: 'teacher1@testify.com',
    categoryName: 'JavaScript',
    questions: [
      {
        text: 'What does a closure allow a function to access?',
        type: QuestionType.SINGLE_CHOICE,
        points: 2,
        tags: {
          connectOrCreate: [
            {
              where: { name: 'closures' },
              create: { name: 'closures' },
            },
          ],
        },
        options: {
          create: [
            { text: 'Only global variables', isCorrect: false },
            { text: 'Variables from its outer lexical scope', isCorrect: true },
            { text: 'Only variables passed as arguments', isCorrect: false },
            { text: 'Private class fields only', isCorrect: false },
          ],
        },
      },
      {
        text: 'Arrow functions have their own this binding.',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: {
          connectOrCreate: [
            {
              where: { name: 'this' },
              create: { name: 'this' },
            },
          ],
        },
        options: {
          create: [
            { text: 'True', isCorrect: false },
            { text: 'False', isCorrect: true },
          ],
        },
      },
    ],
  },
  {
    title: 'React Hooks Mastery',
    description: 'useState, useEffect, custom hooks, and dependency arrays.',
    difficulty: Difficulty.INTERMEDIATE,
    isPublished: true,
    passingScore: 70,
    timeLimit: 25,
    averageRating: 5,
    ratingCount: 18,
    authorEmail: 'teacher2@testify.com',
    categoryName: 'React',
    questions: [
      {
        text: 'Which hook is used for local component state?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: {
          connectOrCreate: [
            {
              where: { name: 'hooks' },
              create: { name: 'hooks' },
            },
            {
              where: { name: 'state' },
              create: { name: 'state' },
            },
          ],
        },
        options: {
          create: [
            { text: 'useEffect', isCorrect: false },
            { text: 'useMemo', isCorrect: false },
            { text: 'useState', isCorrect: true },
            { text: 'useRef', isCorrect: false },
          ],
        },
      },
      {
        text: 'What should be listed in a useEffect dependency array?',
        type: QuestionType.MULTIPLE_CHOICE,
        points: 2,
        teacherInsight:
          'Dependencies should include values from component scope used by the effect.',
        tags: {
          connectOrCreate: [
            {
              where: { name: 'effects' },
              create: { name: 'effects' },
            },
          ],
        },
        options: {
          create: [
            { text: 'Props read inside the effect', isCorrect: true },
            { text: 'State read inside the effect', isCorrect: true },
            { text: 'Unrelated constants from another file', isCorrect: false },
            { text: 'Nothing, always leave it empty', isCorrect: false },
          ],
        },
      },
    ],
  },
  {
    title: 'NestJS Architecture',
    description: 'Modules, controllers, providers, and dependency injection.',
    difficulty: Difficulty.ADVANCED,
    isPublished: false,
    passingScore: 85,
    timeLimit: 90,
    averageRating: 0,
    ratingCount: 0,
    authorEmail: 'teacher2@testify.com',
    categoryName: 'NestJS',
    questions: [
      {
        text: 'Which decorator marks a class as a Nest module?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: {
          connectOrCreate: [
            {
              where: { name: 'nestjs' },
              create: { name: 'nestjs' },
            },
            {
              where: { name: 'modules' },
              create: { name: 'modules' },
            },
          ],
        },
        options: {
          create: [
            { text: '@Controller()', isCorrect: false },
            { text: '@Module()', isCorrect: true },
            { text: '@Inject()', isCorrect: false },
            { text: '@Service()', isCorrect: false },
          ],
        },
      },
      {
        text: 'What does dependency injection help with in NestJS?',
        type: QuestionType.TEXT_ANSWER,
        points: 2,
        teacherInsight:
          'Expected answer: easier composition, testing, and swapping dependencies.',
        tags: {
          connectOrCreate: [
            {
              where: { name: 'dependency-injection' },
              create: { name: 'dependency-injection' },
            },
          ],
        },
      },
    ],
  },
];

async function clearDatabase() {
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

async function seedUsers() {
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

async function seedCategories() {
  await prisma.category.createMany({
    data: categories,
    skipDuplicates: true,
  });

  return prisma.category.findMany();
}

async function seedTests() {
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

async function main() {
  console.log('Seeding database...');

  await clearDatabase();
  const seededUsers = await seedUsers();
  const seededCategories = await seedCategories();
  await seedTests();

  const testCount = await prisma.test.count();
  const questionCount = await prisma.question.count();
  const optionCount = await prisma.option.count();

  console.log(`Users: ${seededUsers.length}`);
  console.log(`Categories: ${seededCategories.length}`);
  console.log(`Tests: ${testCount}`);
  console.log(`Questions: ${questionCount}`);
  console.log(`Options: ${optionCount}`);
  console.log('Seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
