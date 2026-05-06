import { Controller, Get, Query } from '@nestjs/common';
import { FindTagsQueryDto } from './dto/find-tags-query.dto';
import { TagsService } from './tags.service';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll(@Query() query: FindTagsQueryDto) {
    return this.tagsService.findAll(query);
  }
}
