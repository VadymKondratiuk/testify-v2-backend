import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AttemptsModule } from './attempts/attempts.module';
import { CategoriesModule } from './categories/categories.module';
import { RatingsModule } from './ratings/ratings.module';
import { TestsModule } from './tests/tests.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AuthModule,
    AttemptsModule,
    CategoriesModule,
    RatingsModule,
    TestsModule,
    UsersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
