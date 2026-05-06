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
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(@Query() query: FindUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id/tests')
  findUserTests(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findUserTests(id);
  }

  @Get(':id/attempts')
  findUserAttempts(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findUserAttempts(id);
  }

  @Get(':id/ratings')
  findUserRatings(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findUserRatings(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
