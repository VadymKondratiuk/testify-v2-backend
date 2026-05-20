import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestionType, Role } from '@prisma/client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  TagAnswerResult,
  UserKnowledgeService,
} from '../recommendations/user-knowledge.service';
import {
  FindMyAttemptsQueryDto,
  MyAttemptStatus,
} from './dto/find-my-attempts-query.dto';
import {
  SubmitAttemptAnswerDto,
  SubmitAttemptDto,
} from './dto/submit-attempt.dto';

type AttemptQuestion = Prisma.QuestionGetPayload<{
  include: { options: true; tags: true };
}>;
type EvaluatedUserAnswer = Omit<
  Prisma.UserAnswerCreateManyInput,
  'attemptId'
>;

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userKnowledgeService: UserKnowledgeService,
  ) {}

  async start(testId: string, userId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: {
        category: true,
        questions: {
          include: {
            options: {
              select: {
                id: true,
                text: true,
                questionId: true,
              },
              orderBy: { text: 'asc' },
            },
            tags: true,
          },
          orderBy: { text: 'asc' },
        },
      },
    });

    if (!test) {
      throw new NotFoundException(`Test with id "${testId}" was not found`);
    }

    if (!test.isPublished) {
      throw new BadRequestException('Only published tests can be attempted');
    }

    if (test.questions.length === 0) {
      throw new BadRequestException('Test has no questions');
    }

    const maxScore = test.questions.reduce(
      (total, question) => total + question.points,
      0,
    );

    const attempt = await this.prisma.attempt.create({
      data: {
        userId,
        testId,
        maxScore,
        passingScore: test.passingScore,
        focusAreas: [],
      },
      ...this.defaultAttemptArgs(),
    });

    return {
      attempt,
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        difficulty: test.difficulty,
        passingScore: test.passingScore,
        timeLimit: test.timeLimit,
        category: test.category,
        questions: test.questions.map((question) => ({
          id: question.id,
          text: question.text,
          type: question.type,
          points: question.points,
          tags: question.tags,
          options: question.options.map((option) => ({
            id: option.id,
            text: option.text,
            questionId: option.questionId,
          })),
        })),
      },
    };
  }

  async submit(
    id: string,
    submitAttemptDto: SubmitAttemptDto,
    userId: string,
  ) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id },
      include: {
        test: {
          include: {
            questions: {
              include: {
                options: true,
                tags: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException(`Attempt with id "${id}" was not found`);
    }

    if (attempt.userId !== userId) {
      throw new ForbiddenException('You can submit only your own attempts');
    }

    if (attempt.completedAt) {
      throw new BadRequestException('Attempt has already been submitted');
    }

    const answerMap = this.buildAnswerMap(submitAttemptDto.answers);
    const evaluation = this.evaluateAnswers(attempt.test.questions, answerMap);
    const percentage =
      evaluation.maxScore === 0
        ? 0
        : Math.round((evaluation.score / evaluation.maxScore) * 100);

    return this.prisma.$transaction(async (tx) => {
      if (evaluation.userAnswers.length > 0) {
        await tx.userAnswer.createMany({
          data: evaluation.userAnswers.map((answer) => ({
            ...answer,
            attemptId: attempt.id,
          })),
        });
      }

      await this.userKnowledgeService.updateTagMastery(
        userId,
        evaluation.tagResults,
        tx,
      );

      return tx.attempt.update({
        where: { id: attempt.id },
        data: {
          score: evaluation.score,
          maxScore: evaluation.maxScore,
          isPassed: percentage >= attempt.passingScore,
          completedAt: new Date(),
          focusAreas: evaluation.focusAreas,
          studyRecommendation: this.buildStudyRecommendation(
            percentage,
            evaluation.focusAreas,
          ),
        },
        ...this.defaultAttemptArgs(),
      });
    });
  }

  async findMy(userId: string, query: FindMyAttemptsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      userId,
      ...(query.status === MyAttemptStatus.PASSED
        ? { isPassed: true, completedAt: { not: null } }
        : {}),
      ...(query.status === MyAttemptStatus.FAILED
        ? { isPassed: false, completedAt: { not: null } }
        : {}),
    } satisfies Prisma.AttemptWhereInput;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.attempt.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          test: {
            select: {
              id: true,
              title: true,
              difficulty: true,
              passingScore: true,
              category: true,
              _count: {
                select: {
                  questions: true,
                },
              },
            },
          },
          userAnswers: {
            select: {
              questionId: true,
              isCorrect: true,
            },
          },
        },
      }),
      this.prisma.attempt.count({ where }),
    ]);

    return {
      items: items.map((attempt) => ({
        id: attempt.id,
        score: attempt.score,
        maxScore: attempt.maxScore,
        scorePercentage: this.toPercentage(attempt.score, attempt.maxScore),
        isPassed: attempt.isPassed,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        timeSpentSeconds: this.getTimeSpentSeconds(
          attempt.startedAt,
          attempt.completedAt,
        ),
        correctAnswersCount: this.countCorrectAnswers(attempt.userAnswers),
        totalQuestionsCount: attempt.test._count.questions,
        test: {
          id: attempt.test.id,
          title: attempt.test.title,
          difficulty: attempt.test.difficulty,
          passingScore: attempt.test.passingScore,
          category: attempt.test.category,
        },
      })),
      meta: {
        total,
        page,
        limit,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: JwtPayload) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id },
      ...this.defaultAttemptArgs(),
    });

    if (!attempt) {
      throw new NotFoundException(`Attempt with id "${id}" was not found`);
    }

    if (user.role === Role.ADMIN) {
      return attempt;
    }

    if (attempt.userId === user.sub) {
      return attempt;
    }

    if (user.role === Role.TEACHER && attempt.test.authorId === user.sub) {
      return attempt;
    }

    throw new ForbiddenException('You cannot access this attempt');
  }

  private buildAnswerMap(answers: SubmitAttemptAnswerDto[]) {
    const answerMap = new Map<string, SubmitAttemptAnswerDto>();

    for (const answer of answers) {
      if (answerMap.has(answer.questionId)) {
        throw new BadRequestException(
          `Question "${answer.questionId}" has duplicate answers`,
        );
      }

      answerMap.set(answer.questionId, answer);
    }

    return answerMap;
  }

  private evaluateAnswers(
    questions: AttemptQuestion[],
    answerMap: Map<string, SubmitAttemptAnswerDto>,
  ) {
    const questionIds = new Set(questions.map((question) => question.id));
    const unknownQuestionId = [...answerMap.keys()].find(
      (questionId) => !questionIds.has(questionId),
    );

    if (unknownQuestionId) {
      throw new BadRequestException(
        `Question "${unknownQuestionId}" does not belong to this test`,
      );
    }

    const maxScore = questions.reduce(
      (total, question) => total + question.points,
      0,
    );
    let score = 0;
    const focusAreas = new Set<string>();
    const tagResults: TagAnswerResult[] = [];
    const userAnswers: EvaluatedUserAnswer[] = [];

    for (const question of questions) {
      const answer = answerMap.get(question.id);

      if (!answer) {
        this.addFocusAreas(question, focusAreas);
        this.addTagResults(question, false, tagResults);
        continue;
      }

      const result = this.evaluateQuestion(question, answer);

      if (result.isCorrect) {
        score += question.points;
      } else {
        this.addFocusAreas(question, focusAreas);
      }

      this.addTagResults(question, result.isCorrect, tagResults);

      userAnswers.push(...result.userAnswers);
    }

    return {
      score,
      maxScore,
      focusAreas: [...focusAreas],
      tagResults,
      userAnswers,
    };
  }

  private evaluateQuestion(
    question: AttemptQuestion,
    answer: SubmitAttemptAnswerDto,
  ) {
    switch (question.type) {
      case QuestionType.SINGLE_CHOICE:
        return this.evaluateSingleChoice(question, answer);
      case QuestionType.MULTIPLE_CHOICE:
        return this.evaluateMultipleChoice(question, answer);
      case QuestionType.TEXT_ANSWER:
        return this.evaluateTextAnswer(question, answer);
    }
  }

  private evaluateSingleChoice(
    question: AttemptQuestion,
    answer: SubmitAttemptAnswerDto,
  ) {
    const optionIds = answer.optionIds ?? [];

    if (optionIds.length !== 1) {
      throw new BadRequestException(
        `Question "${question.id}" requires exactly one option`,
      );
    }

    this.ensureOptionsBelongToQuestion(question, optionIds);

    const selectedOption = question.options.find(
      (option) => option.id === optionIds[0],
    );
    const isCorrect = Boolean(selectedOption?.isCorrect);

    return {
      isCorrect,
      userAnswers: [
        {
          questionId: question.id,
          optionId: optionIds[0],
          isCorrect,
        },
      ],
    };
  }

  private evaluateMultipleChoice(
    question: AttemptQuestion,
    answer: SubmitAttemptAnswerDto,
  ) {
    const optionIds = answer.optionIds ?? [];

    if (optionIds.length === 0) {
      throw new BadRequestException(
        `Question "${question.id}" requires at least one option`,
      );
    }

    this.ensureOptionsBelongToQuestion(question, optionIds);

    const selectedOptionIds = new Set(optionIds);
    const correctOptionIds = new Set(
      question.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id),
    );
    const isCorrect =
      selectedOptionIds.size === correctOptionIds.size &&
      [...selectedOptionIds].every((optionId) =>
        correctOptionIds.has(optionId),
      );

    return {
      isCorrect,
      userAnswers: optionIds.map((optionId) => ({
        questionId: question.id,
        optionId,
        isCorrect,
      })),
    };
  }

  private evaluateTextAnswer(
    question: AttemptQuestion,
    answer: SubmitAttemptAnswerDto,
  ) {
    const textAnswer = answer.textAnswer?.trim();

    if (!textAnswer) {
      throw new BadRequestException(
        `Question "${question.id}" requires a text answer`,
      );
    }

    return {
      isCorrect: false,
      userAnswers: [
        {
          questionId: question.id,
          textAnswer,
          isCorrect: false,
        },
      ],
    };
  }

  private ensureOptionsBelongToQuestion(
    question: AttemptQuestion,
    optionIds: string[],
  ) {
    const questionOptionIds = new Set(
      question.options.map((option) => option.id),
    );
    const invalidOptionId = optionIds.find(
      (optionId) => !questionOptionIds.has(optionId),
    );

    if (invalidOptionId) {
      throw new BadRequestException(
        `Option "${invalidOptionId}" does not belong to question "${question.id}"`,
      );
    }
  }

  private addFocusAreas(question: AttemptQuestion, focusAreas: Set<string>) {
    question.tags.forEach((tag) => focusAreas.add(tag.name));
  }

  private addTagResults(
    question: AttemptQuestion,
    isCorrect: boolean,
    tagResults: TagAnswerResult[],
  ) {
    question.tags.forEach((tag) => {
      tagResults.push({
        tagId: tag.id,
        isCorrect,
      });
    });
  }

  private buildStudyRecommendation(percentage: number, focusAreas: string[]) {
    if (focusAreas.length === 0) {
      return 'Great result. Keep practicing to retain this level.';
    }

    if (percentage >= 80) {
      return `Good result. Revisit: ${focusAreas.join(', ')}.`;
    }

    if (percentage >= 60) {
      return `You passed, but these areas need more practice: ${focusAreas.join(', ')}.`;
    }

    return `Review the core material and focus on: ${focusAreas.join(', ')}.`;
  }

  private countCorrectAnswers(
    userAnswers: Array<{ questionId: string; isCorrect: boolean }>,
  ) {
    return new Set(
      userAnswers
        .filter((answer) => answer.isCorrect)
        .map((answer) => answer.questionId),
    ).size;
  }

  private getTimeSpentSeconds(startedAt: Date, completedAt: Date | null) {
    if (!completedAt) {
      return 0;
    }

    return Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);
  }

  private toPercentage(value: number, total: number) {
    if (total === 0) {
      return 0;
    }

    return this.roundToTwo((value / total) * 100);
  }

  private roundToTwo(value: number) {
    return Math.round(value * 100) / 100;
  }

  private defaultAttemptArgs() {
    return {
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        test: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            passingScore: true,
            timeLimit: true,
            authorId: true,
            category: true,
            questions: {
              select: {
                id: true,
                text: true,
                type: true,
                points: true,
                teacherInsight: true,
                tags: true,
                options: {
                  select: {
                    id: true,
                    text: true,
                    isCorrect: true,
                  },
                  orderBy: { text: 'asc' },
                },
              },
              orderBy: { text: 'asc' },
            },
          },
        },
        userAnswers: {
          include: {
            question: {
              select: {
                id: true,
                text: true,
                type: true,
                points: true,
                teacherInsight: true,
                tags: true,
                options: {
                  select: {
                    id: true,
                    text: true,
                    isCorrect: true,
                  },
                  orderBy: { text: 'asc' },
                },
              },
            },
            option: {
              select: {
                id: true,
                text: true,
              },
            },
          },
          orderBy: {
            question: {
              text: 'asc',
            },
          },
        },
      },
    } satisfies Prisma.AttemptDefaultArgs;
  }
}
