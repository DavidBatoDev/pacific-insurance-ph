> Source: `Automation Framework & Business Rules.docx` — converted from the client’s Word document.

# Automation Framework & Business Rules

## Pacific Insurance PH Agency Operations Platform

# Purpose

Define which business processes should be automated and which should remain manual.

The goal is to:

- Reduce administrative workload
- Improve consistency
- Prevent missed follow-ups
- Maintain personal client relationships
- Preserve operational flexibility

The system should support Matt and Eman, not replace them.

# Automation Design Principles

## Principle 1

Automate repetitive tasks.

Examples:

- Reminders
- Notifications
- Status updates
- Task generation

## Principle 2

Do not automate relationship decisions.

Examples:

- Claims advice
- Coverage recommendations
- Special client handling

These remain human decisions.

## Principle 3

Every automation must be configurable.

Pacific Cross products, requirements, and processes change over time.

## Principle 4

Automations should generate tasks before making assumptions.

When uncertain:

Create a task.

Do not automatically proceed.

# Automation Categories

## Category 1

Workflow Automation

## Category 2

Communication Automation

## Category 3

Task Automation

## Category 4

Relationship Automation

## Category 5

Reporting Automation

# Workflow Automation

## New Application Created

Trigger:

Application Created

Actions:

- Generate Application Reference Number
- Create Client Record (if new)
- Create Application Record
- Assign Staff Member
- Generate Initial Tasks

## Documents Requested

Trigger:

Application moves to Documents Required

Actions:

- Create Missing Document Checklist
- Generate Client Notification
- Create Follow-Up Task

## Payment Required

Trigger:

Application moves to Awaiting Payment

Actions:

- Generate Payment Request
- Send Payment Instructions
- Create Payment Follow-Up Task

## Payment Verified

Trigger:

Payment Verified

Actions:

- Update Application Status
- Notify Assigned Staff
- Generate Next Workflow Tasks

## Policy Issued

Trigger:

Policy Number Recorded

Actions:

- Update Status
- Generate Client Notification
- Generate Document Delivery Task
- Create Renewal Schedule

# Renewal Automation

## Renewal Schedule Creation

Trigger:

Policy Issued

Actions:

Automatically create:

- Renewal Record
- Renewal Date
- Renewal Reminder Schedule

## Renewal Reminder

Suggested Schedule:

45 Days Before Expiry

30 Days Before Expiry

14 Days Before Expiry

7 Days Before Expiry

Actions:

- Notify Staff
- Generate Client Reminder

## Renewal Payment Verified

Trigger:

Renewal Payment Verified

Actions:

- Update Renewal Status
- Generate Processing Task

# Claims Automation

## Claim Created

Trigger:

Claim Record Created

Actions:

- Generate Claim Number
- Create Claim Timeline
- Notify Assigned Staff

## Compliance Required

Trigger:

Claim Status Updated

Actions:

- Generate Client Notification
- Create Follow-Up Task
- Set Reminder

## Claim Closed

Trigger:

Claim Closed

Actions:

- Update Timeline
- Notify Client
- Create Relationship Follow-Up Opportunity

# Travel Insurance Automation

## Travel Request Created

Trigger:

Travel Request Created

Actions:

- Generate Travel Reference Number
- Create Travel Timeline

## Payment Request Generated

Trigger:

Travel Quote Confirmed

Actions:

- Generate Payment Request
- Generate QR Code
- Notify Client
- Create Follow-Up Task

## Payment Verified

Trigger:

Travel Payment Verified

Actions:

- Generate Payment Acknowledgement
- Notify Assigned Staff
- Move To Purchase Queue

## Travel Policy Issued

Trigger:

Policy Number Recorded

Actions:

- Generate Delivery Email
- Attach Policy Documents
- Update Travel Timeline

# Task Automation

## Overdue Applications

Trigger:

No activity for configurable period

Actions:

- Create Reminder Task
- Notify Assigned Staff

## Missing Documents

Trigger:

Outstanding Documents Exist

Actions:

- Generate Follow-Up Task

## Pending Claims

Trigger:

No update received

Actions:

- Generate Follow-Up Task

## Travel Payment Pending

Trigger:

Payment Request Sent

Actions:

- Create Follow-Up Task

# Relationship Automation

## Welcome Activity

Trigger:

First Policy Issued

Actions:

- Create Welcome Activity

## Birthday Activity

Trigger:

Birthday Date

Actions:

- Create Birthday Reminder Task

## Policy Anniversary

Trigger:

Policy Anniversary

Actions:

- Create Anniversary Activity

## Loyalty Milestones

Examples:

- 3 Years
- 5 Years
- 10 Years

Actions:

- Create Loyalty Activity

## Custom Relationship Events

Users may create:

- Gift Campaigns
- VIP Recognition
- Referral Programs

System should remain flexible.

# Reporting Automation

## Daily Dashboard Updates

Automatically update:

- Applications
- Claims
- Renewals
- Travel Insurance

## KPI Calculations

Automatically calculate:

- Policies Issued
- Renewal Rate
- Claims Count
- Travel Conversion Rate

## Relationship Metrics

Automatically calculate:

- Client Retention
- Loyalty Activities Completed

# Automation Approval Rules

## Low Risk Actions

May run automatically.

Examples:

- Status Updates
- Reminders
- Task Creation

## Medium Risk Actions

May require review.

Examples:

- Client Notifications
- Payment Requests

## High Risk Actions

Never fully automate.

Examples:

- Claims Decisions
- Underwriting Decisions
- Coverage Recommendations
- Policy Advice

Must remain human-controlled.

# Automation Audit Trail

Every automation should record:

- Trigger
- Date
- Time
- User
- Record Affected
- Outcome

This supports accountability and troubleshooting.

# Version 1 Recommended Automations

Priority 1:

- Reference Number Generation
- Task Creation
- Renewal Scheduling
- Reminder Scheduling
- Client Notifications
- Travel Payment Requests
- Travel Payment Acknowledgements
- Relationship Activities

# Future Automations

Potential future enhancements:

- Viber Integration
- SMS Integration
- AI Follow-Up Suggestions
- Smart Renewal Prioritization
- Client Risk Scoring
- Automated Campaigns

Not included in Version 1.

# Success Criteria

The Automation Framework is successful when:

- Staff spend less time on repetitive tasks
- Follow-ups are not missed
- Clients receive timely updates
- Human judgment remains in control
- Processes remain flexible as Pacific Cross products evolve
