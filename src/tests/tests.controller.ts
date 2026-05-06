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
import { TestsService } from './tests.service';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { FindTestsQueryDto } from './dto/find-tests-query.dto';
import { PublishTestDto } from './dto/publish-test.dto';

@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Post()
  create(@Body() createTestDto: CreateTestDto) {
    return this.testsService.create(createTestDto);
  }

  @Get()
  findAll(@Query() query: FindTestsQueryDto) {
    return this.testsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.testsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTestDto: UpdateTestDto,
  ) {
    return this.testsService.update(id, updateTestDto);
  }

  @Patch(':id/publish')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() publishTestDto: PublishTestDto,
  ) {
    return this.testsService.publish(id, publishTestDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.testsService.remove(id);
  }
}
