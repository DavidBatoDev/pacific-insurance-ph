> Source: `Workflow 4_ Policy Renewal (Standard).docx` — converted from the client’s Word document.

# Workflow 4: Policy Renewal (Standard)

## Pacific Insurance PH Agency Operations Platform

# Purpose

Manage the renewal process for active policies approaching expiration to ensure continuous coverage, maximize client retention, and maintain commission continuity.

This workflow applies to:

- Select policies
- Blue Royale policies
- Policies with no major amendments
- Policies within the normal renewal cycle

This is expected to be one of the highest-volume workflows in the business.

# Business Owner

Pacific Insurance PH

# External Provider

Pacific Cross

# Workflow Trigger

A policy is approaching its expiration date.

Primary Trigger:

Pacific Cross sends a Renewal Notice to:

- Client
- Pacific Insurance PH

Current business process:

Pacific Cross typically sends renewal notices approximately 45 days before policy expiration.

# Workflow Status Flow

Renewal Upcoming

↓

Renewal Notice Received

↓

Renewal Review

↓

Renewal Sent To Client

↓

Awaiting Client Decision

↓

Awaiting Payment

↓

Payment Received

↓

Payment Confirmation Submitted

↓

Renewal Processing

↓

Renewed

OR

↓

Renewal Amendment Required

OR

↓

Reinstatement Required

OR

↓

Not Renewing

# Detailed Workflow Steps

## Step 1: Renewal Upcoming

Purpose:

Identify policies nearing expiration.

Responsible:

System

Recommended monitoring periods:

- 90 Days Before Expiry
- 60 Days Before Expiry
- 45 Days Before Expiry
- 30 Days Before Expiry

System should automatically flag upcoming renewals.

Status:

Renewal Upcoming

## Step 2: Renewal Notice Received

Purpose:

Record receipt of renewal notice from Pacific Cross.

Responsible:

Pacific Insurance PH

System records:

- Renewal Notice Date
- Policy Expiry Date
- Renewal Premium
- Product Version
- Plan Information

Documents:

- Renewal Notice

Status:

Renewal Notice Received

## Step 3: Renewal Review

Purpose:

Review renewal details before contacting client.

Responsible:

Pacific Insurance PH

Review includes:

- Premium changes
- Product changes
- Plan changes
- Underwriting notes
- Claims history
- Special endorsements

Possible outcomes:

- Standard Renewal
- Amendment Required
- Reinstatement Required
- Medical Review Required

Status:

Renewal Review

## Step 4: Renewal Sent To Client

Purpose:

Present renewal information.

Responsible:

Pacific Insurance PH

Communication may include:

- Renewal Notice
- Renewal Premium
- Payment Instructions
- Coverage Summary

System records:

- Sent Date
- Communication Method
- Staff Member

Status:

Renewal Sent To Client

## Step 5: Client Decision

Purpose:

Determine renewal intent.

Responsible:

Client

Possible outcomes:

### Proceed With Renewal

Continue workflow.

### Request Changes

Transfer to:

Workflow 5: Renewal Amendment

### Undecided

Continue follow-up process.

### Not Renewing

Close renewal.

Status:

Awaiting Client Decision

## Step 6: Renewal Follow-Up

Purpose:

Manage reminder process.

Responsible:

Pacific Insurance PH

Current business practice:

Approximately 30 days before expiration.

System should support configurable reminder schedules.

Examples:

- 30 Days Before Expiry
- 14 Days Before Expiry
- 7 Days Before Expiry
- 3 Days Before Expiry

Important:

Early payers must not continue receiving payment reminders.

Status:

Awaiting Payment

## Step 7: Payment Received

Purpose:

Collect payment confirmation.

Accepted methods may include:

- Pacific Cross Payment Portal
- Credit Card
- Bank Transfer
- Over-the-Counter Payment
- Cashier Payment

System records:

- Payment Date
- Amount
- Payment Method
- Proof of Payment

Status:

Payment Received

## Step 8: Payment Confirmation Submitted

Purpose:

Submit proof of payment to Pacific Cross.

Responsible:

Pacific Insurance PH

Critical Process:

Renewal processing should not begin until proof of payment has been forwarded.

System records:

- Submission Date
- Pacific Cross Contact
- Notes

Status:

Payment Confirmed

## Step 9: Renewal Processing

Purpose:

Await renewal completion.

Responsible:

Pacific Cross

Expected outputs:

- Renewed Policy
- Updated E-Card
- Official Service Invoice

Status:

Renewal Processing

## Step 10: Renewal Completed

Purpose:

Record successful renewal.

System updates:

- New Effective Date
- New Expiry Date
- New Renewal Date
- Policy Status

Status:

Renewed

## Step 11: Relationship Follow-Up

Purpose:

Strengthen client relationship after renewal.

Responsible:

Pacific Insurance PH

Examples:

- Thank You Email
- Renewal Appreciation Message
- Relationship Activity
- VIP Follow-Up

The exact activity should be configurable through the Relationship Management module.

Status:

Completed

# Required Documents

## Pacific Cross Documents

- Renewal Notice
- Updated Policy Documents
- Updated E-Card
- Official Service Invoice

## Client Documents

- Proof of Payment

# Important System Rules

## Rule 1

Renewal reminders must stop once payment is received.

## Rule 2

Renewal workflow must not assume premiums remain unchanged.

Premiums may change each year.

## Rule 3

Product changes must be supported.

Pacific Cross may introduce:

- New plans
- New pricing
- New product versions

during renewal cycles.

## Rule 4

Renewal history must be preserved.

The system should track:

- Renewal Year
- Premium Changes
- Plan Changes
- Coverage Changes

for reporting purposes.

## Rule 5

Renewal processing should always store the Pacific Cross contact involved.

Staff changes at Pacific Cross must not affect historical records.

# Automation Opportunities

Version 1

- 90-day renewal alerts
- 60-day renewal alerts
- 45-day renewal alerts
- Payment reminders
- Follow-up tasks
- Renewal dashboard alerts
- Renewal completion tasks

# Exception Paths

## Client Requests Policy Changes

Transfer to:

Workflow 5: Renewal Amendment

## Policy Expires Before Payment

Transfer to:

Workflow 6: Reinstatement

## Pacific Cross Requests Additional Requirements

Transfer to:

Medical Review Workflow

if applicable.

## Client Does Not Renew

Status:

Closed - Not Renewed

Reason should be captured.

Examples:

- Cost
- Switched Provider
- No Longer Needed
- Lost Contact
- Other

# Success Criteria

A renewal is successfully completed when:

- Renewal payment received
- Proof of payment submitted to Pacific Cross
- Renewal documents received
- New policy dates recorded
- Policy status remains Active
- Renewal history recorded
- Relationship follow-up completed

# Future Enhancements

Future versions may include:

- Automated renewal forecasting
- Retention reporting
- Renewal conversion dashboards
- Renewal risk scoring
- Automated renewal campaigns
- Loyalty and retention journeys

These should remain optional and configurable.
