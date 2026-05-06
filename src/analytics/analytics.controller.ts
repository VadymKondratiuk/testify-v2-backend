import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AtAuthGuard } from '../auth/guards/at-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { AnalyticsService } from './analytics.service';
import { FindAnalyticsAttemptsQueryDto } from './dto/find-analytics-attempts-query.dto';

@UseGuards(AtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('tests/:testId/overview')
  getOverview(
    @Param('testId', ParseUUIDPipe) testId: string,
    @GetCurrentUser() user: JwtPayload,
  ) {
    return this.analyticsService.getOverview(testId, user);
  }

  @Get('tests/:testId/attempts')
  getAttempts(
    @Param('testId', ParseUUIDPipe) testId: string,
    @Query() query: FindAnalyticsAttemptsQueryDto,
    @GetCurrentUser() user: JwtPayload,
  ) {
    return this.analyticsService.getAttempts(testId, query, user);
  }

  @Get('tests/:testId/questions')
  getQuestions(
    @Param('testId', ParseUUIDPipe) testId: string,
    @GetCurrentUser() user: JwtPayload,
  ) {
    return this.analyticsService.getQuestions(testId, user);
  }
}
