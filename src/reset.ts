import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BriefingService } from './modules/briefing/services/briefing.service';
import { SeedService } from './modules/events/services/seed.service';

// `yarn reset`: wipe event + feedback data and re-seed E101 / F01–F08.
async function reset() {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.get(BriefingService).reset();
  await app.get(SeedService).reset();
  await app.close();
  new Logger('reset').log('Reset done: E101 and F01–F08 re-seeded.');
}
void reset();
