import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { User } from '../../db/models/User';
import { API_ROUTES } from '../common/constants';

@ApiTags('Health')
@Controller(API_ROUTES.HEALTHCHECK)
export class HealthcheckController {
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Check if the API and database are running and healthy',
  })
  @ApiResponse({
    status: 200,
    description: 'API is healthy',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          example: 'ok',
        },
        timestamp: {
          type: 'string',
          example: '2024-01-01T00:00:00.000Z',
        },
        uptime: {
          type: 'number',
          example: 12345.67,
        },
        database: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'connected' },
            userCount: { type: 'number', example: 5 },
          },
        },
        memory: {
          type: 'object',
          properties: {
            rss: { type: 'number' },
            heapUsed: { type: 'number' },
            heapTotal: { type: 'number' },
          },
        },
      },
    },
  })
  async ping() {
    try {
      const users = await User.findAll();
      const memUsage = process.memoryUsage();

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          status: 'connected',
          userCount: users.length,
        },
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
        version: process.version,
        environment: process.env.NODE_ENV || 'development',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown database error';
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: {
          status: 'disconnected',
          error: errorMessage,
        },
      };
    }
  }
}
