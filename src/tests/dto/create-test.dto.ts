import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  IsUUID,
} from 'class-validator';
import { Difficulty } from '@prisma/client';

export class CreateTestDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimit?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
