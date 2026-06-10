> Source: `Workflow 3_ Senior Application (Age 71–100).docx` — converted from the client’s Word document.

# Workflow 3: Senior Application (Age 71–100)

## Pacific Insurance PH Agency Operations Platform

# Purpose

Manage new business applications for senior applicants aged 71–100 years old.

This workflow applies to:

- Select applicants aged 71–100
- Blue Royale applicants aged 71–100

Senior applicants require additional underwriting requirements beyond the standard application process.

# Business Owner

Pacific Insurance PH

# External Provider

Pacific Cross

# Workflow Trigger

Applicant age is 71 years old or above at the time of application.

System Rule:

IF Applicant Age >= 71

THEN Route To Senior Application Workflow

# Workflow Status Flow

Lead

↓

Discovery

↓

Senior Eligibility Confirmed

↓

Senior Application Package Sent

↓

Medical Examination Required

↓

Medical Requirements Received

↓

Internal Review

↓

Submitted to Pacific Cross

↓

Senior Underwriting Review

↓

Additional Information Required (Optional)

↓

Underwriting Decision Received

↓

Illustrative Proposal Issued

↓

Awaiting Payment

↓

Payment Confirmed

↓

Policy Processing

↓

Policy Issued

↓

Active Client

# Detailed Workflow Steps

## Step 1: Senior Eligibility Confirmed

Purpose:

Identify applicant as a senior applicant.

Responsible:

Pacific Insurance PH

System records:

- Date of Birth
- Age
- Product Requested

Status:

Senior Eligibility Confirmed

## Step 2: Senior Application Package Sent

Purpose:

Provide correct senior application forms.

Responsible:

Pacific Insurance PH

Examples:

- Select 71–100 Application Form
- Blue Royale 71–100 Application Form
- Medical Examination Forms
- Supporting Medical Requirements

Status:

Senior Application Package Sent

## Step 3: Medical Examination Required

Purpose:

Applicant completes required medical examination.

Responsible:

Applicant

Supporting Parties:

- Physician
- Medical Clinic
- Laboratory

Requirements may include:

- Full Medical Examination Form
- Laboratory Results
- Diagnostic Tests
- Additional Physician Reports

Requirements may change based on Pacific Cross guidelines.

Status:

Medical Examination Required

## Step 4: Medical Requirements Received

Purpose:

Collect completed medical package.

Responsible:

Pacific Insurance PH

System tracks:

- Requested Requirements
- Received Requirements
- Missing Requirements

Status:

Medical Requirements Received

## Step 5: Internal Review

Purpose:

Verify completeness before submission.

Responsible:

Pacific Insurance PH

Review includes:

- Missing pages
- Missing signatures
- Missing laboratory results
- Missing physician reports

Status:

Internal Review

## Step 6: Submit to Pacific Cross

Purpose:

Submit senior application package.

Responsible:

Pacific Insurance PH

System records:

- Submission Date
- Pacific Cross Contact
- Submitted Documents

Status:

Submitted to Pacific Cross

## Step 7: Senior Underwriting Review

Purpose:

Await underwriting review.

Responsible:

Pacific Cross

Possible outcomes:

- Standard Acceptance
- Acceptance With Loading
- Acceptance With Exclusions
- Acceptance With Conditions
- Additional Requirements Requested
- Declined

Status:

Senior Underwriting Review

## Step 8: Additional Information Required (Optional)

Purpose:

Handle further underwriting requests.

Examples:

- Specialist consultation
- Additional testing
- Clarification letters
- Updated laboratory work

This step may repeat multiple times.

Status:

Additional Information Required

## Step 9: Underwriting Decision Received

Purpose:

Receive final underwriting outcome.

Responsible:

Pacific Cross

System records:

- Decision Date
- Underwriting Outcome
- Loading Applied
- Exclusions Applied
- Special Conditions

Status:

Underwriting Decision Received

## Step 10: Client Review & Acceptance

Purpose:

Review underwriting results with applicant.

Responsible:

Pacific Insurance PH

Possible outcomes:

- Accept Offer
- Accept With Conditions
- Decline Offer

Status:

Client Decision Pending

## Step 11: Required Endorsements Signed

Purpose:

Collect required endorsement documents.

Examples:

- Coverage Endorsements
- Exclusion Endorsements
- Other Underwriting Documents

Status:

Endorsements Completed

## Step 12: Illustrative Proposal Issued

Purpose:

Receive final billing proposal.

Responsible:

Pacific Cross

System records:

- Premium
- Loadings
- Discounts
- Conditions

Status:

Illustrative Proposal Issued

## Step 13: Client Payment

Purpose:

Collect payment and proof of payment.

Status:

Payment Received

## Step 14: Payment Confirmation Submitted

Purpose:

Submit payment proof to Pacific Cross.

Responsible:

Pacific Insurance PH

Status:

Payment Confirmed

## Step 15: Policy Processing

Purpose:

Await issuance.

Status:

Policy Processing

## Step 16: Policy Issued

Purpose:

Record policy issuance.

System records:

- Policy Number
- Effective Date
- Expiry Date
- Renewal Date

Status:

Policy Issued

## Step 17: Active Client

Purpose:

Transition to servicing.

Additional underwriting history remains attached to client record for future renewals and claims.

Status:

Active Client

# Required Documents

## Senior Application Documents

- Senior Application Form
- Medical Questionnaire
- Full Medical Examination Form

## Medical Requirements

- Laboratory Results
- Physician Reports
- Diagnostic Results
- Additional Medical Records

## Pacific Cross Documents

- Illustrative Proposal
- Underwriting Endorsements
- Policy
- E-Card
- Official Service Invoice

# Important System Rules

## Rule 1

Senior Application is determined by age, not product.

## Rule 2

Required medical examinations must remain configurable.

Pacific Cross may change requirements in future product versions.

## Rule 3

Senior underwriting history must remain attached to policy and client records.

## Rule 4

The system must support multiple underwriting review cycles.

# Automation Opportunities

Version 1

- Missing medical requirement reminders
- Medical exam reminders
- Underwriting follow-up reminders
- Endorsement reminders
- Proposal reminders
- Payment reminders

# Exception Paths

## Incomplete Medical Examination

Status:

Pending Medical Requirements

## Applicant Withdraws

Status:

Closed - Applicant Withdrew

## Pacific Cross Declines Application

Status:

Closed - Declined

# Success Criteria

A senior application is successfully completed when:

- Medical requirements completed
- Underwriting approved
- Required endorsements signed
- Payment received
- Policy issued
- Client moved to Active Client status
