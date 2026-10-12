import { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

export interface ITestApp {
  app: INestApplication<App>;
  close: () => Promise<void>;
}

// AppModule (same global pipe/interceptor/filter as production) on a fresh in-memory MongoDB.
// `metadata` adds test-only controllers/providers or MongooseModule.forFeature imports.
export async function createTestApp(metadata: ModuleMetadata = {}): Promise<ITestApp> {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  const moduleRef = await Test.createTestingModule({
    ...metadata,
    imports: [AppModule, ...(metadata.imports ?? [])],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();

  return {
    app,
    close: async () => {
      await app.close();
      await mongod.stop();
    },
  };
}
