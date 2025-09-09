import {
  Controller,
  Get,
  Post,
  HttpCode,
  Param,
  Query,
  BadRequestException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportType } from './dto/create-report-job.dto';
import {
  CreateReportJobResponseDto,
  JobStatusResponseDto,
} from './dto/report-response.dto';
import {
  API_ROUTES,
  REPORT_TYPES,
  ERROR_MESSAGES,
  HTTP_STATUS_MESSAGES,
} from '../common/constants';

@ApiTags('Reports')
@Controller(API_ROUTES.REPORTS)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get system status and metrics',
    description:
      'Retrieve current system status, job statistics, and performance metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'System status retrieved successfully',
  })
  getSystemStatus() {
    const allJobs = this.reportsService.getAllJobs();
    const metrics = this.reportsService.getSystemMetrics();

    return {
      system: {
        status: 'operational',
        totalJobsProcessed: metrics.totalJobsProcessed,
        averageResponseTime: `${metrics.averageResponseTime.toFixed(2)}ms`,
        successRate: `${metrics.successRate.toFixed(1)}%`,
        performanceImprovement:
          metrics.legacyComparisonData.performanceImprovement,
      },
      jobs: {
        pending: allJobs.pending.length,
        processing: allJobs.processing.length,
        completed: allJobs.completed.length,
        failed: allJobs.failed.length,
      },
      legacy: {
        // Backward compatibility - legacy state format
        'accounts.csv': this.reportsService.state('accounts'),
        'yearly.csv': this.reportsService.state('yearly'),
        'fs.csv': this.reportsService.state('fs'),
      },
    };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a new report job',
    description: 'Create a new background report generation job',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: Object.values(REPORT_TYPES),
    description: 'Type of report to generate',
    example: REPORT_TYPES.ALL,
  })
  @ApiResponse({
    status: 201,
    description: 'Report job created successfully',
    type: CreateReportJobResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid report type' })
  createReportJob(@Query('type') type?: string): CreateReportJobResponseDto {
    const validTypes = Object.values(REPORT_TYPES);
    const reportType = (type || REPORT_TYPES.ALL) as ReportType;

    if (!validTypes.includes(reportType)) {
      throw new BadRequestException(
        `${ERROR_MESSAGES.INVALID_REPORT_TYPE}. Valid types: ${validTypes.join(', ')}`,
      );
    }

    const result = this.reportsService.createJob(
      reportType as 'accounts' | 'yearly' | 'fs' | 'all',
    );

    return {
      jobId: result.jobId,
      type: reportType,
      status: 'pending',
      message: HTTP_STATUS_MESSAGES.REPORT_JOB_CREATED,
      responseTime: `${result.responseTime.toFixed(2)}ms`,
      statusUrl: `/${API_ROUTES.REPORTS}/status/${result.jobId}`,
      resultUrl: `/${API_ROUTES.REPORTS}/result/${result.jobId}`,
    };
  }

  @Get('status/:jobId')
  @ApiOperation({
    summary: 'Get job status',
    description: 'Check the status of a report generation job',
  })
  @ApiParam({
    name: 'jobId',
    description: 'The unique job identifier',
    example: '12345678-1234-1234-1234-123456789012',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
    type: JobStatusResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Job not found' })
  getJobStatus(@Param('jobId') jobId: string): JobStatusResponseDto {
    const job = this.reportsService.getJobStatus(jobId);

    if (!job) {
      throw new BadRequestException(ERROR_MESSAGES.JOB_NOT_FOUND);
    }

    const response: JobStatusResponseDto = {
      jobId: job.jobId,
      type: job.type,
      status: job.status,
      timestamps: {
        created: new Date(job.timestamps.created).toISOString(),
      },
      message: '',
    };

    if (job.timestamps.started) {
      response.timestamps.started = new Date(
        job.timestamps.started,
      ).toISOString();
    }

    if (job.timestamps.completed) {
      response.timestamps.completed = new Date(
        job.timestamps.completed,
      ).toISOString();
      response.processingTime = `${job.metrics?.processingTime?.toFixed(2) ?? 0}ms`;
    }

    if (job.status === 'processing') {
      response.message = HTTP_STATUS_MESSAGES.REPORT_PROCESSING;
    } else if (job.status === 'completed') {
      response.message = HTTP_STATUS_MESSAGES.REPORT_COMPLETED;
      response.resultUrl = `/${API_ROUTES.REPORTS}/result/${jobId}`;
      response.resultPaths = job.resultPaths;
    } else if (job.status === 'failed') {
      response.message = HTTP_STATUS_MESSAGES.REPORT_FAILED;
      if (job.errorMessage) {
        response.error = job.errorMessage;
      }
    }

    return response;
  }

  @Get('result/:jobId')
  @ApiOperation({
    summary: 'Get job result',
    description: 'Retrieve the results of a completed report generation job',
  })
  @ApiParam({
    name: 'jobId',
    description: 'The unique job identifier',
    example: '12345678-1234-1234-1234-123456789012',
  })
  @ApiResponse({
    status: 200,
    description: 'Report data retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Job not found or not completed' })
  getJobResult(@Param('jobId') jobId: string) {
    const result = this.reportsService.getJobResult(jobId);

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    return {
      success: true,
      jobId,
      message: HTTP_STATUS_MESSAGES.REPORT_RETRIEVED,
      data: result.data as unknown,
    };
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Get performance metrics',
    description:
      'Retrieve detailed performance metrics and system comparison data',
  })
  @ApiResponse({
    status: 200,
    description: 'Performance metrics retrieved successfully',
  })
  getPerformanceMetrics() {
    const metrics = this.reportsService.getSystemMetrics();

    return {
      performance: {
        totalJobsProcessed: metrics.totalJobsProcessed,
        averageResponseTime: {
          current: `${metrics.averageResponseTime.toFixed(2)}ms`,
          legacy: `${metrics.legacyComparisonData.avgSyncResponseTime}ms`,
          improvement: metrics.legacyComparisonData.performanceImprovement,
        },
        averageProcessingTime: `${metrics.averageProcessingTime.toFixed(2)}ms`,
        successRate: `${metrics.successRate.toFixed(1)}%`,
        concurrentProcessingCapability: metrics.concurrentProcessingCapability,
      },
      system: {
        memoryUsage: process.memoryUsage(),
        uptime: `${Math.floor(process.uptime())}s`,
        nodeVersion: process.version,
      },
      comparison: {
        beforeOptimization: {
          averageResponseTime: `${metrics.legacyComparisonData.avgSyncResponseTime}ms`,
          concurrentRequests: 1,
          blockingBehavior: 'Yes - blocks entire server',
        },
        afterOptimization: {
          averageResponseTime: `${metrics.legacyComparisonData.avgAsyncResponseTime.toFixed(2)}ms`,
          concurrentRequests: `${metrics.concurrentProcessingCapability}+`,
          blockingBehavior: 'No - non-blocking background processing',
        },
        performanceGain: metrics.legacyComparisonData.performanceImprovement,
      },
    };
  }

  // Legacy endpoint for backward compatibility
  @Post('legacy')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Generate legacy reports',
    description:
      'Generate reports using the legacy synchronous method (for backward compatibility)',
  })
  @ApiResponse({
    status: 201,
    description: 'Legacy reports generated successfully',
  })
  generateLegacy() {
    this.reportsService.accounts();
    this.reportsService.yearly();
    this.reportsService.fs();
    return { message: HTTP_STATUS_MESSAGES.LEGACY_FINISHED };
  }
}
