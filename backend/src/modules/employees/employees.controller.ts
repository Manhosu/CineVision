import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EmployeesService } from './employees.service';
import {
  CreateEmployeeDto,
  UpdateEmployeePermissionsDto,
} from './dto/employee.dto';

@ApiTags('admin-employees')
@Controller('admin/employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new employee' })
  async create(@Body(ValidationPipe) dto: CreateEmployeeDto) {
    return this.employees.createEmployee(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all employees' })
  async list() {
    return this.employees.listEmployees();
  }

  @Get('link-preview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Preview a Telegram URL (OG metadata)' })
  async preview(@Query('url') url: string) {
    return this.employees.previewTelegramLink(url);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Current employee productivity stats' })
  async meStats(@GetUser() user: any) {
    return this.employees.getStats(user.sub);
  }

  @Get('me/content')
  @ApiOperation({ summary: 'Current employee content list' })
  async meContent(@GetUser() user: any) {
    return this.employees.listContent(user.sub);
  }

  @Get('me/permissions')
  @ApiOperation({ summary: 'Current employee permissions' })
  async mePermissions(@GetUser() user: any) {
    return this.employees.getPermissions(user.sub);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get employee by id' })
  async get(@Param('id') id: string) {
    return this.employees.getEmployee(id);
  }

  @Put(':id/permissions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update employee permissions' })
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateEmployeePermissionsDto,
  ) {
    return this.employees.updatePermissions(id, dto);
  }

  @Get(':id/stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Employee productivity stats' })
  async stats(@Param('id') id: string) {
    return this.employees.getStats(id);
  }

  @Get(':id/content')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Employee content list' })
  async content(@Param('id') id: string) {
    return this.employees.listContent(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete employee' })
  async delete(@Param('id') id: string) {
    return this.employees.deleteEmployee(id);
  }
}
