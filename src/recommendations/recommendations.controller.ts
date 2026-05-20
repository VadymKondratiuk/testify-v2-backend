import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AtAuthGuard } from '../auth/guards/at-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRecommendationEventDto } from './dto/create-recommendation-event.dto';
import { FindRecommendationsQueryDto } from './dto/find-recommendations-query.dto';
import { RecommendationsService } from './recommendations.service';

@UseGuards(AtAuthGuard, RolesGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  @Get('tests')
  findTests(
    @Query() query: FindRecommendationsQueryDto,
    @GetCurrentUserId() userId: string,
  ) {
    return this.recommendationsService.findForUser(userId, query);
  }

  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  @Post('events')
  trackEvent(
    @Body() createEventDto: CreateRecommendationEventDto,
    @GetCurrentUserId() userId: string,
  ) {
    return this.recommendationsService.trackEvent(userId, createEventDto);
  }
}
