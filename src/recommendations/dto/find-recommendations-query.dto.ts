import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class FindRecommendationsQueryDto {
  @IsOptional()
  @IsIn(['catalog', 'profile', 'result'])
  placement?: 'catalog' | 'profile' | 'result' = 'catalog';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 6;
}
