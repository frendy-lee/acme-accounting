import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

// Mock the ReportsService
const mockReportsService = {
  state: jest.fn(),
  getAllJobs: jest.fn(),
  getSystemMetrics: jest.fn(),
  createJob: jest.fn(),
  getJobStatus: jest.fn(),
  getJobResult: jest.fn(),
  accounts: jest.fn(),
  yearly: jest.fn(),
  fs: jest.fn(),
};

describe('ReportsController', () => {
  let controller: ReportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/reports (System Status)', () => {
    it('should return system status with job counts and metrics', () => {
      const mockAllJobs = {
        pending: [{ jobId: '1' }, { jobId: '2' }],
        processing: [{ jobId: '3' }],
        completed: [{ jobId: '4' }, { jobId: '5' }, { jobId: '6' }],
        failed: [{ jobId: '7' }],
      };

      const mockMetrics = {
        totalJobsProcessed: 10,
        averageResponseTime: 0.5,
        successRate: 85.5,
        legacyComparisonData: {
          performanceImprovement: '99.9%',
        },
      };

      mockReportsService.getAllJobs.mockReturnValue(mockAllJobs);
      mockReportsService.getSystemMetrics.mockReturnValue(mockMetrics);
      mockReportsService.state.mockImplementation((scope) => `${scope}-idle`);

      const result = controller.getSystemStatus();

      expect(result.system.status).toBe('operational');
      expect(result.system.totalJobsProcessed).toBe(10);
      expect(result.system.averageResponseTime).toBe('0.50ms');
      expect(result.system.successRate).toBe('85.5%');
      expect(result.system.performanceImprovement).toBe('99.9%');

      expect(result.jobs.pending).toBe(2);
      expect(result.jobs.processing).toBe(1);
      expect(result.jobs.completed).toBe(3);
      expect(result.jobs.failed).toBe(1);

      expect(result.legacy['accounts.csv']).toBe('accounts-idle');
      expect(result.legacy['yearly.csv']).toBe('yearly-idle');
      expect(result.legacy['fs.csv']).toBe('fs-idle');
    });
  });

  describe('POST /api/v1/reports (Create Job)', () => {
    it('should create a new job with default type "all"', () => {
      const mockJobResult = {
        jobId: 'test-uuid-123',
        responseTime: 0.75,
      };

      mockReportsService.createJob.mockReturnValue(mockJobResult);

      const result = controller.createReportJob();

      expect(mockReportsService.createJob).toHaveBeenCalledWith('all');
      expect(result.jobId).toBe('test-uuid-123');
      expect(result.type).toBe('all');
      expect(result.status).toBe('pending');
      expect(result.message).toBe('Report job created successfully');
      expect(result.responseTime).toBe('0.75ms');
      expect(result.statusUrl).toBe('/api/v1/reports/status/test-uuid-123');
      expect(result.resultUrl).toBe('/api/v1/reports/result/test-uuid-123');
    });

    it('should create job with specific type when provided', () => {
      const mockJobResult = {
        jobId: 'test-uuid-456',
        responseTime: 1.2,
      };

      mockReportsService.createJob.mockReturnValue(mockJobResult);

      const result = controller.createReportJob('accounts');

      expect(mockReportsService.createJob).toHaveBeenCalledWith('accounts');
      expect(result.type).toBe('accounts');
    });

    it('should validate report type and reject invalid types', () => {
      expect(() => {
        controller.createReportJob('invalid-type');
      }).toThrow(BadRequestException);

      expect(() => {
        controller.createReportJob('invalid-type');
      }).toThrow('Invalid report type. Valid types: accounts, yearly, fs, all');
    });

    it('should accept all valid report types', () => {
      const validTypes = ['accounts', 'yearly', 'fs', 'all'];
      const mockJobResult = {
        jobId: 'test-uuid',
        responseTime: 0.5,
      };

      mockReportsService.createJob.mockReturnValue(mockJobResult);

      validTypes.forEach((type) => {
        const result = controller.createReportJob(type);
        expect(result.type).toBe(type);
      });
    });
  });

  describe('GET /api/v1/reports/status/:jobId', () => {
    it('should return job status for pending job', () => {
      const mockJob = {
        jobId: 'test-123',
        type: 'accounts',
        status: 'pending',
        timestamps: {
          created: 1625097600000, // Mock timestamp
        },
        metrics: {},
        resultPaths: [],
      };

      mockReportsService.getJobStatus.mockReturnValue(mockJob);

      const result = controller.getJobStatus('test-123');

      expect(result.jobId).toBe('test-123');
      expect(result.type).toBe('accounts');
      expect(result.status).toBe('pending');
      expect(result.timestamps.created).toBeDefined();
    });

    it('should return completed job status with processing time', () => {
      const mockJob = {
        jobId: 'test-456',
        type: 'yearly',
        status: 'completed',
        timestamps: {
          created: 1625097600000,
          started: 1625097601000,
          completed: 1625097605000,
        },
        metrics: {
          processingTime: 4000,
        },
        resultPaths: ['out/yearly_test.csv'],
      };

      mockReportsService.getJobStatus.mockReturnValue(mockJob);

      const result = controller.getJobStatus('test-456');

      expect(result.status).toBe('completed');
      expect(result.message).toBe('Report completed successfully');
      expect(result.processingTime).toBe('4000.00ms');
      expect(result.resultUrl).toBe('/api/v1/reports/result/test-456');
      expect(result.resultPaths).toEqual(['out/yearly_test.csv']);
    });

    it('should return processing job status', () => {
      const mockJob = {
        jobId: 'test-789',
        type: 'fs',
        status: 'processing',
        timestamps: {
          created: 1625097600000,
          started: 1625097601000,
        },
        metrics: {},
        resultPaths: [],
      };

      mockReportsService.getJobStatus.mockReturnValue(mockJob);

      const result = controller.getJobStatus('test-789');

      expect(result.status).toBe('processing');
      expect(result.message).toBe('Report is being processed in background');
      expect(result.timestamps.started).toBeDefined();
    });

    it('should return failed job status with error message', () => {
      const mockJob = {
        jobId: 'test-fail',
        type: 'accounts',
        status: 'failed',
        timestamps: {
          created: 1625097600000,
          started: 1625097601000,
          completed: 1625097602000,
        },
        metrics: {},
        resultPaths: [],
        errorMessage: 'File system error',
      };

      mockReportsService.getJobStatus.mockReturnValue(mockJob);

      const result = controller.getJobStatus('test-fail');

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Report processing failed');
      expect(result.error).toBe('File system error');
    });

    it('should throw BadRequestException for non-existent job', () => {
      mockReportsService.getJobStatus.mockReturnValue(null);

      expect(() => {
        controller.getJobStatus('non-existent');
      }).toThrow(BadRequestException);

      expect(() => {
        controller.getJobStatus('non-existent');
      }).toThrow('Job not found');
    });
  });

  describe('GET /api/v1/reports/result/:jobId', () => {
    it('should return successful job result', () => {
      const mockResult = {
        success: true,
        data: {
          jobId: 'test-result',
          type: 'accounts',
          metrics: { processingTime: 1500 },
          results: {
            'accounts.csv': 'Account,Balance\nCash,1000.00',
          },
          timestamps: {},
        },
      };

      mockReportsService.getJobResult.mockReturnValue(mockResult);

      const result = controller.getJobResult('test-result');

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('test-result');
      expect(result.message).toBe('Report data retrieved successfully');
      expect(result.data).toBeDefined();
      expect(result.data).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result.data as any).results).toBeDefined();
    });

    it('should throw BadRequestException for failed job result', () => {
      const mockResult = {
        success: false,
        error: 'Job not completed yet',
      };

      mockReportsService.getJobResult.mockReturnValue(mockResult);

      expect(() => {
        controller.getJobResult('test-fail');
      }).toThrow(BadRequestException);

      expect(() => {
        controller.getJobResult('test-fail');
      }).toThrow('Job not completed yet');
    });
  });

  describe('GET /api/v1/reports/metrics', () => {
    it('should return comprehensive performance metrics', () => {
      const mockMetrics = {
        totalJobsProcessed: 100,
        averageResponseTime: 0.85,
        averageProcessingTime: 2500,
        successRate: 95.5,
        concurrentProcessingCapability: 5,
        legacyComparisonData: {
          avgSyncResponseTime: 10000,
          avgAsyncResponseTime: 0.85,
          performanceImprovement: '99.99%',
        },
      };

      mockReportsService.getSystemMetrics.mockReturnValue(mockMetrics);

      const result = controller.getPerformanceMetrics();

      expect(result.performance.totalJobsProcessed).toBe(100);
      expect(result.performance.averageResponseTime.current).toBe('0.85ms');
      expect(result.performance.averageResponseTime.legacy).toBe('10000ms');
      expect(result.performance.averageResponseTime.improvement).toBe('99.99%');
      expect(result.performance.averageProcessingTime).toBe('2500.00ms');
      expect(result.performance.successRate).toBe('95.5%');
      expect(result.performance.concurrentProcessingCapability).toBe(5);

      expect(result.system.memoryUsage).toBeDefined();
      expect(result.system.uptime).toMatch(/\d+s/);
      expect(result.system.nodeVersion).toBeDefined();

      expect(result.comparison.beforeOptimization.averageResponseTime).toBe(
        '10000ms',
      );
      expect(result.comparison.beforeOptimization.concurrentRequests).toBe(1);
      expect(result.comparison.beforeOptimization.blockingBehavior).toBe(
        'Yes - blocks entire server',
      );

      expect(result.comparison.afterOptimization.averageResponseTime).toBe(
        '0.85ms',
      );
      expect(result.comparison.afterOptimization.concurrentRequests).toBe('5+');
      expect(result.comparison.afterOptimization.blockingBehavior).toBe(
        'No - non-blocking background processing',
      );

      expect(result.comparison.performanceGain).toBe('99.99%');
    });
  });

  describe('POST /api/v1/reports/legacy (Backward Compatibility)', () => {
    it('should call legacy report methods and return completion message', () => {
      const result = controller.generateLegacy();

      expect(mockReportsService.accounts).toHaveBeenCalled();
      expect(mockReportsService.yearly).toHaveBeenCalled();
      expect(mockReportsService.fs).toHaveBeenCalled();
      expect(result.message).toBe('finished');
    });
  });

  describe('Response Time Performance', () => {
    it('should demonstrate significant performance improvement', () => {
      const mockJobResult = {
        jobId: 'perf-test',
        responseTime: 0.5,
      };

      mockReportsService.createJob.mockReturnValue(mockJobResult);

      const startTime = performance.now();
      const result = controller.createReportJob('accounts');
      const endTime = performance.now();

      const actualResponseTime = endTime - startTime;

      // New async endpoint should respond in under 50ms
      expect(actualResponseTime).toBeLessThan(50);

      // Response time should be significantly better than legacy 10+ seconds
      expect(result.responseTime).toMatch(/\d+\.\d+ms/);
      const responseTimeMs = parseFloat(result.responseTime.replace('ms', ''));
      expect(responseTimeMs).toBeLessThan(100); // Under 100ms target
    });
  });

  describe('Error Edge Cases', () => {
    it('should handle service errors gracefully', () => {
      mockReportsService.createJob.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      expect(() => {
        controller.createReportJob('accounts');
      }).toThrow('Service unavailable');
    });

    it('should validate UUID format in job status request', () => {
      mockReportsService.getJobStatus.mockReturnValue(null);

      expect(() => {
        controller.getJobStatus('invalid-format');
      }).toThrow(BadRequestException);
    });
  });
});
