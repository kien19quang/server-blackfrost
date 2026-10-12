import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeedbackNote } from '../../../schemas/feedback.schema';
import { FeedbackListDto } from '../dtos/feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(@InjectModel(FeedbackNote.name) private readonly feedbackModel: Model<FeedbackNote>) {}

  async list(): Promise<FeedbackListDto> {
    const notes = await this.feedbackModel.find().sort({ feedbackId: 1 }).lean();
    return notes.map((n) => ({ feedbackId: n.feedbackId, text: n.text }));
  }
}
