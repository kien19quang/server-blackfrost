import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { IStoredBriefing } from '../modules/briefing/types/briefing.type';

@Schema({ timestamps: true })
export class BriefingEntity {
  @Prop({ required: true, unique: true })
  eventId: string;

  // The briefing in use. Only written by the first generate, draft replace/merge and coordinator edit.
  @Prop({ type: Object, default: null })
  current: IStoredBriefing | null;

  // Latest regenerated version, disposable. Never touches `current`.
  @Prop({ type: Object, default: null })
  draft: IStoredBriefing | null;
}
export type BriefingDocument = HydratedDocument<BriefingEntity>;
export const BriefingSchema = SchemaFactory.createForClass(BriefingEntity);
