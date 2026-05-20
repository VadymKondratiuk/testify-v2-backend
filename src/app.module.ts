import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { AttemptsModule } from './attempts/attempts.module';
import { CategoriesModule } from './categories/categories.module';
import { RatingsModule } from './ratings/ratings.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { TagsModule } from './tags/tags.module';
import { TestsModule } from './tests/tests.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AnalyticsModule,
    AuthModule,
    AttemptsModule,
    CategoriesModule,
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
