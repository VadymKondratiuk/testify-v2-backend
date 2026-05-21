import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AtAuthGuard } from '../auth/guards/at-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateLearningGoalDto } from './dto/create-learning-goal.dto';
import { UpdateLearningGoalDto } from './dto/update-learning-goal.dto';
import { LearningGoalsService } from './learning-goals.service';

@UseGuards(AtAuthGuard, RolesGuard)
@Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
@Controller('learning-goals')
export class LearningGoalsController {
  constructor(private readonly learningGoalsService: LearningGoalsService) {}

  @Get('my')
  findMine(@GetCurrentUserId() userId: string) {
    return this.learningGoalsService.findMine(userId);
  }

  @Post()
  create(
    @GetCurrentUserId() userId: string,
    @Body() createLearningGoalDto: CreateLearningGoalDto,
  ) {
    return this.learningGoalsService.create(userId, createLearningGoalDto);
  }

  @Patch(':id')
  update(
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLearningGoalDto: UpdateLearningGoalDto,
  ) {
    return this.learningGoalsService.update(userId, id, updateLearningGoalDto);
  }

  @Delete(':id')
  archive(
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.learningGoalsService.archive(userId, id);
  }
}
