import { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

export interface ITestApp {
  app: INestApplication<App>;
  close: () => Promise<void>;
}

// AppModule (same global pipe/interceptor/filter as production) on a fresh in-memory MongoDB.
// `override` swaps providers (e.g. the AI provider). `metadata` adds test-only controllers/providers or MongooseModule.forFeature imports.
export async function createTestApp(
  metadata: ModuleMetadata = {},
  override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<ITestApp> {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  const moduleRef = await override(
    Test.createTestingModule({
      ...metadata,
      imports: [AppModule, ...(metadata.imports ?? [])],
    }),
  ).compile();
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
