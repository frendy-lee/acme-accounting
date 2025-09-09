export const API_ROUTES = {
  TICKETS: 'api/v1/tickets',
  REPORTS: 'api/v1/reports',
  HEALTHCHECK: 'api/v1/healthcheck',
} as const;

export const ERROR_MESSAGES = {
  MULTIPLE_CORPORATE_SECRETARY:
    'Multiple users with role corporateSecretary. Cannot create a ticket',
  MULTIPLE_DIRECTORS:
    'Multiple users with role director. Cannot create a ticket',
  NO_ACCOUNTANT: 'Cannot find user with role accountant to create a ticket',
  NO_CORPORATE_SECRETARY_OR_DIRECTOR:
    'Cannot find user with role corporateSecretary or director to create a ticket',
  NO_DIRECTOR: 'Cannot find user with role director to create a ticket',
  DUPLICATE_REGISTRATION_ADDRESS_CHANGE:
    'Company already has an active registrationAddressChange ticket',
  UNSUPPORTED_TICKET_TYPE: 'Unsupported ticket type',
  UNABLE_TO_DETERMINE_ASSIGNEE: 'Unable to determine assignee for ticket type',
  JOB_NOT_FOUND: 'Job not found',
  INVALID_REPORT_TYPE: 'Invalid report type',
  FAILED_TO_READ_RESULTS: 'Failed to read results',
} as const;

export const REPORT_TYPES = {
  ACCOUNTS: 'accounts',
  YEARLY: 'yearly',
  FS: 'fs',
  ALL: 'all',
} as const;

export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const TIMEOUTS = {
  JOB_CLEANUP_HOURS: 1,
  DEFAULT_RESPONSE_TIMEOUT_MS: 10000,
} as const;

export const PERFORMANCE_METRICS = {
  LEGACY_AVG_SYNC_RESPONSE_TIME_MS: 10000,
  TARGET_RESPONSE_TIME_MS: 100,
} as const;

export const HTTP_STATUS_MESSAGES = {
  REPORT_JOB_CREATED: 'Report job created successfully',
  REPORT_PROCESSING: 'Report is being processed in background',
  REPORT_COMPLETED: 'Report completed successfully',
  REPORT_FAILED: 'Report processing failed',
  REPORT_RETRIEVED: 'Report data retrieved successfully',
  LEGACY_FINISHED: 'finished',
} as const;

export const VALIDATION_MESSAGES = {
  COMPANY_ID_REQUIRED: 'Company ID is required',
  COMPANY_ID_POSITIVE: 'Company ID must be a positive number',
  TICKET_TYPE_REQUIRED: 'Ticket type is required',
  TICKET_TYPE_INVALID: 'Ticket type must be a valid value',
  REPORT_TYPE_INVALID: 'Report type must be one of: accounts, yearly, fs, all',
} as const;
