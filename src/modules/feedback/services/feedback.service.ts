import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeedbackNote } from '../../../schemas/feedback.schema';
import { FeedbackListDto } from '../dtos/feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(@InjectModel(FeedbackNote.name) private readonly feedbackModel: Model<FeedbackNote>) {}

  async list(eventId: string): Promise<FeedbackListDto> {
    const notes = await this.feedbackModel.find({ eventId }).sort({ feedbackId: 1 }).lean();
    return notes.map((n) => ({ id: n.feedbackId, text: n.text }));
  }
}
