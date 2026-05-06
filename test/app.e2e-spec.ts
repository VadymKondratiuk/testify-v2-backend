import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Difficulty, QuestionType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Testify API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const runId = `e2e-${Date.now()}`;
  const password = 'password123';

  const users = {
    admin: {
      email: `admin-${runId}@e2e.test`,
      name: 'E2E Admin',
      role: Role.ADMIN,
    },
    teacher: {
      email: `teacher-${runId}@e2e.test`,
      name: 'E2E Teacher',
      role: Role.TEACHER,
    },
    student: {
      email: `student-${runId}@e2e.test`,
      name: 'E2E Student',
      role: Role.STUDENT,
    },
  };

  let adminAccessToken: string;
  let teacherAccessToken: string;
  let studentAccessToken: string;
  let categoryId: string;
  let testId: string;
  let singleQuestionId: string;
  let multipleQuestionId: string;
  let correctSingleOptionId: string;
  let correctMultipleOptionIds: string[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await seedUsers();

    adminAccessToken = await login(users.admin.email);
    teacherAccessToken = await login(users.teacher.email);
    studentAccessToken = await login(users.student.email);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('allows admin to create a category and teacher to publish a valid test', async () => {
    const categoryResponse = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: `E2E Category ${runId}`,
        description: 'Category created by e2e tests',
      })
      .expect(201);

    categoryId = categoryResponse.body.id;

    const testResponse = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .send({
        title: `E2E Test ${runId}`,
        description: 'Test created by e2e tests',
        difficulty: Difficulty.BEGINNER,
        passingScore: 60,
        timeLimit: 15,
        categoryId,
      })
      .expect(201);

    testId = testResponse.body.id;
    expect(testResponse.body.author.email).toBe(users.teacher.email);

    const singleQuestionResponse = await request(app.getHttpServer())
      .post('/questions')
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .send({
        testId,
        text: 'Which option is correct?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        teacherInsight: 'Only visible after privileged reads.',
        tagNames: ['single-choice'],
      })
      .expect(201);

    singleQuestionId = singleQuestionResponse.body.id;

    const correctSingleOptionResponse = await request(app.getHttpServer())
      .post('/options')
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .send({
        questionId: singleQuestionId,
        text: 'Correct',
        isCorrect: true,
      })
      .expect(201);

    correctSingleOptionId = correctSingleOptionResponse.body.id;

    await request(app.getHttpServer())
      .post('/options')
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .send({
        questionId: singleQuestionId,
        text: 'Wrong',
        isCorrect: false,
      })
      .expect(201);

    const multipleQuestionResponse = await request(app.getHttpServer())
      .post('/questions')
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .send({
        testId,
        text: 'Select all correct options.',
        type: QuestionType.MULTIPLE_CHOICE,
        points: 2,
        tagNames: ['multiple-choice'],
      })
      .expect(201);

    multipleQuestionId = multipleQuestionResponse.body.id;

    const firstCorrectMultipleOptionResponse = await request(app.getHttpServer())
      .post('/options')
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .send({
        questionId: multipleQuestionId,
        text: 'Correct A',
        isCorrect: true,
      })
      .expect(201);

    const secondCorrectMultipleOptionResponse = await request(
      app.getHttpServer(),
    )
      .post('/options')
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .send({
        questionId: multipleQuestionId,
        text: 'Correct B',
        isCorrect: true,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/options')
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .send({
        questionId: multipleQuestionId,
        text: 'Wrong C',
        isCorrect: false,
      })
      .expect(201);

    correctMultipleOptionIds = [
      firstCorrectMultipleOptionResponse.body.id,
      secondCorrectMultipleOptionResponse.body.id,
    ];

    await request(app.getHttpServer())
      .patch(`/tests/${testId}/publish`)
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .send({ isPublished: true })
      .expect(200)
      .expect(({ body }) => {
        expect(body.isPublished).toBe(true);
      });
  });

  it('returns a student-safe test payload without correct answers', async () => {
    const response = await request(app.getHttpServer())
      .get(`/tests/${testId}/take`)
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .expect(200);

    expect(response.body.questions).toHaveLength(2);
    expect(JSON.stringify(response.body)).not.toContain('isCorrect');
    expect(JSON.stringify(response.body)).not.toContain('teacherInsight');
  });

  it('returns teacher creator studio tests with status and counts', async () => {
    await request(app.getHttpServer())
      .get(`/tests/my?search=${encodeURIComponent(runId)}`)
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(1);
        expect(body.items[0]).toMatchObject({
          id: testId,
          title: `E2E Test ${runId}`,
          isPublished: true,
          _count: {
            questions: 2,
            attempts: 0,
          },
        });
        expect(body.meta.total).toBe(1);
      });
  });

  it('lets a student submit an attempt and receive a scored result', async () => {
    const startResponse = await request(app.getHttpServer())
      .post(`/tests/${testId}/attempts/start`)
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .expect(201);

    const attemptId = startResponse.body.attempt.id;
    expect(JSON.stringify(startResponse.body.test)).not.toContain('isCorrect');
    expect(JSON.stringify(startResponse.body.test)).not.toContain(
      'teacherInsight',
    );

    await request(app.getHttpServer())
      .post(`/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .send({
        answers: [
          {
            questionId: singleQuestionId,
            optionIds: [correctSingleOptionId],
          },
          {
            questionId: multipleQuestionId,
            optionIds: correctMultipleOptionIds,
          },
        ],
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.score).toBe(3);
        expect(body.maxScore).toBe(3);
        expect(body.isPassed).toBe(true);
        expect(body.completedAt).toBeTruthy();
      });
  });

  it('returns student dashboard stats and filtered attempt history', async () => {
    await request(app.getHttpServer())
      .get('/users/me/dashboard')
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.email).toBe(users.student.email);
        expect(body.stats.testsTaken).toBe(1);
        expect(body.stats.averageScore).toBe(100);
        expect(body.stats.skillsMastered).toBe(1);
        expect(body.stats.totalTimeSpentSeconds).toBeGreaterThanOrEqual(0);
      });

    await request(app.getHttpServer())
      .get('/attempts/my?status=PASSED')
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(1);
        expect(body.items[0].test.title).toBe(`E2E Test ${runId}`);
        expect(body.items[0].test.category.id).toBe(categoryId);
        expect(body.items[0].scorePercentage).toBe(100);
        expect(body.items[0].correctAnswersCount).toBe(2);
        expect(body.items[0].totalQuestionsCount).toBe(2);
        expect(body.items[0].timeSpentSeconds).toBeGreaterThanOrEqual(0);
      });
  });

  it('returns teacher analytics overview, attempts and question details', async () => {
    await request(app.getHttpServer())
      .get(`/analytics/tests/${testId}/overview`)
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalAttempts).toBe(1);
        expect(body.averageScore).toBe(100);
        expect(body.completionRate).toBe(100);
        expect(body.scoreDistribution['81-100']).toBe(1);
        expect(body.toughestQuestions).toHaveLength(2);
      });

    await request(app.getHttpServer())
      .get(`/analytics/tests/${testId}/attempts?search=student`)
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(1);
        expect(body.items[0].student.email).toBe(users.student.email);
        expect(body.items[0].scorePercentage).toBe(100);
        expect(body.items[0].completedAt).toBeTruthy();
        expect(body.meta.total).toBe(1);
      });

    await request(app.getHttpServer())
      .get(`/analytics/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(2);

        const singleQuestion = body.items.find(
          (item: { id: string }) => item.id === singleQuestionId,
        );
        const correctOption = singleQuestion.options.find(
          (option: { id: string }) => option.id === correctSingleOptionId,
        );

        expect(singleQuestion.totalAnswers).toBe(1);
        expect(correctOption.isCorrect).toBe(true);
        expect(correctOption.selectionPercentage).toBe(100);
      });
  });

  it('allows a student to rate a test only after completing it', async () => {
    const response = await request(app.getHttpServer())
      .post(`/tests/${testId}/ratings`)
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .send({
        value: 5,
        comment: 'Helpful test.',
      })
      .expect(201);

    expect(response.body.value).toBe(5);

    const test = await prisma.test.findUniqueOrThrow({
      where: { id: testId },
      select: {
        averageRating: true,
        ratingCount: true,
      },
    });

    expect(test.averageRating).toBe(5);
    expect(test.ratingCount).toBe(1);

    await request(app.getHttpServer())
      .post(`/tests/${testId}/ratings`)
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .send({ value: 4 })
      .expect(409);
  });

  it('prevents deleting tests with attempts and categories with tests', async () => {
    await request(app.getHttpServer())
      .delete(`/tests/${testId}`)
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/categories/${categoryId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(400);
  });

  async function seedUsers() {
    const hashedPassword = await bcrypt.hash(password, 4);

    await prisma.user.createMany({
      data: Object.values(users).map((user) => ({
        ...user,
        password: hashedPassword,
      })),
    });
  }

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    return response.body.accessToken as string;
  }

  async function cleanup() {
    if (testId) {
      await prisma.rating.deleteMany({ where: { testId } });
      await prisma.userAnswer.deleteMany({
        where: {
          attempt: {
            testId,
          },
        },
      });
      await prisma.attempt.deleteMany({ where: { testId } });
      await prisma.option.deleteMany({
        where: {
          question: {
            testId,
          },
        },
      });
      await prisma.question.deleteMany({ where: { testId } });
      await prisma.test.deleteMany({ where: { id: testId } });
    }

    if (categoryId) {
      await prisma.category.deleteMany({ where: { id: categoryId } });
    }

    await prisma.user.deleteMany({
      where: {
        email: {
          in: Object.values(users).map((user) => user.email),
        },
      },
    });
  }
});
