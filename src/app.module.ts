import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AllExceptionsFilter } from './core/exceptions/all-exceptions.filter';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { validationPipe } from './core/shared/validation.pipe';
import { EventModule } from './modules/events/event.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ uri: config.getOrThrow<string>('MONGODB_URI') }),
    }),
    HealthModule,
    EventModule,
    FeedbackModule,
  ],
  // Global pipe/interceptor/filter are registered here (not in main.ts) so e2e tests built from
  // AppModule run through exactly the same pipeline.
  providers: [
    { provide: APP_PIPE, useValue: validationPipe },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
