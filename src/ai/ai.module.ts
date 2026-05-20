import { Module } from '@nestjs/common';
import { AiStudyCoachService } from './ai-study-coach.service';

@Module({
  providers: [AiStudyCoachService],
  exports: [AiStudyCoachService],
})
export class AiModule {}
