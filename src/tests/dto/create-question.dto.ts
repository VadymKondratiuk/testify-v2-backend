import { Transform } from 'class-transformer';
import {
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
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0)
      : value,
  )
  @IsString({ each: true })
  tagNames?: string[];
}
