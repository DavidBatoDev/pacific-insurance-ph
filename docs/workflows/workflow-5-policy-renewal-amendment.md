> Source: `Workflow 5_ Policy Renewal (Amendment).docx` — converted from the client’s Word document.

# Workflow 5: Policy Renewal (Amendment)

## Pacific Insurance PH Agency Operations Platform

# Purpose

Manage policy renewals that require changes to the policy before renewal can be completed.

This workflow applies when the client wishes to make modifications to their existing coverage, insured members, discounts, or policy details during the renewal process.

This workflow is initiated using the Pacific Cross Amendment Form.

# Business Owner

Pacific Insurance PH

# External Provider

Pacific Cross

# Workflow Trigger

A renewal requires modifications to the existing policy.

Examples:

- Add dependent
- Remove dependent
- Change personal information
- Update contact information
- Apply discount
- Remove discount
- Upgrade plan
- Downgrade plan
- Change coverage option
- Add rider
- Remove rider
- Correct policy information

# Workflow Status Flow

Renewal Notice Received

↓

Renewal Review

↓

Amendment Required

↓

Amendment Request Submitted

↓

Amendment Requirements Received

↓

Internal Review

↓

Submitted to Pacific Cross

↓

Amendment Review

↓

Updated Renewal Proposal Received

↓

Awaiting Client Approval

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

# Detailed Workflow Steps

## Step 1: Amendment Requirement Identified

Purpose:

Determine that the renewal cannot proceed under the existing policy configuration.

Responsible:

Pacific Insurance PH

Sources:

- Client request
- Policy review
- Coverage review
- Family changes
- Pacific Cross recommendation

Status:

Amendment Required

## Step 2: Amendment Consultation

Purpose:

Understand requested changes.

Responsible:

Pacific Insurance PH

Examples:

### Family Changes

- New spouse
- New child
- Remove dependent

### Coverage Changes

- Upgrade coverage
- Downgrade coverage
- Add benefits
- Remove benefits

### Administrative Changes

- Address change
- Contact information update
- Name correction

System records:

- Requested Change Type
- Requested Effective Date
- Client Notes

Status:

Amendment Consultation

## Step 3: Amendment Form Sent

Purpose:

Provide required amendment documentation.

Responsible:

Pacific Insurance PH

Documents:

- Amendment Form
- Supporting Requirements

Status:

Amendment Form Sent

## Step 4: Amendment Requirements Received

Purpose:

Collect completed amendment documents.

Responsible:

Pacific Insurance PH

Requirements vary depending on change type.

Examples:

### Add Dependent

- Amendment Form
- Dependent Information
- Birth Certificate
- Valid ID

### Remove Dependent

- Amendment Form
- Removal Request

### Coverage Upgrade

- Amendment Form
- Additional Underwriting Documents

System tracks:

- Requested Documents
- Received Documents
- Missing Documents

Status:

Requirements Received

## Step 5: Internal Review

Purpose:

Verify completeness before submission.

Responsible:

Pacific Insurance PH

Review includes:

- Correct forms
- Signatures
- Supporting documents
- Eligibility checks

Status:

Internal Review

## Step 6: Submit Amendment To Pacific Cross

Purpose:

Submit amendment request.

Responsible:

Pacific Insurance PH

System records:

- Submission Date
- Pacific Cross Contact
- Submitted Documents
- Notes

Status:

Submitted to Pacific Cross

## Step 7: Amendment Review

Purpose:

Await Pacific Cross evaluation.

Responsible:

Pacific Cross

Possible outcomes:

### Approved

Proceed to updated renewal proposal.

### Additional Requirements Requested

Return to requirements stage.

### Medical Review Required

Transfer to Medical Review Workflow.

### Declined

Close amendment request.

Status:

Amendment Review

## Step 8: Updated Renewal Proposal Received

Purpose:

Receive revised renewal terms.

Responsible:

Pacific Cross

Possible changes:

- Premium increase
- Premium decrease
- Coverage changes
- Additional exclusions
- Additional conditions

System records:

- Updated Premium
- Updated Coverage
- Effective Date
- Proposal Date

Status:

Updated Renewal Proposal Received

## Step 9: Client Approval

Purpose:

Obtain client approval for revised renewal terms.

Responsible:

Pacific Insurance PH

Possible outcomes:

### Approved

Proceed to payment.

### Declined

Close amendment request.

### Request Further Changes

Return to Amendment Consultation.

Status:

Awaiting Client Approval

## Step 10: Payment Received

Purpose:

Collect renewal payment.

Responsible:

Client

System records:

- Payment Amount
- Payment Method
- Payment Date
- Proof of Payment

Status:

Payment Received

## Step 11: Payment Confirmation Submitted

Purpose:

Forward proof of payment to Pacific Cross.

Responsible:

Pacific Insurance PH

Status:

Payment Confirmed

## Step 12: Renewal Processing

Purpose:

Await final renewal completion.

Responsible:

Pacific Cross

Expected outputs:

- Updated Policy
- Updated E-Card
- Official Service Invoice

Status:

Renewal Processing

## Step 13: Renewal Completed

Purpose:

Finalize amended renewal.

System updates:

- Policy Details
- Dependents
- Coverage Information
- Premium Information
- Renewal History

Status:

Renewed

# Amendment Types

The system should support configurable amendment categories.

Examples:

### Insured Members

- Add Dependent
- Remove Dependent

### Coverage Changes

- Upgrade Plan
- Downgrade Plan
- Add Benefit
- Remove Benefit

### Discounts

- Add Discount
- Remove Discount

### Administrative Changes

- Name Change
- Address Change
- Contact Information Update

### Other

- Custom Amendment

# Required Documents

## Core Documents

- Amendment Form

## Conditional Documents

Depending on amendment type:

- Valid ID
- Birth Certificate
- Marriage Certificate
- Medical Documents
- Supporting Forms

Requirements should be configurable.

# Important System Rules

## Rule 1

Amendment requirements must not be hardcoded.

Pacific Cross may change requirements.

## Rule 2

All policy changes must be recorded historically.

The system should preserve:

- Previous Value
- New Value
- Effective Date

## Rule 3

The system should support multiple amendment requests during the same policy year.

## Rule 4

Amendments requiring medical evaluation should transfer to the Medical Review Workflow.

# Automation Opportunities

Version 1

- Missing amendment document reminders
- Amendment follow-up reminders
- Pacific Cross follow-up reminders
- Client approval reminders
- Payment reminders

# Exception Paths

## Additional Requirements Requested

Return to:

Requirements Received

## Medical Evaluation Required

Transfer to:

New Business Medical Review Workflow

or

Renewal Medical Review Workflow (future workflow)

## Client Declines Updated Terms

Status:

Closed - Amendment Declined

## Amendment Rejected By Pacific Cross

Status:

Closed - Amendment Rejected

Reason must be recorded.

# Success Criteria

An amendment renewal is successfully completed when:

- Amendment approved
- Updated proposal accepted
- Payment received
- Proof of payment submitted
- Updated policy issued
- Renewal completed
- Policy history updated
