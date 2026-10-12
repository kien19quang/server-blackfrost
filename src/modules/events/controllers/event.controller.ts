import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  eventResponseSchema,
  type EventResponseDto,
  updateAttendanceSchema,
  type UpdateAttendanceDto,
} from '../dtos/event.dto';
import { EventService } from '../services/event.service';

@Controller('events')
@ApiTags('Events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get(':eventId')
  @ApiOkResponse({ standardSchema: eventResponseSchema })
  get(@Param('eventId') eventId: string): Promise<EventResponseDto> {
    return this.eventService.get(eventId);
  }

  @Put(':eventId/attendance')
  @ApiOkResponse({ standardSchema: eventResponseSchema })
  updateAttendance(
    @Param('eventId') eventId: string,
    @Body({ schema: updateAttendanceSchema }) dto: UpdateAttendanceDto,
  ): Promise<EventResponseDto> {
    return this.eventService.updateAttendance(eventId, dto);
  }
}
