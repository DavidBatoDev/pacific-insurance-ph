> Source: `Workflow 6_ Policy Reinstatement.docx` — converted from the client’s Word document.

# Workflow 6: Policy Reinstatement

## Pacific Insurance PH Agency Operations Platform

# Purpose

Manage policies that were not renewed within the allowable renewal period and require reinstatement to restore coverage.

This workflow applies when:

- A policy has expired
- The grace period has ended
- The client still wishes to continue coverage
- Pacific Cross requires a Reinstatement Form and supporting review

This workflow is different from a standard renewal because reinstatement may involve additional underwriting review and eligibility assessment.

# Business Owner

Pacific Insurance PH

# External Provider

Pacific Cross

# Workflow Trigger

A client attempts to renew after the allowable renewal period has expired.

Examples:

- Client forgot to renew
- Client delayed payment
- Client was travelling
- Client was undecided
- Client was unreachable
- Client experienced financial difficulties

# Workflow Status Flow

Policy Expired

↓

Grace Period Expired

↓

Reinstatement Inquiry

↓

Eligibility Review

↓

Reinstatement Form Sent

↓

Requirements Received

↓

Internal Review

↓

Submitted to Pacific Cross

↓

Reinstatement Review

↓

Additional Requirements Requested (Optional)

↓

Reinstatement Approved

↓

Awaiting Payment

↓

Payment Received

↓

Payment Confirmation Submitted

↓

Policy Reinstated

OR

↓

Reinstatement Declined

# Detailed Workflow Steps

## Step 1: Policy Expired

Purpose:

Identify that the policy is no longer active.

System records:

- Expiry Date
- Grace Period End Date

Status:

Policy Expired

## Step 2: Grace Period Expired

Purpose:

Determine that standard renewal is no longer available.

System automatically checks:

Current Date > Grace Period End Date

Status:

Grace Period Expired

## Step 3: Reinstatement Inquiry

Purpose:

Client expresses desire to continue coverage.

Responsible:

Pacific Insurance PH

System records:

- Inquiry Date
- Reason For Late Renewal
- Current Coverage Status

Status:

Reinstatement Inquiry

## Step 4: Eligibility Review

Purpose:

Determine if reinstatement should be attempted.

Responsible:

Pacific Insurance PH

Review includes:

- Time since expiration
- Claims history
- Product type
- Previous underwriting concerns
- Client history

Possible outcomes:

- Proceed with reinstatement
- Advise new application
- Await clarification

Status:

Eligibility Review

## Step 5: Reinstatement Form Sent

Purpose:

Provide required reinstatement documentation.

Responsible:

Pacific Insurance PH

Documents:

- Reinstatement Form
- Supporting Requirements

System records:

- Sent Date
- Version Used

Status:

Reinstatement Form Sent

## Step 6: Requirements Received

Purpose:

Collect completed reinstatement package.

Responsible:

Pacific Insurance PH

Typical requirements:

- Reinstatement Form
- Updated Health Declaration
- Supporting Medical Information (if required)
- Valid Identification
- Other Pacific Cross requirements

Requirements should remain configurable.

Status:

Requirements Received

## Step 7: Internal Review

Purpose:

Verify completeness before submission.

Responsible:

Pacific Insurance PH

Review includes:

- Missing information
- Missing signatures
- Missing attachments
- Eligibility concerns

Status:

Internal Review

## Step 8: Submit To Pacific Cross

Purpose:

Submit reinstatement request.

Responsible:

Pacific Insurance PH

System records:

- Submission Date
- Pacific Cross Contact
- Submitted Documents

Status:

Submitted to Pacific Cross

## Step 9: Reinstatement Review

Purpose:

Await Pacific Cross review.

Responsible:

Pacific Cross

Possible outcomes:

### Approved

Proceed to payment.

### Additional Requirements Requested

Request more information.

### Medical Review Required

Transfer to Medical Review Workflow.

### Declined

Coverage cannot be reinstated.

Status:

Reinstatement Review

## Step 10: Additional Requirements Requested (Optional)

Purpose:

Handle additional requests.

Examples:

- Updated medical records
- Medical questionnaire
- Physician report
- New laboratory results

This step may repeat multiple times.

Status:

Additional Requirements Requested

## Step 11: Reinstatement Approved

Purpose:

Receive approval to proceed.

Responsible:

Pacific Cross

System records:

- Approval Date
- Conditions
- Additional Notes
- Underwriting Outcome

Status:

Reinstatement Approved

## Step 12: Payment Request Sent

Purpose:

Provide payment instructions.

Responsible:

Pacific Insurance PH

Documents may include:

- Billing
- Payment Instructions
- Updated Proposal

Status:

Awaiting Payment

## Step 13: Payment Received

Purpose:

Collect payment.

System records:

- Payment Amount
- Payment Date
- Payment Method
- Proof of Payment

Status:

Payment Received

## Step 14: Payment Confirmation Submitted

Purpose:

Forward proof of payment to Pacific Cross.

Responsible:

Pacific Insurance PH

Status:

Payment Confirmed

## Step 15: Policy Reinstated

Purpose:

Restore policy coverage.

System updates:

- Policy Status
- Effective Date
- Expiry Date
- Renewal Date

Expected outputs:

- Updated Policy
- Updated E-Card
- Official Service Invoice

Status:

Policy Reinstated

# Required Documents

## Core Documents

- Reinstatement Form

## Conditional Documents

Depending on Pacific Cross review:

- Medical Questionnaire
- Updated Health Declaration
- Physician Reports
- Laboratory Results
- Valid Identification

Requirements should remain configurable.

# Important System Rules

## Rule 1

Reinstatement requirements must be configurable.

Pacific Cross may change requirements over time.

## Rule 2

Not all expired policies are eligible for reinstatement.

The system should support approval and rejection outcomes.

## Rule 3

Medical review may be required.

Reinstatement may branch into a medical underwriting process.

## Rule 4

Reinstatement history must remain attached to the policy record.

Future reporting should show:

- Number of reinstatements
- Reinstatement dates
- Reinstatement reasons

## Rule 5

If reinstatement is not possible, the client may need a completely new application.

The system should support conversion into a New Business workflow.

# Automation Opportunities

Version 1

- Expired policy alerts
- Grace period alerts
- Reinstatement follow-up reminders
- Missing document reminders
- Payment reminders
- Approval follow-up reminders

# Exception Paths

## Medical Review Required

Transfer to:

Medical Review Workflow

## Reinstatement Declined

Status:

Closed - Reinstatement Declined

Reason must be recorded.

## New Application Required

Status:

Convert To New Business Application

System should create a new application workflow while preserving policy history.

## Client No Longer Interested

Status:

Closed - Client Not Proceeding

# Success Criteria

A reinstatement is successfully completed when:

- Reinstatement approved
- Payment received
- Proof submitted to Pacific Cross
- Policy restored
- New policy dates recorded
- Coverage returned to Active status

# Future Enhancement

The system may eventually calculate:

- Reinstatement Risk Score
- Lapsed Client Recovery Opportunities
- Reinstatement Conversion Rate

for management reporting and retention analysis.
