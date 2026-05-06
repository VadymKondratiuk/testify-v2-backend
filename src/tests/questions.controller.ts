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
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AtAuthGuard } from '../auth/guards/at-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionsService } from './questions.service';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @Post()
  create(
    @Body() createQuestionDto: CreateQuestionDto,
    @GetCurrentUserId() teacherId: string,
  ) {
    return this.questionsService.create(createQuestionDto, teacherId);
  }

  @Get()
  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  findAll(@Query('testId') testId?: string) {
    return this.questionsService.findAll(testId);
  }

  @Get(':id')
  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.questionsService.findOne(id);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
    @GetCurrentUserId() teacherId: string,
  ) {
    return this.questionsService.update(id, updateQuestionDto, teacherId);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUserId() teacherId: string,
  ) {
    return this.questionsService.remove(id, teacherId);
  }
}
