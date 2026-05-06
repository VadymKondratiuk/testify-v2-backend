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
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';
import { OptionsService } from './options.service';

@Controller('options')
export class OptionsController {
  constructor(private readonly optionsService: OptionsService) {}

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @Post()
  create(
    @Body() createOptionDto: CreateOptionDto,
    @GetCurrentUserId() teacherId: string,
  ) {
    return this.optionsService.create(createOptionDto, teacherId);
  }

  @Get()
  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  findAll(@Query('questionId') questionId?: string) {
    return this.optionsService.findAll(questionId);
  }

  @Get(':id')
  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.optionsService.findOne(id);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOptionDto: UpdateOptionDto,
    @GetCurrentUserId() teacherId: string,
  ) {
    return this.optionsService.update(id, updateOptionDto, teacherId);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUserId() teacherId: string,
  ) {
    return this.optionsService.remove(id, teacherId);
  }
}
