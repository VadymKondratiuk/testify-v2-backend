import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AtAuthGuard } from '../auth/guards/at-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { AttemptsService } from './attempts.service';
import { FindMyAttemptsQueryDto } from './dto/find-my-attempts-query.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

@UseGuards(AtAuthGuard, RolesGuard)
@Controller()
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  @Post('tests/:testId/attempts/start')
  start(
    @Param('testId', ParseUUIDPipe) testId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.attemptsService.start(testId, userId);
  }

  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  @Post('attempts/:id/submit')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() submitAttemptDto: SubmitAttemptDto,
    @GetCurrentUserId() userId: string,
  ) {
    return this.attemptsService.submit(id, submitAttemptDto, userId);
  }

  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  @Get('attempts/my')
  findMy(
    @Query() query: FindMyAttemptsQueryDto,
    @GetCurrentUserId() userId: string,
  ) {
    return this.attemptsService.findMy(userId, query);
  }

  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  @Get('attempts/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUser() user: JwtPayload,
  ) {
    return this.attemptsService.findOne(id, user);
  }
}
