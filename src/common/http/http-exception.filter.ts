import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../domain/domain.error';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();
    const statusCode =
      exception instanceof DomainError
        ? exception.statusCode
        : exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const response =
      exception instanceof DomainError
        ? { code: exception.code, message: exception.message, details: exception.details }
        : exception instanceof HttpException
          ? exception.getResponse()
          : undefined;
    const message =
      typeof response === 'object' && response && 'message' in response
        ? response.message
        : statusCode === 500
          ? 'Internal server error'
          : typeof response === 'string'
            ? response
            : 'Request failed';
    const code =
      typeof response === 'object' && response && 'code' in response
        ? String(response.code)
        : statusCode === 500
          ? 'INTERNAL_ERROR'
          : 'HTTP_ERROR';

    void reply.status(statusCode).send({
      statusCode,
      code,
      message,
      ...(typeof response === 'object' && response && 'details' in response && response.details
        ? { details: response.details }
        : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.id,
    });
  }
}
