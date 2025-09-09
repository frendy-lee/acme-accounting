import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    const errorDetails: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();

      if (typeof errorResponse === 'string') {
        message = errorResponse;
      } else if (typeof errorResponse === 'object' && errorResponse !== null) {
        const errorObj = errorResponse as Record<string, unknown>;
        message =
          typeof errorObj.message === 'string'
            ? errorObj.message
            : typeof errorObj.error === 'string'
              ? errorObj.error
              : 'An error occurred';

        // Include validation errors if present
        if (Array.isArray(errorObj.message)) {
          errorDetails.validationErrors = errorObj.message;
        }
      } else {
        message = 'An error occurred';
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';

      // Log the actual error for debugging
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        AllExceptionsFilter.name,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';

      this.logger.error(
        `Unknown exception type: ${typeof exception}`,
        JSON.stringify(exception),
        AllExceptionsFilter.name,
      );
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...errorDetails,
    };

    // Log all errors for monitoring
    this.logger.error(`HTTP ${status} Error: ${message}`, {
      path: request.url,
      method: request.method,
      statusCode: status,
      userAgent: request.get('User-Agent'),
      ip: request.ip,
      ...errorDetails,
    });

    response.status(status).json(errorResponse);
  }
}
