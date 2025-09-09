import {
  Controller,
  Get,
  Post,
  HttpCode,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
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
  createReportJob(@Query('type') type?: string) {
    const validTypes = ['accounts', 'yearly', 'fs', 'all'];
    const reportType = type || 'all';

    if (!validTypes.includes(reportType)) {
      throw new BadRequestException(
        `Invalid report type. Valid types: ${validTypes.join(', ')}`,
      );
    }

    const result = this.reportsService.createJob(
      reportType as 'accounts' | 'yearly' | 'fs' | 'all',
    );

    return {
      jobId: result.jobId,
      type: reportType,
      status: 'pending',
      message: 'Report job created successfully',
      responseTime: `${result.responseTime.toFixed(2)}ms`,
      statusUrl: `/api/v1/reports/status/${result.jobId}`,
      resultUrl: `/api/v1/reports/result/${result.jobId}`,
    };
  }

  @Get('status/:jobId')
  getJobStatus(@Param('jobId') jobId: string) {
    const job = this.reportsService.getJobStatus(jobId);

    if (!job) {
      throw new BadRequestException('Job not found');
    }

    const response: any = {
      jobId: job.jobId,
      type: job.type,
      status: job.status,
      timestamps: {
        created: new Date(job.timestamps.created).toISOString(),
      },
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
      response.processingTime = `${job.metrics.processingTime?.toFixed(2)}ms`;
    }

    if (job.status === 'processing') {
      response.message = 'Report is being processed in background';
    } else if (job.status === 'completed') {
      response.message = 'Report completed successfully';
      response.resultUrl = `/api/v1/reports/result/${jobId}`;
      response.resultPaths = job.resultPaths;
    } else if (job.status === 'failed') {
      response.message = 'Report processing failed';
      response.error = job.errorMessage;
    }

    return response;
  }

  @Get('result/:jobId')
  getJobResult(@Param('jobId') jobId: string) {
    const result = this.reportsService.getJobResult(jobId);

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    return {
      success: true,
      jobId,
      message: 'Report data retrieved successfully',
      data: result.data,
    };
  }

  @Get('metrics')
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
  generateLegacy() {
    this.reportsService.accounts();
    this.reportsService.yearly();
    this.reportsService.fs();
    return { message: 'finished' };
  }
}
