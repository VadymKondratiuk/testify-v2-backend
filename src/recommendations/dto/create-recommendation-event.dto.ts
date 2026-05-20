import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateRecommendationEventDto {
  @IsUUID()
  testId!: string;

  @IsIn(['catalog', 'profile', 'result'])
  placement!: 'catalog' | 'profile' | 'result';

  @IsIn([
    'recommendation_shown',
    'recommendation_clicked',
    'recommendation_started',
    'recommendation_completed',
  ])
  eventType!:
    | 'recommendation_shown'
    | 'recommendation_clicked'
    | 'recommendation_started'
    | 'recommendation_completed';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
