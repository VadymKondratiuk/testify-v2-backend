import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { UserKnowledgeService } from './user-knowledge.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, UserKnowledgeService],
  exports: [RecommendationsService, UserKnowledgeService],
})
export class RecommendationsModule {}
