import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuestionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';

@Injectable()
export class OptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOptionDto: CreateOptionDto, teacherId: string) {
    const question = await this.ensureTeacherCanModifyQuestion(
      createOptionDto.questionId,
      teacherId,
    );

    await this.ensureOptionCanBeCorrect(
      question.id,
      question.type,
      createOptionDto.isCorrect ?? false,
    );

    return this.prisma.option.create({
      data: createOptionDto,
      ...this.defaultOptionArgs(),
    });
  }

  findAll(questionId?: string) {
    return this.prisma.option.findMany({
      where: { questionId },
      orderBy: { text: 'asc' },
      ...this.defaultOptionArgs(),
    });
  }

  async findOne(id: string) {
    const option = await this.prisma.option.findUnique({
      where: { id },
      ...this.defaultOptionArgs(),
    });

    if (!option) {
      throw new NotFoundException(`Option with id "${id}" was not found`);
    }

    return option;
  }

  async update(
    id: string,
    updateOptionDto: UpdateOptionDto,
    teacherId: string,
  ) {
    const option = await this.ensureTeacherCanModifyOption(id, teacherId);

    if (updateOptionDto.isCorrect === true) {
      await this.ensureOptionCanBeCorrect(
        option.questionId,
        option.question.type,
        true,
        id,
      );
    }

    return this.prisma.option.update({
      where: { id },
      data: updateOptionDto,
      ...this.defaultOptionArgs(),
    });
  }

  async remove(id: string, teacherId: string) {
    const option = await this.ensureTeacherCanModifyOption(id, teacherId);

    await this.ensureQuestionRemainsValidAfterOptionDelete(
      option.questionId,
      option.question.type,
      id,
    );

    await this.prisma.option.delete({
      where: { id },
    });

    return { id };
  }

  private defaultOptionArgs() {
    return {
      include: {
        question: {
          select: {
            id: true,
            text: true,
            type: true,
            test: {
              select: {
                id: true,
                title: true,
                authorId: true,
                isPublished: true,
              },
            },
          },
        },
      },
    };
  }

  private async ensureTeacherCanModifyOption(id: string, teacherId: string) {
    const option = await this.prisma.option.findUnique({
      where: { id },
      include: {
        question: {
          include: {
            test: {
              select: {
                authorId: true,
                isPublished: true,
              },
            },
          },
        },
      },
    });

    if (!option) {
      throw new NotFoundException(`Option with id "${id}" was not found`);
    }

    this.ensureQuestionCanHaveOptions(option.question.type);
    this.ensureTestOwnership(option.question.test.authorId, teacherId);
    this.ensureTestIsDraft(option.question.test.isPublished);

    return option;
  }

  private async ensureTeacherCanModifyQuestion(
    questionId: string,
    teacherId: string,
  ) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        test: {
          select: {
            authorId: true,
            isPublished: true,
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException(
        `Question with id "${questionId}" was not found`,
      );
    }

    this.ensureQuestionCanHaveOptions(question.type);
    this.ensureTestOwnership(question.test.authorId, teacherId);
    this.ensureTestIsDraft(question.test.isPublished);

    return question;
  }

  private ensureQuestionCanHaveOptions(type: QuestionType) {
    if (type === QuestionType.TEXT_ANSWER) {
      throw new BadRequestException(
        'TEXT_ANSWER questions cannot have options',
      );
    }
  }

  private async ensureOptionCanBeCorrect(
    questionId: string,
    type: QuestionType,
    isCorrect: boolean,
    currentOptionId?: string,
  ) {
    if (!isCorrect || type !== QuestionType.SINGLE_CHOICE) {
      return;
    }

    const existingCorrectOption = await this.prisma.option.findFirst({
      where: {
        questionId,
        isCorrect: true,
        ...(currentOptionId ? { id: { not: currentOptionId } } : {}),
      },
      select: { id: true },
    });

    if (existingCorrectOption) {
      throw new BadRequestException(
        'SINGLE_CHOICE question can have only one correct option',
      );
    }
  }

  private async ensureQuestionRemainsValidAfterOptionDelete(
    questionId: string,
    type: QuestionType,
    optionId: string,
  ) {
    if (type === QuestionType.TEXT_ANSWER) {
      return;
    }

    const remainingOptions = await this.prisma.option.findMany({
      where: {
        questionId,
        id: { not: optionId },
      },
      select: {
        id: true,
        isCorrect: true,
      },
    });

    if (remainingOptions.length < 2) {
      throw new BadRequestException(
        'Choice questions must have at least two options',
      );
    }

    if (!remainingOptions.some((option) => option.isCorrect)) {
      throw new BadRequestException(
        'Choice questions must have at least one correct option',
      );
    }
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
}
