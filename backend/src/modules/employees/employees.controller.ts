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

  // Igor (07/05): "quero ver no painel master quais funcionários
  // estão online em tempo real". Usa last_active_at do users (heartbeat
  // a cada navegação no admin). Janela 10min — fora disso = offline.
  @Get('online')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'List employees + admins currently online (active last 10min)' })
  async onlineEmployees() {
    return this.employees.listOnlineEmployees();
  }

  @Get(':id/stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Employee productivity stats' })
  async stats(@Param('id') id: string) {
    return this.employees.getStats(id);
  }

  @Get(':id/productivity')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Productivity breakdown (daily + monthly + items)',
    description: 'IMG_8846 — Igor paga por conteúdo, precisa ver exatamente o que cada funcionário adicionou.',
  })
  async productivity(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.employees.getProductivity(id, { from, to });
  }

  // Igor (07/05): funcionário acessa as PRÓPRIAS stats sem precisar
  // de role admin. Usa user.sub do JWT — não dá pra ver stats de outro.
  @Get('me/stats')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get my own productivity stats (employee self-service)' })
  async myStats(@GetUser() user: any) {
    return this.employees.getStats(user.sub || user.id);
  }

  @Get('me/productivity')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get my own productivity breakdown (employee self-service)' })
  async myProductivity(
    @GetUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.employees.getProductivity(user.sub || user.id, { from, to });
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
