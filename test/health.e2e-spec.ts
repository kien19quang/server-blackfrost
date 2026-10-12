import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { createTestApp, type ITestApp } from './utils/test-app';

describe('GET /health (e2e)', () => {
  let t: ITestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('trả trạng thái hệ thống (không cần token)', async () => {
    const res = await request(t.app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toEqual({ data: { status: 'ok', database: 'up' } });
  });

  it('Swagger mô tả response từ healthSchema', () => {
    const doc = SwaggerModule.createDocument(t.app, new DocumentBuilder().build());
    expect(doc.paths['/health'].get?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: {
            properties: {
              status: { type: 'string', enum: ['ok'] },
              database: { type: 'string', enum: ['up', 'down'] },
            },
          },
        },
      },
    });
  });
});
