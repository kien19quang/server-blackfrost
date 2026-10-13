import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BriefingEntity, BriefingSchema } from '../../schemas/briefing.schema';
import { EventModule } from '../events/event.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { BriefingController } from './controllers/briefing.controller';
import { AiProvider } from './providers/ai.provider';
import { FailProvider } from './providers/fail.provider';
import { MockProvider } from './providers/mock.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { BriefingService } from './services/briefing.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BriefingEntity.name, schema: BriefingSchema }]),
    EventModule,
    FeedbackModule,
  ],
  controllers: [BriefingController],
  providers: [
    BriefingService,
    {
      provide: AiProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AiProvider => {
        const name = config.get<string>('AI_PROVIDER') || 'openai';
        if (name === 'mock') return new MockProvider();
        if (name === 'fail') return new FailProvider();
        // Key stays in the server env (undefined: the SDK falls back to OPENAI_API_KEY); a missing key only fails generation.
        return new OpenAiProvider(
          config.get<string>('AI_API_KEY') || undefined,
          config.get<string>('AI_MODEL') || 'gpt-5.4-mini',
        );
      },
    },
  ],
  exports: [BriefingService],
})
export class BriefingModule {}
