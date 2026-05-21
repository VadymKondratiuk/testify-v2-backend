import { PartialType } from '@nestjs/mapped-types';
import { LearningGoalStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateLearningGoalDto } from './create-learning-goal.dto';

export class UpdateLearningGoalDto extends PartialType(CreateLearningGoalDto) {
  @IsOptional()
  @IsEnum(LearningGoalStatus)
  status?: LearningGoalStatus;
}
