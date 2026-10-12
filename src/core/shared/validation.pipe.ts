import { StandardSchemaValidationPipe } from '@nestjs/common';
import { z } from 'zod';

// Every Zod message in Vietnamese. The pipe prefixes each issue with its path ("limit: ...") and throws 400.
z.config(z.locales.vi());

export const validationPipe = new StandardSchemaValidationPipe();
