import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { TestsModule } from './tests/tests.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [AuthModule, CategoriesModule, TestsModule, UsersModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
