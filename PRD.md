# Product Requirements Document (PRD)
## ACME Accounting System - Enhancement Tasks

### Overview
This document outlines all requirements and tasks for enhancing the ACME Accounting system based on new business requirements. The system manages companies, users, tickets, and generates accounting reports.

---

## Current System Analysis

### Architecture
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Sequelize ORM
- **Models**: Company, User, Ticket
- **Key Endpoints**: 
  - `GET /api/v1/tickets` - List all tickets
  - `POST /api/v1/tickets` - Create new ticket
  - `GET /api/v1/report` - Generate reports (synchronous)

### Current Business Rules
1. **managementReport** tickets:
   - Category: `accounting`
   - Assignee: Most recent `Accountant`
   - Error if no accountant found

2. **registrationAddressChange** tickets:
   - Category: `corporate` 
   - Assignee: `Corporate Secretary`
   - Error if multiple secretaries or none found

### Current User Roles
- `accountant`
- `corporateSecretary`

### Current Ticket Types
- `managementReport`
- `registrationAddressChange`

---

## Task 1: Change Requests

### Requirements
1. **Duplication Prevention**: When creating a `registrationAddressChange` ticket, throw error if company already has this ticket type
2. **Director Role**: Add new `Director` user role as fallback for `registrationAddressChange` tickets

### Business Logic Changes
- If `registrationAddressChange` ticket creation and no `Corporate Secretary` found → assign to `Director`
- If multiple `Director` users → throw error
- Priority: Corporate Secretary > Director > Error

### Technical Implementation
- [ ] Add `Director` to `UserRole` enum in `User.ts`
- [ ] Update ticket creation logic in `tickets.controller.ts`
- [ ] Add duplication check query before ticket creation
- [ ] Update assignment logic with fallback hierarchy
- [ ] Add appropriate error messages

### Acceptance Criteria
- ✅ Cannot create duplicate `registrationAddressChange` tickets for same company
- ✅ `Director` role available as user role option
- ✅ Fallback assignment works: Corporate Secretary → Director → Error
- ✅ Clear error messages for all edge cases

---

## Task 2: New Ticket Type - Strike Off

### Requirements
Create new ticket type for company closure scenarios.

### New Ticket Specification
```json
{
  "type": "strikeOff",
  "category": "Management",
  "assignee": "Director"
}
```

### Business Rules
- **Assignee**: `Director` role required
- **Error Condition**: Multiple directors → throw error
- **Side Effects**: Resolve all other active tickets in the company (company is closing)

### Technical Implementation
- [ ] Add `strikeOff` to `TicketType` enum
- [ ] Add `Management` to `TicketCategory` enum (fix existing enum issue)
- [ ] Update ticket creation logic for new type
- [ ] Implement ticket resolution side effect
- [ ] Add database transaction for consistency

### Acceptance Criteria
- ✅ `strikeOff` tickets can be created successfully
- ✅ Assigned to single `Director`, error if multiple
- ✅ All other active company tickets automatically resolved
- ✅ Database operations are atomic (transaction-based)

---

## Task 3: Performance Optimization

### Current Problem
Report generation (`GET /api/v1/report`) is synchronous and blocks client connection while processing large datasets.

### Requirements
1. **Async Processing**: Report generation runs in background
2. **Faster Response**: Endpoint responds immediately
3. **Status Tracking**: Client can check processing status
4. **Performance Focus**: Speed over accuracy (acceptable data inconsistencies)

### Technical Architecture
```
Client Request → Immediate Response with Job ID → Background Processing → Status Endpoint
```

### Implementation Plan
- [ ] Create background job system for report processing
- [ ] Add job status tracking (idle, processing, completed, failed)
- [ ] Modify report endpoint to return immediately with job ID
- [ ] Add status check endpoint: `GET /api/v1/report/status/:jobId`
- [ ] Add metrics collection for performance analysis
- [ ] Optimize report algorithms for speed

### New Endpoints
- `POST /api/v1/report` → Returns job ID immediately
- `GET /api/v1/report/status/:jobId` → Returns processing status
- `GET /api/v1/report/result/:jobId` → Returns completed report

### Performance Metrics
- Response time comparison (before/after)
- Processing time tracking
- Memory usage monitoring
- Concurrent processing capability

### Acceptance Criteria
- ✅ Report endpoint responds < 100ms (vs current 10+ seconds)
- ✅ Background processing works without blocking
- ✅ Client can check processing status
- ✅ Performance metrics collected and logged
- ✅ System handles multiple concurrent report requests

---

## Code Quality Issues to Fix

### Current Issues Identified
1. **TicketCategory Enum Bug**: 
   - Line 25 in `Ticket.ts`: `registrationAddressChange` should be `corporate`
2. **Missing Error Handling**: Limited validation and error scenarios
3. **No Integration Tests**: Current test coverage gaps
4. **Hardcoded Values**: Magic strings and numbers throughout codebase

### Stretch Goals
- [ ] **Code Quality**: Fix enum bug, add validation, improve error handling
- [ ] **Testing**: Add comprehensive integration tests for all new features
- [ ] **Performance**: Add database indexing, query optimization
- [ ] **Documentation**: Update API documentation, add inline comments
- [ ] **Monitoring**: Add logging, metrics, health checks
- [ ] **Security**: Input validation, SQL injection prevention

---

## Database Schema Changes

### New Enums/Values
```typescript
// User.ts
export enum UserRole {
  accountant = 'accountant',
  corporateSecretary = 'corporateSecretary',
  director = 'director', // NEW
}

// Ticket.ts
export enum TicketType {
  managementReport = 'managementReport',
  registrationAddressChange = 'registrationAddressChange',
  strikeOff = 'strikeOff', // NEW
}

export enum TicketCategory {
  accounting = 'accounting',
  corporate = 'corporate', // FIXED: was 'registrationAddressChange'
  management = 'management', // NEW
}
```

### New Tables (for Task 3)
```sql
-- Report Jobs tracking
CREATE TABLE report_jobs (
  id SERIAL PRIMARY KEY,
  job_id UUID UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  result_path VARCHAR(255),
  error_message TEXT
);
```

---

## Implementation Timeline

### Phase 1: Core Fixes (Priority: High)
1. Fix TicketCategory enum bug
2. Add Director user role
3. Implement Task 1 requirements

### Phase 2: New Features (Priority: High)
1. Implement strikeOff ticket type
2. Add ticket resolution side effects
3. Complete Task 2 requirements

### Phase 3: Performance (Priority: Medium)
1. Design background job system
2. Implement async report processing
3. Add status tracking endpoints
4. Complete Task 3 requirements

### Phase 4: Quality & Testing (Priority: Low)
1. Add comprehensive tests
2. Code quality improvements
3. Performance monitoring
4. Documentation updates

---

## Success Metrics

### Functional Requirements
- All 3 main tasks completed successfully
- All acceptance criteria met
- No regression in existing functionality

### Non-Functional Requirements
- Report generation response time: < 100ms (from 10+ seconds)
- System handles 10+ concurrent report requests
- Code coverage > 80% for new features
- Zero critical security vulnerabilities

### Business Impact
- Support for company closure scenarios
- Improved user experience with faster reports
- Reduced server resource blocking
- Enhanced system reliability and monitoring

---

## Risk Assessment

### High Risk
- **Database Schema Changes**: Potential data migration issues
- **Background Job System**: Complexity in failure handling

### Medium Risk  
- **Performance Optimization**: May introduce new bugs
- **Business Logic Changes**: Edge cases in ticket assignment

### Low Risk
- **New Ticket Type**: Straightforward addition
- **Code Quality**: Improvements with minimal risk

### Mitigation Strategies
- Comprehensive testing before deployment
- Database migration testing in staging environment
- Gradual rollout with feature flags
- Rollback procedures documented