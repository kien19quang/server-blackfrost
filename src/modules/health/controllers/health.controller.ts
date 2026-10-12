import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type HealthDto, healthSchema } from '../dtos/health.dto';
import { HealthService } from '../services/health.service';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ standardSchema: healthSchema })
  check(): HealthDto {
    return this.healthService.check();
  }
}
