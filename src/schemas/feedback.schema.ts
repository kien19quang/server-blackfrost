import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class FeedbackNote {
  @Prop({ required: true, unique: true }) feedbackId: string;
  @Prop({ required: true }) text: string;
}
export type FeedbackDocument = HydratedDocument<FeedbackNote>;
export const FeedbackSchema = SchemaFactory.createForClass(FeedbackNote);
