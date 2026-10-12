import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEntity, EventSchema } from '../../schemas/event.schema';
import { FeedbackNote, FeedbackSchema } from '../../schemas/feedback.schema';
import { EventController } from './controllers/event.controller';
import { EventService } from './services/event.service';
import { SeedService } from './services/seed.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventEntity.name, schema: EventSchema },
      { name: FeedbackNote.name, schema: FeedbackSchema },
    ]),
  ],
  controllers: [EventController],
  providers: [EventService, SeedService],
  exports: [EventService, SeedService, MongooseModule],
})
export class EventModule {}
