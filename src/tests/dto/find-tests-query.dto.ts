import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Difficulty } from '@prisma/client';

export enum DurationFilter {
  UNDER_15 = 'under_15',
  FROM_15_TO_30 = '15_30',
  FROM_31_TO_60 = '31_60',
  OVER_60 = 'over_60',
}

export enum QuestionCountFilter {
  FROM_1_TO_10 = '1_10',
  FROM_11_TO_30 = '11_30',
  FROM_31_TO_50 = '31_50',
  OVER_50 = 'over_50',
}

export enum RatingFilter {
  ANY = 'any',
  THREE_PLUS = '3_plus',
  FOUR_PLUS = '4_plus',
  FIVE = '5',
}

export enum TestSortOption {
  MOST_POPULAR = 'most_popular',
  NEWEST_FIRST = 'newest_first',
  HIGHEST_RATED = 'highest_rated',
  SHORTEST_FIRST = 'shortest_first',
  A_TO_Z = 'a_to_z',
}

const toArray = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(',');

  return values
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
};

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return value;
};

export class FindTestsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(Difficulty, { each: true })
  difficulties?: Difficulty[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(DurationFilter, { each: true })
  durations?: DurationFilter[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(QuestionCountFilter, { each: true })
  questionCounts?: QuestionCountFilter[];

  @IsOptional()
  @IsEnum(RatingFilter)
  rating?: RatingFilter;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(TestSortOption)
  sort?: TestSortOption = TestSortOption.NEWEST_FIRST;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'title', 'difficulty', 'averageRating'])
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'difficulty' | 'averageRating';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
