import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRatingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  value!: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
