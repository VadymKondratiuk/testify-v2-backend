import { Module } from '@nestjs/common';
import { TestsModule } from './tests/tests.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [TestsModule, UsersModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
