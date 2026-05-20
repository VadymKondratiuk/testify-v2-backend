import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createQuestionDto: CreateQuestionDto, teacherId: string) {
    await this.ensureTeacherCanModifyTest(createQuestionDto.testId, teacherId);

    return this.prisma.question.create({
      data: this.buildCreateQuestionData(createQuestionDto),
      ...this.defaultQuestionArgs(),
    });
  }

  findAll(testId?: string) {
    return this.prisma.question.findMany({
      where: { testId },
      orderBy: { text: 'asc' },
      ...this.defaultQuestionArgs(),
    });
  }

  async findOne(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      ...this.defaultQuestionArgs(),
    });

    if (!question) {
      throw new NotFoundException(`Question with id "${id}" was not found`);
    }

    return question;
  }

  async update(
    id: string,
    updateQuestionDto: UpdateQuestionDto,
    teacherId: string,
  ) {
    const question = await this.ensureTeacherCanModifyQuestion(id, teacherId);

    if (
      updateQuestionDto.testId &&
      updateQuestionDto.testId !== question.testId
    ) {
      throw new BadRequestException('Question cannot be moved to another test');
    }

    if (
      updateQuestionDto.type &&
      updateQuestionDto.type !== QuestionType.TEXT_ANSWER &&
      (updateQuestionDto.correctTextAnswer !== undefined ||
        updateQuestionDto.acceptedTextAnswers !== undefined)
    ) {
      updateQuestionDto.correctTextAnswer = undefined;
      updateQuestionDto.acceptedTextAnswers = undefined;
    }

    if (updateQuestionDto.type === QuestionType.TEXT_ANSWER) {
      return this.prisma.$transaction(async (tx) => {
        await tx.option.deleteMany({
          where: { questionId: id },
        });

        return tx.question.update({
          where: { id },
          data: this.buildUpdateQuestionData(updateQuestionDto),
          ...this.defaultQuestionArgs(),
        });
      });
    }

    return this.prisma.question.update({
      where: { id },
      data: this.buildUpdateQuestionData(updateQuestionDto),
      ...this.defaultQuestionArgs(),
    });
  }

  async remove(id: string, teacherId: string) {
    await this.ensureTeacherCanModifyQuestion(id, teacherId);

    await this.prisma.question.delete({
      where: { id },
    });

    return { id };
  }

  private buildCreateQuestionData(
    dto: CreateQuestionDto,
  ): Prisma.QuestionCreateInput {
    const { tagNames, testId, ...questionData } = dto;
    const isTextAnswer = questionData.type === QuestionType.TEXT_ANSWER;

    return {
      ...questionData,
      correctTextAnswer: isTextAnswer ? questionData.correctTextAnswer : null,
      acceptedTextAnswers: isTextAnswer
        ? questionData.acceptedTextAnswers ?? []
        : [],
      test: { connect: { id: testId } },
      ...(tagNames
        ? {
            tags: {
              connectOrCreate: tagNames.map((name) => ({
                where: { name },
                create: { name },
              })),
            },
          }
        : {}),
    };
  }

  private buildUpdateQuestionData(
    dto: UpdateQuestionDto,
  ): Prisma.QuestionUpdateInput {
    const { tagNames, testId: _testId, ...questionData } = dto;
    const shouldClearTextAnswer =
      questionData.type !== undefined &&
      questionData.type !== QuestionType.TEXT_ANSWER;

    return {
      ...questionData,
      ...(shouldClearTextAnswer
        ? { correctTextAnswer: null, acceptedTextAnswers: [] }
        : {}),
      ...(tagNames
        ? {
            tags: {
              set: [],
              connectOrCreate: tagNames.map((name) => ({
                where: { name },
                create: { name },
              })),
            },
          }
        : {}),
    };
  }

  private defaultQuestionArgs() {
    return {
      include: {
        options: true,
        tags: true,
        test: {
          select: {
            id: true,
            title: true,
            isPublished: true,
            authorId: true,
            deletedAt: true,
          },
        },
      },
    } satisfies Prisma.QuestionDefaultArgs;
  }

  private async ensureTeacherCanModifyQuestion(id: string, teacherId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        options: true,
        test: {
          select: {
            id: true,
            authorId: true,
            isPublished: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException(`Question with id "${id}" was not found`);
    }

    this.ensureTestOwnership(question.test.authorId, teacherId);
    this.ensureTestIsActive(question.test.deletedAt);
    this.ensureTestIsDraft(question.test.isPublished);

    return question;
  }

  private async ensureTeacherCanModifyTest(testId: string, teacherId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: {
        id: true,
        authorId: true,
        isPublished: true,
        deletedAt: true,
      },
    });

    if (!test) {
      throw new NotFoundException(`Test with id "${testId}" was not found`);
    }

    this.ensureTestOwnership(test.authorId, teacherId);
    this.ensureTestIsActive(test.deletedAt);
    this.ensureTestIsDraft(test.isPublished);
  }

  private ensureTestOwnership(authorId: string, teacherId: string) {
    if (authorId !== teacherId) {
      throw new ForbiddenException('You can manage only your own tests');
    }
  }

  private ensureTestIsDraft(isPublished: boolean) {
    if (isPublished) {
      throw new BadRequestException(
        'Published tests cannot be modified. Unpublish the test first',
      );
    }
  }

  private ensureTestIsActive(deletedAt: Date | null) {
    if (deletedAt) {
      throw new NotFoundException('Test was not found');
    }
  }
}
