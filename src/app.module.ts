import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { AttemptsModule } from './attempts/attempts.module';
import { CategoriesModule } from './categories/categories.module';
import { LearningGoalsModule } from './learning-goals/learning-goals.module';
import { RatingsModule } from './ratings/ratings.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { TagsModule } from './tags/tags.module';
import { TestsModule } from './tests/tests.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AnalyticsModule,
    AiModule,
    AuthModule,
    AttemptsModule,
    CategoriesModule,
    LearningGoalsModule,
    RatingsModule,
    RecommendationsModule,
    TagsModule,
    TestsModule,
    UsersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
