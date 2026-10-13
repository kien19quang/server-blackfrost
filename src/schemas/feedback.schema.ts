import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class FeedbackNote {
  // Notes belong to one event (collected by that event's feedback form), but are not linked to its members.
  @Prop({ required: true })
  eventId: string;

  // Stable reference ID, unique within the event (see the index below).
  @Prop({ required: true })
  feedbackId: string;

  @Prop({ required: true })
  text: string;
}
export type FeedbackDocument = HydratedDocument<FeedbackNote>;
export const FeedbackSchema = SchemaFactory.createForClass(FeedbackNote);
FeedbackSchema.index({ eventId: 1, feedbackId: 1 }, { unique: true });
