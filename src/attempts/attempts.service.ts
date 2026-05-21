import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestionType, Role } from '@prisma/client';
import { AiStudyCoachService } from '../ai/ai-study-coach.service';
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
type EvaluatedUserAnswer = Omit<Prisma.UserAnswerCreateManyInput, 'attemptId'>;

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiStudyCoachService: AiStudyCoachService,
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

    if (!test || test.deletedAt) {
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

  async submit(id: string, submitAttemptDto: SubmitAttemptDto, userId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id },
      include: {
        test: {
          include: {
            category: true,
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
    const fallbackRecommendation = this.buildStudyRecommendation(
      percentage,
      evaluation.focusAreas,
    );
    const studyRecommendation =
      await this.aiStudyCoachService.generateStudyRecommendation(
        {
          testTitle: attempt.test.title,
          scorePercentage: percentage,
          isPassed: percentage >= attempt.passingScore,
          categoryName: attempt.test.category?.name,
          difficulty: attempt.test.difficulty,
          focusAreas: evaluation.focusAreas,
          strongAreas: evaluation.strongAreas,
        },
        fallbackRecommendation,
      );

    return this.prisma.$transaction(async (tx) => {
      if (evaluation.userAnswers.length > 0) {
        await tx.userAnswer.createMany({
          data: evaluation.userAnswers.map((answer) => ({
            ...answer,
            attemptId: attempt.id,
          })),
        });
      }

      const skillProgress = await this.userKnowledgeService.updateTagMastery(
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
          skillProgress: skillProgress as unknown as Prisma.InputJsonValue,
          studyRecommendation,
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
    const strongAreas = new Set<string>();
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
      score += result.earnedPoints;

      if (result.isCorrect) {
        this.addStrongAreas(question, strongAreas);
      } else {
        this.addFocusAreas(question, focusAreas);
      }

      this.addTagResults(question, result.isCorrect, tagResults);

      userAnswers.push(...result.userAnswers);
    }

    return {
      score,
      maxScore,
      focusAreas: this.resolveFocusAreas([...focusAreas], score, maxScore),
      strongAreas: [...strongAreas],
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
      earnedPoints: isCorrect ? question.points : 0,
      userAnswers: [
        {
          questionId: question.id,
          optionId: optionIds[0],
          isCorrect,
          earnedPoints: isCorrect ? question.points : 0,
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
    const correctSelectedCount = [...selectedOptionIds].filter((optionId) =>
      correctOptionIds.has(optionId),
    ).length;
    const incorrectSelectedCount = [...selectedOptionIds].filter(
      (optionId) => !correctOptionIds.has(optionId),
    ).length;
    const rawScore = correctSelectedCount - incorrectSelectedCount;
    const scoreRatio =
      correctOptionIds.size === 0
        ? 0
        : Math.max(0, rawScore / correctOptionIds.size);
    const earnedPoints = this.roundToTwo(question.points * scoreRatio);

    return {
      isCorrect,
      earnedPoints,
      userAnswers: optionIds.map((optionId) => ({
        questionId: question.id,
        optionId,
        isCorrect,
        earnedPoints,
      })),
    };
  }

  private evaluateTextAnswer(
    question: AttemptQuestion,
    answer: SubmitAttemptAnswerDto,
  ) {
    const textAnswer = answer.textAnswer?.trim();
    const correctTextAnswer = question.correctTextAnswer?.trim();

    if (!textAnswer) {
      throw new BadRequestException(
        `Question "${question.id}" requires a text answer`,
      );
    }

    if (!correctTextAnswer) {
      throw new BadRequestException(
        `Question "${question.id}" does not have a correct text answer`,
      );
    }

    const normalizedTextAnswer = this.normalizeTextAnswer(textAnswer);
    const acceptedAnswers = [correctTextAnswer, ...question.acceptedTextAnswers]
      .map((acceptedAnswer) => this.normalizeTextAnswer(acceptedAnswer))
      .filter((acceptedAnswer) => acceptedAnswer.length > 0);
    const isCorrect = acceptedAnswers.includes(normalizedTextAnswer);

    return {
      isCorrect,
      earnedPoints: isCorrect ? question.points : 0,
      userAnswers: [
        {
          questionId: question.id,
          textAnswer,
          isCorrect,
          earnedPoints: isCorrect ? question.points : 0,
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

  private normalizeTextAnswer(value: string) {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  private addFocusAreas(question: AttemptQuestion, focusAreas: Set<string>) {
    if (question.tags.length > 0) {
      question.tags.forEach((tag) => focusAreas.add(tag.name));
      return;
    }

    focusAreas.add(this.getQuestionTypeFocusArea(question.type));
  }

  private addStrongAreas(question: AttemptQuestion, strongAreas: Set<string>) {
    question.tags.forEach((tag) => strongAreas.add(tag.name));
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

  private resolveFocusAreas(
    focusAreas: string[],
    score: number,
    maxScore: number,
  ) {
    if (focusAreas.length > 0) {
      return focusAreas;
    }

    const percentage = maxScore === 0 ? 0 : (score / maxScore) * 100;

    if (percentage >= 80) {
      return ['Knowledge retention', 'Next-level practice'];
    }

    if (percentage >= 60) {
      return ['Targeted review', 'Accuracy practice'];
    }

    return ['Core concepts', 'Question review'];
  }

  private getQuestionTypeFocusArea(type: QuestionType) {
    switch (type) {
      case QuestionType.MULTIPLE_CHOICE:
        return 'Multi-answer reasoning';
      case QuestionType.TEXT_ANSWER:
        return 'Written explanation practice';
      case QuestionType.SINGLE_CHOICE:
      default:
        return 'Single-choice concepts';
    }
  }

  private buildStudyRecommendation(percentage: number, focusAreas: string[]) {
    if (focusAreas.length === 0) {
      return 'Great result. Keep practicing to retain this level.';
    }

    if (percentage >= 80) {
      return `Good result. Keep practicing: ${focusAreas.join(', ')}.`;
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
                correctTextAnswer: true,
                acceptedTextAnswers: true,
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
                correctTextAnswer: true,
                acceptedTextAnswers: true,
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
