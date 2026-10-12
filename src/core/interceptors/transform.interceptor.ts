import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

export type IResponseEnvelope = { data: unknown };

// Wraps every controller result as `{ data }`.
@Injectable()
export class TransformInterceptor implements NestInterceptor<unknown, IResponseEnvelope> {
  intercept(_: ExecutionContext, next: CallHandler): Observable<IResponseEnvelope> {
    return next.handle().pipe(map((result: unknown) => ({ data: result ?? null })));
  }
}
