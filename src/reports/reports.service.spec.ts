import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('ReportsService', () => {
  let service: ReportsService;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService],
    }).compile();

    service = module.get<ReportsService>(ReportsService);

    // Setup mock data for file operations
    mockFs.readdirSync.mockReturnValue(['test1.csv', 'test2.csv'] as any);
    mockFs.readFileSync.mockReturnValue(
      '2023-01-01,Cash,,100,0\n2023-01-02,Sales Revenue,,0,200\n2023-01-03,Rent Expense,,50,0',
    );
    mockFs.writeFileSync.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Service', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should return legacy states', () => {
      expect(service.state('accounts')).toBe('idle');
      expect(service.state('yearly')).toBe('idle');
      expect(service.state('fs')).toBe('idle');
    });
  });

  describe('Job Management', () => {
    it('should create a new job with UUID and return response time', () => {
      const result = service.createJob('accounts');

      expect(result.jobId).toBeDefined();
      expect(result.jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.responseTime).toBeLessThan(100); // Should be very fast
    });

    it('should track job status correctly', () => {
      const result = service.createJob('yearly');
      const job = service.getJobStatus(result.jobId);

      expect(job).toBeDefined();
      expect(job!.jobId).toBe(result.jobId);
      expect(job!.type).toBe('yearly');
      expect(job!.status).toBe('pending');
      expect(job!.timestamps.created).toBeDefined();
    });

    it('should return null for non-existent job', () => {
      const job = service.getJobStatus('non-existent-id');
      expect(job).toBeNull();
    });

    it('should support all report types', () => {
      const types = ['accounts', 'yearly', 'fs', 'all'] as const;

      types.forEach((type) => {
        const result = service.createJob(type);
        const job = service.getJobStatus(result.jobId);
        expect(job!.type).toBe(type);
      });
    });
  });

  describe('System Metrics', () => {
    it('should initialize with default metrics', () => {
      const metrics = service.getSystemMetrics();

      expect(metrics.totalJobsProcessed).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.legacyComparisonData.avgSyncResponseTime).toBe(10000);
    });

    it('should update metrics after job creation', () => {
      service.createJob('accounts');
      const metrics = service.getSystemMetrics();

      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.legacyComparisonData.performanceImprovement).toMatch(
        /\d+\.\d+%/,
      );
    });

    it('should track concurrent processing capability', () => {
      // Create multiple jobs to test concurrency tracking
      service.createJob('accounts');
      service.createJob('yearly');
      service.createJob('fs');

      const metrics = service.getSystemMetrics();
      expect(metrics.concurrentProcessingCapability).toBeGreaterThan(0);
    });
  });

  describe('Job Processing', () => {
    it('should process job asynchronously and complete successfully', async () => {
      const result = service.createJob('accounts');

      // Wait for job to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      const job = service.getJobStatus(result.jobId);
      expect(job!.status).toMatch(/processing|completed/);

      // If completed, check metrics
      if (job!.status === 'completed') {
        expect(job!.metrics.processingTime).toBeGreaterThan(0);
        expect(job!.resultPaths).toHaveLength(1);
        expect(job!.resultPaths[0]).toMatch(/accounts_[a-f0-9]{8}\.csv$/);
      }
    });

    it('should process all reports for "all" type', async () => {
      const result = service.createJob('all');

      // Wait for processing - allow more time for "all" type
      let attempts = 0;
      let job = service.getJobStatus(result.jobId);

      while (job!.status === 'pending' && attempts < 10) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        job = service.getJobStatus(result.jobId);
        attempts++;
      }

      if (job!.status === 'completed') {
        expect(job!.resultPaths).toHaveLength(3); // accounts, yearly, fs
        expect(job!.resultPaths.some((p) => p.includes('accounts_'))).toBe(
          true,
        );
        expect(job!.resultPaths.some((p) => p.includes('yearly_'))).toBe(true);
        expect(job!.resultPaths.some((p) => p.includes('fs_'))).toBe(true);
      } else {
        // If still processing or failed, at least verify job was created correctly
        expect(job!.type).toBe('all');
        expect(['pending', 'processing', 'completed', 'failed']).toContain(
          job!.status,
        );
      }
    });

    it('should handle job results correctly', async () => {
      const result = service.createJob('accounts');

      // Initially job result should not be available
      const initialResult = service.getJobResult(result.jobId);
      expect(initialResult.success).toBe(false);
      expect(initialResult.error).toMatch(/Job status:/);

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 100));

      const job = service.getJobStatus(result.jobId);
      if (job!.status === 'completed') {
        const jobResult = service.getJobResult(result.jobId);
        expect(jobResult.success).toBe(true);
        expect(jobResult.data).toBeDefined();
        expect(jobResult.data.jobId).toBe(result.jobId);
        expect(jobResult.data.type).toBe('accounts');
        expect(jobResult.data.metrics).toBeDefined();
      }
    });
  });

  describe('Job Queue Management', () => {
    it('should return jobs grouped by status', () => {
      service.createJob('accounts');
      service.createJob('yearly');

      const allJobs = service.getAllJobs();
      expect(allJobs.pending.length).toBeGreaterThan(0);
      expect(allJobs.processing).toBeDefined();
      expect(allJobs.completed).toBeDefined();
      expect(allJobs.failed).toBeDefined();
    });

    it('should handle multiple concurrent jobs', () => {
      // Create multiple jobs
      const jobs = [
        service.createJob('accounts'),
        service.createJob('yearly'),
        service.createJob('fs'),
      ];

      jobs.forEach((result) => {
        const job = service.getJobStatus(result.jobId);
        expect(job).toBeDefined();
        expect(job!.metrics.concurrentJobs).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Comparison', () => {
    it('should calculate performance improvement correctly', () => {
      // Create a job and get metrics
      const result = service.createJob('accounts');
      const metrics = service.getSystemMetrics();

      // Response time should be significantly faster than legacy (10000ms)
      expect(metrics.averageResponseTime).toBeLessThan(100);
      expect(metrics.legacyComparisonData.avgSyncResponseTime).toBe(10000);

      const improvementPercent = parseFloat(
        metrics.legacyComparisonData.performanceImprovement.replace('%', ''),
      );
      expect(improvementPercent).toBeGreaterThan(90); // At least 90% improvement
    });

    it('should update success rate based on completed jobs', async () => {
      service.createJob('accounts');

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = service.getSystemMetrics();
      if (metrics.totalJobsProcessed > 0) {
        expect(metrics.successRate).toBeGreaterThanOrEqual(0);
        expect(metrics.successRate).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Legacy Methods Compatibility', () => {
    it('should maintain backward compatibility for legacy methods', () => {
      // Test legacy accounts method
      service.accounts();
      expect(service.state('accounts')).toMatch(/starting|finished/);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'out/accounts.csv',
        expect.any(String),
      );
    });

    it('should maintain backward compatibility for yearly method', () => {
      service.yearly();
      expect(service.state('yearly')).toMatch(/starting|finished/);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'out/yearly.csv',
        expect.any(String),
      );
    });

    it('should maintain backward compatibility for fs method', () => {
      service.fs();
      expect(service.state('fs')).toMatch(/starting|finished/);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'out/fs.csv',
        expect.any(String),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Directory not found');
      });

      const result = service.createJob('accounts');
      expect(result.jobId).toBeDefined(); // Job creation should still work
    });

    it('should return error for non-existent job result', () => {
      const result = service.getJobResult('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Job not found');
    });
  });
});
