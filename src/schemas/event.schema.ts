import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AttendanceStatus } from '../modules/events/types/event.type';

@Schema({ _id: false })
export class EventMember {
  @Prop({ required: true })
  memberId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, required: true, enum: Object.values(AttendanceStatus), default: AttendanceStatus.NotRecorded })
  attendance: AttendanceStatus;
}
const eventMemberSchema = SchemaFactory.createForClass(EventMember);

@Schema({ timestamps: true })
export class EventEntity {
  @Prop({ required: true, unique: true })
  eventId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  venue: string;

  @Prop({ required: true })
  status: string;

  @Prop({ type: [eventMemberSchema], default: [] })
  members: EventMember[];
}
export type EventDocument = HydratedDocument<EventEntity>;
export const EventSchema = SchemaFactory.createForClass(EventEntity);
