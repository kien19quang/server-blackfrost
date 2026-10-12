import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { objectIdSchema } from './object-id.schema';
import { paginationQuerySchema } from './pagination.query';
import { validationPipe } from './validation.pipe';

const query = (schema: ArgumentMetadata['schema']): ArgumentMetadata => ({ type: 'query', schema });

// Default exception of StandardSchemaValidationPipe: BadRequestException with one "path: message" per issue.
const messagesOf = (value: unknown, metadata: ArgumentMetadata): Promise<string[]> =>
  validationPipe.transform(value, metadata).then(
    () => [],
    (e: BadRequestException) => (e.getResponse() as { message: string[] }).message,
  );

describe('validationPipe + shared schemas', () => {
  it('applies defaults and coerces numbers for paginationQuerySchema', async () => {
    await expect(validationPipe.transform({}, query(paginationQuerySchema))).resolves.toEqual({ page: 1, limit: 20 });
    await expect(validationPipe.transform({ page: '3', limit: '50' }, query(paginationQuerySchema))).resolves.toEqual({
      page: 3,
      limit: 50,
    });
  });

  it('throws 400 with an English message prefixed by the path', async () => {
    const error: unknown = await validationPipe
      .transform({ limit: '1000' }, query(paginationQuerySchema))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    const [message] = await messagesOf({ limit: '1000' }, query(paginationQuerySchema));
    expect(message).toMatch(/^limit: /);
    expect(message).toContain('100');
    expect(message).toMatch(/too big/i);
  });

  it('throws 400 on unknown fields (strictObject)', async () => {
    const messages = await messagesOf({ page: '1', schoolId: 'x' }, query(paginationQuerySchema));
    expect(messages.join()).toContain('schoolId');
  });

  it('objectIdSchema only accepts 24 hex characters', async () => {
    const param: ArgumentMetadata = { type: 'param', data: 'id', schema: objectIdSchema };
    await expect(validationPipe.transform('652f1c2b9d3e4a0012345678', param)).resolves.toBe('652f1c2b9d3e4a0012345678');
    await expect(messagesOf('abc', param)).resolves.toEqual(['Invalid ID']);
  });

  it('skips params without a schema', async () => {
    await expect(validationPipe.transform({ any: 1 }, { type: 'body' })).resolves.toEqual({ any: 1 });
  });
});
