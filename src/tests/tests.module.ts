import { Module } from '@nestjs/common';
import { TestsService } from './tests.service';
import { TestsController } from './tests.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { OptionsController } from './options.controller';
import { OptionsService } from './options.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [TestsController, QuestionsController, OptionsController],
  providers: [TestsService, QuestionsService, OptionsService],
})
export class TestsModule {}
