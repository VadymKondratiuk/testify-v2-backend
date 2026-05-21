import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LearningGoalsController } from './learning-goals.controller';
import { LearningGoalsService } from './learning-goals.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [LearningGoalsController],
  providers: [LearningGoalsService],
  exports: [LearningGoalsService],
})
export class LearningGoalsModule {}
