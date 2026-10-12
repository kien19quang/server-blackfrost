import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEntity } from '../../../schemas/event.schema';
import { FeedbackNote } from '../../../schemas/feedback.schema';
import { AttendanceStatus as A, EVENT_ID } from '../types/event.type';

const SEED_EVENT = {
  eventId: EVENT_ID,
  name: 'Saturday Walk',
  venue: 'Harbour Community Club',
  status: 'ended',
  attendanceVersion: 0,
  members: [
    { memberId: 'M01', name: 'Alex', attendance: A.Attended },
    { memberId: 'M02', name: 'Bea', attendance: A.Absent },
    { memberId: 'M03', name: 'Chris', attendance: A.NotRecorded },
    { memberId: 'M04', name: 'Drew', attendance: A.Absent },
  ],
};

const SEED_FEEDBACK = [
  'The walk was enjoyable, but the meeting point was difficult to find.',
  'Clear directions. I had no trouble finding the group.',
  'Could we start earlier next time?',
  'An earlier start would be difficult for me.',
  'A longer rest break halfway would help.',
  'The rest stop felt rushed; a few more minutes would be good.',
  'Could we try a shorter route? The final stretch felt long.',
  'No extra suggestions from me.',
].map((text, i) => ({ feedbackId: `F0${i + 1}`, text }));

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(EventEntity.name) private readonly eventModel: Model<EventEntity>,
    @InjectModel(FeedbackNote.name) private readonly feedbackModel: Model<FeedbackNote>,
  ) {}

  onApplicationBootstrap(): Promise<void> {
    return this.seed();
  }

  // Idempotent: $setOnInsert never overwrites existing documents, so restarts keep saved edits.
  async seed(): Promise<void> {
    await this.eventModel.updateOne({ eventId: EVENT_ID }, { $setOnInsert: SEED_EVENT }, { upsert: true });
    await this.feedbackModel.bulkWrite(
      SEED_FEEDBACK.map((f) => ({
        updateOne: {
          filter: { feedbackId: f.feedbackId },
          update: { $setOnInsert: f },
          upsert: true,
        },
      })),
    );
  }

  // Explicit reset (`yarn reset`): wipes event data and re-seeds.
  async reset(): Promise<void> {
    await this.eventModel.deleteMany({});
    await this.feedbackModel.deleteMany({});
    await this.seed();
  }
}
