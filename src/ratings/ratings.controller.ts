import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateRatingDto } from './dto/create-rating.dto';
import { FindRatingsQueryDto } from './dto/find-ratings-query.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';
import { RatingsService } from './ratings.service';

@Controller()
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Post('tests/:testId/ratings')
  create(
    @Param('testId', ParseUUIDPipe) testId: string,
    @Body() createRatingDto: CreateRatingDto,
    @GetCurrentUserId() studentId: string,
  ) {
    return this.ratingsService.create(testId, studentId, createRatingDto);
  }

  @Get('tests/:testId/ratings')
  findByTest(
    @Param('testId', ParseUUIDPipe) testId: string,
    @Query() query: FindRatingsQueryDto,
  ) {
    return this.ratingsService.findByTest(testId, query);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Get('ratings/my')
  findMy(
    @Query() query: FindRatingsQueryDto,
    @GetCurrentUserId() studentId: string,
  ) {
    return this.ratingsService.findMy(studentId, query);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT, Role.ADMIN)
  @Get('ratings/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUser() user: JwtPayload,
  ) {
    return this.ratingsService.findOne(id, user);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Patch('ratings/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRatingDto: UpdateRatingDto,
    @GetCurrentUserId() studentId: string,
  ) {
    return this.ratingsService.update(id, studentId, updateRatingDto);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Delete('ratings/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUserId() studentId: string,
  ) {
    return this.ratingsService.remove(id, studentId);
  }
}
