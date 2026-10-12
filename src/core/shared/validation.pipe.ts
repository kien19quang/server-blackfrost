import { StandardSchemaValidationPipe } from '@nestjs/common';
// Zod's default English messages. The pipe prefixes each issue with its path ("limit: ...") and throws 400.

export const validationPipe = new StandardSchemaValidationPipe();
