import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SubmitAttemptAnswerDto {
  @IsUUID()
  questionId!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  optionIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  textAnswer?: string;
}

export class SubmitAttemptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAttemptAnswerDto)
  answers!: SubmitAttemptAnswerDto[];
}
