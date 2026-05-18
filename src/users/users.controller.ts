import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AtAuthGuard } from '../auth/guards/at-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SelfOrAdminGuard } from '../auth/guards/self-or-admin.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  findAll(@Query() query: FindUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Get('me/dashboard')
  findMyDashboard(@GetCurrentUserId() studentId: string) {
    return this.usersService.findMyDashboard(studentId);
  }

  @UseGuards(AtAuthGuard, SelfOrAdminGuard)
  @Get(':id/tests')
  findUserTests(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findUserTests(id);
  }

  @UseGuards(AtAuthGuard, SelfOrAdminGuard)
  @Get(':id/attempts')
  findUserAttempts(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findUserAttempts(id);
  }

  @UseGuards(AtAuthGuard, SelfOrAdminGuard)
  @Get(':id/ratings')
  findUserRatings(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findUserRatings(id);
  }

  @UseGuards(AtAuthGuard, SelfOrAdminGuard)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @UseGuards(AtAuthGuard, SelfOrAdminGuard)
  @Patch(':id/password')
  changePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(id, changePasswordDto);
  }

  @UseGuards(AtAuthGuard, SelfOrAdminGuard)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetCurrentUser() currentUser: JwtPayload,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @UseGuards(AtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUser() currentUser: JwtPayload,
  ) {
    return this.usersService.remove(id, currentUser);
  }
}
