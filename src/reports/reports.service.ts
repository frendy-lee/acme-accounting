import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';

interface JobMetrics {
  responseTime?: number;
  processingTime?: number;
  memoryUsage?: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    peak: number;
  };
  filesSizes?: number[];
  concurrentJobs?: number;
}

interface JobData {
  jobId: string;
  type: 'accounts' | 'yearly' | 'fs' | 'all';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timestamps: {
    created: number;
    started?: number;
    completed?: number;
  };
  metrics: JobMetrics;
  resultPaths: string[];
  errorMessage?: string;
}

interface SystemMetrics {
  totalJobsProcessed: number;
  averageResponseTime: number;
  averageProcessingTime: number;
  concurrentProcessingCapability: number;
  memoryEfficiency: number;
  successRate: number;
  legacyComparisonData: {
    avgSyncResponseTime: number;
    avgAsyncResponseTime: number;
    performanceImprovement: string;
  };
}

@Injectable()
export class ReportsService {
  private jobs = new Map<string, JobData>();
  private jobQueue: string[] = [];
  private isProcessing = false;
  private systemMetrics: SystemMetrics = {
    totalJobsProcessed: 0,
    averageResponseTime: 0,
    averageProcessingTime: 0,
    concurrentProcessingCapability: 0,
    memoryEfficiency: 0,
    successRate: 0,
    legacyComparisonData: {
      avgSyncResponseTime: 10000, // Baseline: 10 seconds
      avgAsyncResponseTime: 0,
      performanceImprovement: '0%',
    },
  };

  // Legacy states for backward compatibility
  private states = {
    accounts: 'idle',
    yearly: 'idle',
    fs: 'idle',
  };

  state(scope: string) {
    return this.states[scope];
  }

  // New job management methods
  createJob(type: 'accounts' | 'yearly' | 'fs' | 'all'): {
    jobId: string;
    responseTime: number;
  } {
    const responseStart = performance.now();
    const jobId = randomUUID();

    const job: JobData = {
      jobId,
      type,
      status: 'pending',
      timestamps: {
        created: performance.now(),
      },
      metrics: {
        concurrentJobs: this.jobQueue.length + 1,
      },
      resultPaths: [],
    };

    this.jobs.set(jobId, job);
    this.jobQueue.push(jobId);

    // Update concurrent processing capability immediately when job is created
    const currentJobCount = this.jobs.size;
    this.systemMetrics.concurrentProcessingCapability = Math.max(
      this.systemMetrics.concurrentProcessingCapability,
      currentJobCount,
    );

    // Start processing if not already running
    if (!this.isProcessing) {
      setImmediate(() => this.processQueue());
    }

    const responseTime = performance.now() - responseStart;

    // Update system metrics
    this.updateResponseTimeMetrics(responseTime);

    return { jobId, responseTime };
  }

  getJobStatus(jobId: string): JobData | null {
    return this.jobs.get(jobId) || null;
  }

  getJobResult(jobId: string): {
    success: boolean;
    data?: any;
    error?: string;
  } {
    const job = this.jobs.get(jobId);

    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    if (job.status !== 'completed') {
      return { success: false, error: `Job status: ${job.status}` };
    }

    try {
      const results: any = {};
      for (const resultPath of job.resultPaths) {
        const fileName = path.basename(resultPath);
        results[fileName] = fs.readFileSync(resultPath, 'utf-8');
      }

      return {
        success: true,
        data: {
          jobId: job.jobId,
          type: job.type,
          metrics: job.metrics,
          results,
          timestamps: job.timestamps,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read results: ${error.message}`,
      };
    }
  }

  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  getAllJobs(): { [status: string]: JobData[] } {
    const jobsByStatus: { [status: string]: JobData[] } = {
      pending: [],
      processing: [],
      completed: [],
      failed: [],
    };

    for (const job of this.jobs.values()) {
      jobsByStatus[job.status].push(job);
    }

    return jobsByStatus;
  }

  // Background processing and metrics methods
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.jobQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.jobQueue.length > 0) {
      const jobId = this.jobQueue.shift()!;
      const job = this.jobs.get(jobId);

      if (!job) continue;

      try {
        await this.processJob(job);
      } catch (error) {
        job.status = 'failed';
        job.errorMessage = error.message;
        job.timestamps.completed = performance.now();
      }

      this.updateSystemMetrics(job);
      this.cleanupOldJobs();
    }

    this.isProcessing = false;
  }

  private async processJob(job: JobData): Promise<void> {
    job.status = 'processing';
    job.timestamps.started = performance.now();
    job.metrics.memoryUsage = {
      before: process.memoryUsage(),
      after: {
        rss: 0,
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        arrayBuffers: 0,
      },
      peak: 0,
    };

    try {
      if (job.type === 'all') {
        await this.processAllReports(job);
      } else {
        await this.processSingleReport(job, job.type);
      }

      job.status = 'completed';
    } catch (error) {
      job.status = 'failed';
      job.errorMessage = error.message;
      throw error;
    } finally {
      job.timestamps.completed = performance.now();
      job.metrics.processingTime =
        job.timestamps.completed - job.timestamps.started;
      job.metrics.memoryUsage.after = process.memoryUsage();
    }
  }

  private async processAllReports(job: JobData): Promise<void> {
    await this.processSingleReport(job, 'accounts');
    await this.processSingleReport(job, 'yearly');
    await this.processSingleReport(job, 'fs');
  }

  private async processSingleReport(
    job: JobData,
    type: 'accounts' | 'yearly' | 'fs',
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          switch (type) {
            case 'accounts':
              this.generateAccountsReport(job);
              break;
            case 'yearly':
              this.generateYearlyReport(job);
              break;
            case 'fs':
              this.generateFsReport(job);
              break;
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private updateResponseTimeMetrics(responseTime: number): void {
    const currentAvg = this.systemMetrics.averageResponseTime;
    const totalJobs = this.systemMetrics.totalJobsProcessed || 1;

    this.systemMetrics.averageResponseTime =
      (currentAvg * (totalJobs - 1) + responseTime) / totalJobs;

    this.systemMetrics.legacyComparisonData.avgAsyncResponseTime =
      this.systemMetrics.averageResponseTime;

    const improvement =
      ((this.systemMetrics.legacyComparisonData.avgSyncResponseTime -
        this.systemMetrics.averageResponseTime) /
        this.systemMetrics.legacyComparisonData.avgSyncResponseTime) *
      100;

    this.systemMetrics.legacyComparisonData.performanceImprovement = `${improvement.toFixed(1)}%`;
  }

  private updateSystemMetrics(job: JobData): void {
    this.systemMetrics.totalJobsProcessed++;

    if (job.metrics.processingTime) {
      const currentAvg = this.systemMetrics.averageProcessingTime;
      const totalJobs = this.systemMetrics.totalJobsProcessed;

      this.systemMetrics.averageProcessingTime =
        (currentAvg * (totalJobs - 1) + job.metrics.processingTime) / totalJobs;
    }

    const completedJobs = Array.from(this.jobs.values()).filter(
      (j) => j.status === 'completed' || j.status === 'failed',
    );

    const successfulJobs = completedJobs.filter(
      (j) => j.status === 'completed',
    );
    this.systemMetrics.successRate =
      completedJobs.length > 0
        ? (successfulJobs.length / completedJobs.length) * 100
        : 0;

    // Track the maximum concurrent jobs we've seen
    const currentJobCount = Array.from(this.jobs.values()).length;
    this.systemMetrics.concurrentProcessingCapability = Math.max(
      this.systemMetrics.concurrentProcessingCapability,
      currentJobCount,
    );
  }

  private cleanupOldJobs(): void {
    const oneHourAgo = performance.now() - 60 * 60 * 1000; // 1 hour

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.timestamps.completed && job.timestamps.completed < oneHourAgo) {
        this.jobs.delete(jobId);
      }
    }
  }

  // Enhanced report generation methods
  private generateAccountsReport(job: JobData): void {
    const outputFile = `out/accounts_${job.jobId.slice(0, 8)}.csv`;
    job.resultPaths.push(outputFile);
    this.accountsLogic(outputFile);
  }

  private generateYearlyReport(job: JobData): void {
    const outputFile = `out/yearly_${job.jobId.slice(0, 8)}.csv`;
    job.resultPaths.push(outputFile);
    this.yearlyLogic(outputFile);
  }

  private generateFsReport(job: JobData): void {
    const outputFile = `out/fs_${job.jobId.slice(0, 8)}.csv`;
    job.resultPaths.push(outputFile);
    this.fsLogic(outputFile);
  }

  // Core report logic methods (extracted from original methods)
  private accountsLogic(outputFile: string): void {
    const tmpDir = 'tmp';
    const accountBalances: Record<string, number> = {};
    fs.readdirSync(tmpDir).forEach((file) => {
      if (file.endsWith('.csv')) {
        const lines = fs
          .readFileSync(path.join(tmpDir, file), 'utf-8')
          .trim()
          .split('\n');
        for (const line of lines) {
          const [, account, , debit, credit] = line.split(',');
          if (!accountBalances[account]) {
            accountBalances[account] = 0;
          }
          accountBalances[account] +=
            parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
        }
      }
    });
    const output = ['Account,Balance'];
    for (const [account, balance] of Object.entries(accountBalances)) {
      output.push(`${account},${balance.toFixed(2)}`);
    }
    fs.writeFileSync(outputFile, output.join('\n'));
  }

  private yearlyLogic(outputFile: string): void {
    const tmpDir = 'tmp';
    const cashByYear: Record<string, number> = {};
    fs.readdirSync(tmpDir).forEach((file) => {
      if (file.endsWith('.csv') && file !== 'yearly.csv') {
        const lines = fs
          .readFileSync(path.join(tmpDir, file), 'utf-8')
          .trim()
          .split('\n');
        for (const line of lines) {
          const [date, account, , debit, credit] = line.split(',');
          if (account === 'Cash') {
            const year = new Date(date).getFullYear();
            if (!cashByYear[year]) {
              cashByYear[year] = 0;
            }
            cashByYear[year] +=
              parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
          }
        }
      }
    });
    const output = ['Financial Year,Cash Balance'];
    Object.keys(cashByYear)
      .sort()
      .forEach((year) => {
        output.push(`${year},${cashByYear[year].toFixed(2)}`);
      });
    fs.writeFileSync(outputFile, output.join('\n'));
  }

  private fsLogic(outputFile: string): void {
    const tmpDir = 'tmp';
    const categories = {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };
    const balances: Record<string, number> = {};
    for (const section of Object.values(categories)) {
      for (const group of Object.values(section)) {
        for (const account of group) {
          balances[account] = 0;
        }
      }
    }
    fs.readdirSync(tmpDir).forEach((file) => {
      if (file.endsWith('.csv') && file !== 'fs.csv') {
        const lines = fs
          .readFileSync(path.join(tmpDir, file), 'utf-8')
          .trim()
          .split('\n');

        for (const line of lines) {
          const [, account, , debit, credit] = line.split(',');

          if (balances.hasOwnProperty(account)) {
            balances[account] +=
              parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
          }
        }
      }
    });

    const output: string[] = [];
    output.push('Basic Financial Statement');
    output.push('');
    output.push('Income Statement');
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const account of categories['Income Statement']['Revenues']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalRevenue += value;
    }
    for (const account of categories['Income Statement']['Expenses']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalExpenses += value;
    }
    output.push(`Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`);
    output.push('');
    output.push('Balance Sheet');
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    output.push('Assets');
    for (const account of categories['Balance Sheet']['Assets']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalAssets += value;
    }
    output.push(`Total Assets,${totalAssets.toFixed(2)}`);
    output.push('');
    output.push('Liabilities');
    for (const account of categories['Balance Sheet']['Liabilities']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalLiabilities += value;
    }
    output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
    output.push('');
    output.push('Equity');
    for (const account of categories['Balance Sheet']['Equity']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalEquity += value;
    }
    output.push(
      `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}`,
    );
    totalEquity += totalRevenue - totalExpenses;
    output.push(`Total Equity,${totalEquity.toFixed(2)}`);
    output.push('');
    output.push(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
    );
    fs.writeFileSync(outputFile, output.join('\n'));
  }

  // Legacy methods for backward compatibility
  accounts() {
    this.states.accounts = 'starting';
    const start = performance.now();
    const outputFile = 'out/accounts.csv';

    this.accountsLogic(outputFile);

    this.states.accounts = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }

  yearly() {
    this.states.yearly = 'starting';
    const start = performance.now();
    const outputFile = 'out/yearly.csv';

    this.yearlyLogic(outputFile);

    this.states.yearly = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }

  fs() {
    this.states.fs = 'starting';
    const start = performance.now();
    const outputFile = 'out/fs.csv';

    this.fsLogic(outputFile);

    this.states.fs = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }
}
