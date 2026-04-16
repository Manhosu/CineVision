import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminPeopleService } from '../services/admin-people.service';

@ApiTags('admin-people')
@Controller('admin/people')
export class AdminPeopleController {
  constructor(private readonly peopleService: AdminPeopleService) {}

  @Get()
  @ApiOperation({ summary: 'List all people (actors/directors)' })
  async findAll(@Query('search') search?: string, @Query('role') role?: string) {
    return this.peopleService.findAll(search, role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get person by ID' })
  async findById(@Param('id') id: string) {
    return this.peopleService.findById(id);
  }

  @Get(':id/with-content')
  @ApiOperation({ summary: 'Get person with linked content' })
  async findByIdWithContent(@Param('id') id: string) {
    return this.peopleService.findByIdWithContent(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a person (actor/director)' })
  async create(@Body() data: { name: string; role?: string; photo_url?: string; bio?: string }) {
    return this.peopleService.create(data);
  }

  @Post('find-or-create')
  @ApiOperation({ summary: 'Find existing person or create new' })
  async findOrCreate(@Body() data: { name: string; role?: string }) {
    return this.peopleService.findOrCreate(data.name, data.role || 'actor');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a person' })
  async update(@Param('id') id: string, @Body() data: { name?: string; photo_url?: string; bio?: string; role?: string }) {
    return this.peopleService.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a person' })
  async delete(@Param('id') id: string) {
    return this.peopleService.delete(id);
  }
}
