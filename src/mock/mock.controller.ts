import { Controller, Get } from '@nestjs/common';

@Controller('mock')
export class MockController {
  @Get('permit-status/sample')
  getPermitStatusSample() {
    return {
      permitId: 'PR-1042',
      applicant: 'Sample Resident',
      agency: 'City Permit Office',
      status: 'under_review',
      lastUpdated: '2026-08-21',
      nextStep: 'Inspection review pending',
      sourceSystem: 'sample-permit-system',
    };
  }

  @Get('resource-allocation/project-phoenix')
  getResourceAllocationSample() {
    return {
      projectKey: 'PHOENIX',
      projectName: 'Resource Allocation MVP',
      activeContributors: 3,
      manager: 'Sample Manager',
      verificationStatus: 'needs_confirmation',
      mismatches: [
        {
          person: 'Sample Employee',
          signal: 'calendar_meeting_detected',
          issue: 'Meeting activity found, but Jira task assignment is missing',
        },
      ],
      sourceSystem: 'sample-resource-allocation-system',
    };
  }
}
