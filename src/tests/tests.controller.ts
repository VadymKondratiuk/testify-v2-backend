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
import { TestsService } from './tests.service';
import { CreateTestDto } from './dto/create-test.dto';
import { FindMyTestsQueryDto } from './dto/find-my-tests-query.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { FindTestsQueryDto } from './dto/find-tests-query.dto';
import { PublishTestDto } from './dto/publish-test.dto';

@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @Post()
  create(
    @Body() createTestDto: CreateTestDto,
    @GetCurrentUserId() teacherId: string,
  ) {
    return this.testsService.create(createTestDto, teacherId);
  }

  @Get()
  findAll(@Query() query: FindTestsQueryDto) {
    return this.testsService.findAll(query);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @Get('my')
  findMy(
    @Query() query: FindMyTestsQueryDto,
    @GetCurrentUserId() teacherId: string,
  ) {
    return this.testsService.findMy(query, teacherId);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  @Get(':id/take')
  findForTaking(@Param('id', ParseUUIDPipe) id: string) {
    return this.testsService.findForTaking(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.testsService.findOne(id);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTestDto: UpdateTestDto,
    @GetCurrentUser() currentUser: JwtPayload,
  ) {
    return this.testsService.update(id, updateTestDto, currentUser);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Patch(':id/publish')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() publishTestDto: PublishTestDto,
    @GetCurrentUser() currentUser: JwtPayload,
  ) {
    return this.testsService.publish(id, publishTestDto, currentUser);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUser() currentUser: JwtPayload,
  ) {
    return this.testsService.remove(id, currentUser);
  }
}
