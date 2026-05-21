import { Difficulty } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateLearningGoalDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(Difficulty)
  targetDifficulty?: Difficulty;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(50)
  @Max(100)
  targetScore?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID(undefined, { each: true })
  tagIds?: string[];
}
