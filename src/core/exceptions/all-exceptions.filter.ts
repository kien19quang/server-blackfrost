import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { omit } from 'lodash';

interface IErrorBody {
  statusCode: number;
  message: string;
  code?: string;
  [extra: string]: unknown;
}

// Single error shape for every client: `{ statusCode, message, code? }`. Never leaks stack traces.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = exception instanceof HttpException ? this.toBody(exception) : this.toInternalBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: HttpException): IErrorBody {
    const res = exception.getResponse();
    // StandardSchemaValidationPipe puts one "path: message" per Zod issue in `message`.
    const message = typeof res === 'object' && 'message' in res ? res.message : exception.message;
    // Extra fields a service put in the response object (e.g. `nextAvailableAt` of the nudge 409) pass through.
    const extra = typeof res === 'object' ? omit(res, ['statusCode', 'message', 'error']) : {};
    return {
      ...extra,
      statusCode: exception.getStatus(),
      message: Array.isArray(message) ? message.join('; ') : String(message),
      ...(exception.errorCode && { code: exception.errorCode }),
    };
  }

  private toInternalBody(exception: unknown): IErrorBody {
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống, vui lòng thử lại sau' };
  }
}
