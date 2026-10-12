import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BriefingDocument, BriefingEntity } from '../../../schemas/briefing.schema';
import { EventService } from '../../events/services/event.service';
import { EVENT_ID } from '../../events/types/event.type';
import { FeedbackService } from '../../feedback/services/feedback.service';
import { aiBriefingSchema, BriefingStateDto, UpdateBriefingDto } from '../dtos/briefing.dto';
import { AiProvider } from '../providers/ai.provider';
import type { IBriefingItem, IStoredBriefing } from '../types/briefing.type';

@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(
    @InjectModel(BriefingEntity.name) private readonly briefingModel: Model<BriefingEntity>,
    private readonly eventService: EventService,
    private readonly feedbackService: FeedbackService,
    private readonly provider: AiProvider,
    private readonly config: ConfigService,
  ) {}

  async get(): Promise<BriefingStateDto> {
    return this.toState(await this.findOrCreate());
  }

  // No current yet: the result becomes current. Otherwise it only replaces the draft.
  async generate(): Promise<BriefingStateDto> {
    this.assertSaveAllowed();
    const event = await this.eventService.get(EVENT_ID);
    const feedback = await this.feedbackService.list();
    const content = await this.callProvider({
      eventName: event.name,
      venue: event.venue,
      members: event.members.map((m) => ({ memberId: m.memberId, name: m.name, attendance: m.attendance })),
      counts: event.counts,
      feedback,
    });
    const now = new Date();
    const generated: IStoredBriefing = {
      ...content,
      attendanceSnapshot: event.counts,
      model: this.provider.model,
      generatedAt: now,
      attendanceVersion: event.attendanceVersion,
      editedByHuman: false,
      updatedAt: now,
    };
    const doc = await this.findOrCreate();
    if (doc.current) doc.draft = generated;
    else doc.current = generated;
    await doc.save();
    return this.toState(doc);
  }

  async replaceWithDraft(): Promise<BriefingStateDto> {
    this.assertSaveAllowed();
    const doc = await this.findOrCreate();
    if (!doc.draft) throw this.noDraft();
    doc.current = { ...doc.draft, editedByHuman: false, updatedAt: new Date() };
    doc.draft = null;
    await doc.save();
    return this.toState(doc);
  }

  async discardDraft(): Promise<BriefingStateDto> {
    this.assertSaveAllowed();
    const doc = await this.findOrCreate();
    if (!doc.draft) throw this.noDraft();
    doc.draft = null;
    await doc.save();
    return this.toState(doc);
  }

  async update(dto: UpdateBriefingDto): Promise<BriefingStateDto> {
    this.assertSaveAllowed();
    const doc = await this.findOrCreate();
    if (!doc.current) {
      throw new NotFoundException('No briefing to edit. Generate one first.', { errorCode: 'BRIEFING_NOT_FOUND' });
    }
    doc.current = { ...doc.current, ...dto, editedByHuman: true, updatedAt: new Date() };
    await doc.save();
    return this.toState(doc);
  }

  // `yarn reset`: briefings belong to the seeded event, so they go too.
  async reset(): Promise<void> {
    await this.briefingModel.deleteMany({});
  }

  private assertSaveAllowed(): void {
    if (this.config.get('SIMULATE_SAVE_FAILURE') === 'true') {
      throw new ServiceUnavailableException('Saving is temporarily unavailable (simulated failure).', {
        errorCode: 'SAVE_FAILED_SIMULATED',
      });
    }
  }

  private noDraft(): ConflictException {
    return new ConflictException('There is no draft to apply or discard.', { errorCode: 'BRIEFING_NO_DRAFT' });
  }

  // Provider errors and JSON that does not match the schema are both generation failures.
  private async callProvider(input: Parameters<AiProvider['generate']>[0]) {
    try {
      return aiBriefingSchema.parse(await this.provider.generate(input));
    } catch (error) {
      this.logger.error(`Briefing generation failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadGatewayException('Could not generate the briefing. Your current briefing is unchanged.', {
        errorCode: 'BRIEFING_GENERATION_FAILED',
      });
    }
  }

  private findOrCreate(): Promise<BriefingDocument> {
    return this.briefingModel.findOneAndUpdate(
      { eventId: EVENT_ID },
      { $setOnInsert: { eventId: EVENT_ID, current: null, draft: null } },
      { upsert: true, new: true },
    );
  }

  private async toState(doc: BriefingDocument): Promise<BriefingStateDto> {
    const [event, feedback] = await Promise.all([this.eventService.get(EVENT_ID), this.feedbackService.list()]);
    const known = new Set(feedback.map((f) => f.feedbackId));
    const item = <T extends IBriefingItem>(i: T) => ({
      ...i,
      unverifiedFeedbackIds: i.feedbackIds.filter((id) => !known.has(id)),
    });
    const view = (b: IStoredBriefing | null) =>
      b && {
        ...b,
        themes: b.themes.map(item),
        conflicts: b.conflicts.map(item),
        followUps: b.followUps.map(item),
        generatedAt: new Date(b.generatedAt).toISOString(),
        updatedAt: new Date(b.updatedAt).toISOString(),
      };
    return {
      current: view(doc.current),
      draft: view(doc.draft),
      stale: doc.current !== null && doc.current.attendanceVersion !== event.attendanceVersion,
      attendanceVersion: event.attendanceVersion,
    };
  }
}
