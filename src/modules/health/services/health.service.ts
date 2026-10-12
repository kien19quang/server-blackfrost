import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import { HealthDto } from '../dtos/health.dto';

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  check(): HealthDto {
    return {
      status: 'ok',
      database: this.connection.readyState === ConnectionStates.connected ? 'up' : 'down',
    };
  }
}
