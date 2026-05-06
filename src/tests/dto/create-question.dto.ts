import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { QuestionType } from '@prisma/client';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const normalizeTagNames = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalizedTagNames = value
    .map((item) =>
      String(item)
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase(),
    )
    .filter((item) => item.length > 0);

  return [...new Set(normalizedTagNames)];
};

export class CreateQuestionDto {
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  text!: string;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @IsUUID()
  testId!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  teacherInsight?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Transform(normalizeTagNames)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tagNames?: string[];
}
