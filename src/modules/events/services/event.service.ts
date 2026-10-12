import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventDocument, EventEntity, EventMember } from '../../../schemas/event.schema';
import { EventResponseDto, UpdateAttendanceDto } from '../dtos/event.dto';
import { AttendanceStatus, EVENT_ID, IAttendanceCounts } from '../types/event.type';

export function countAttendance(members: Pick<EventMember, 'attendance'>[]): IAttendanceCounts {
  const count = (s: AttendanceStatus) => members.filter((m) => m.attendance === s).length;
  return {
    registered: members.length,
    attended: count(AttendanceStatus.Attended),
    absent: count(AttendanceStatus.Absent),
    notRecorded: count(AttendanceStatus.NotRecorded),
  };
}

@Injectable()
export class EventService {
  constructor(
    @InjectModel(EventEntity.name) private readonly eventModel: Model<EventEntity>,
    private readonly config: ConfigService,
  ) {}

  async get(eventId: string): Promise<EventResponseDto> {
    return this.toDto(await this.find(eventId));
  }

  async updateAttendance(eventId: string, dto: UpdateAttendanceDto): Promise<EventResponseDto> {
    if (this.config.get('SIMULATE_SAVE_FAILURE') === 'true') {
      throw new ServiceUnavailableException('Saving is temporarily unavailable (simulated failure).', {
        errorCode: 'EVENT_SAVE_FAILED',
      });
    }
    const event = await this.find(eventId);
    const byId = new Map(event.members.map((m) => [m.memberId, m]));
    const unknown = dto.members.filter((u) => !byId.has(u.memberId)).map((u) => u.memberId);
    if (unknown.length) {
      throw new BadRequestException(`Unknown memberId: ${unknown.join(', ')}`, {
        errorCode: 'EVENT_UNKNOWN_MEMBER',
      });
    }
    for (const u of dto.members) byId.get(u.memberId)!.attendance = u.attendance;
    event.attendanceVersion += 1;
    await event.save();
    return this.toDto(event);
  }

  private async find(eventId: string): Promise<EventDocument> {
    if (eventId !== EVENT_ID) throw new NotFoundException('Event not found');
    const event = await this.eventModel.findOne({ eventId });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private toDto(e: EventDocument): EventResponseDto {
    const members = e.members.map((m) => ({
      memberId: m.memberId,
      name: m.name,
      attendance: m.attendance,
    }));
    return {
      eventId: e.eventId,
      name: e.name,
      venue: e.venue,
      status: e.status,
      attendanceVersion: e.attendanceVersion,
      members,
      counts: countAttendance(members),
    };
  }
}
