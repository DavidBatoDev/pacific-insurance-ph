> Source: `Workflow 2_ New Business Application (Medical Review).docx` — converted from the client’s Word document.

# Workflow 2: New Business Application (Medical Review)

## Pacific Insurance PH Agency Operations Platform

# Purpose

Manage new business applications that require additional medical underwriting review due to:

- Pre-existing medical conditions
- Medical disclosures
- Underwriting concerns
- Additional information requests from Pacific Cross

This workflow is an extension of the Standard New Business Workflow and is typically the most complex application type handled by Pacific Insurance PH.

# Business Owner

Pacific Insurance PH

# External Provider

Pacific Cross

# Workflow Trigger

This workflow begins when any of the following occurs:

## During Discovery

The applicant discloses:

- Diabetes
- Hypertension
- Heart disease
- Cancer history
- Asthma
- Kidney disease
- Thyroid disorder
- Previous surgery
- Chronic illness
- Ongoing medication
- Other significant medical history

## During Application Review

Pacific Insurance PH identifies a possible medical concern requiring further review.

## During Pacific Cross Review

Pacific Cross requests:

- Additional medical records
- Medical questionnaires
- Clarifications
- Underwriting review

# Workflow Status Flow

Lead

↓

Discovery

↓

Medical Disclosure Identified

↓

Medical Requirements Requested

↓

Medical Requirements Received

↓

Internal Review

↓

Submitted to Pacific Cross

↓

Medical Underwriting Review

↓

Additional Information Required (Optional)

↓

Medical Evaluation Completed

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

## Step 1: Medical Disclosure Identified

Purpose:

Determine that additional medical review is required.

Responsible:

Pacific Insurance PH

Triggers:

- Medical questionnaire answers
- Discovery call notes
- Existing medical records
- Client disclosure

System should record:

- Condition disclosed
- Date disclosed
- Severity notes
- Current medications
- Diagnosed date (if known)

Status:

Medical Disclosure Identified

## Step 2: Medical Requirements Requested

Purpose:

Collect supporting medical information.

Responsible:

Pacific Insurance PH

Required documents may include:

- Medical Questionnaire
- Physician Reports
- Laboratory Results
- Diagnostic Imaging
- Hospital Records
- Prescription Records
- Specialist Reports

Requirements vary by condition.

The system must support dynamic requirement lists.

Status:

Medical Requirements Requested

## Step 3: Medical Requirements Received

Purpose:

Verify all requested documents have been collected.

Responsible:

Pacific Insurance PH

System tracks:

- Requested Documents
- Received Documents
- Missing Documents
- Upload Dates

Status:

Medical Requirements Received

## Step 4: Internal Review

Purpose:

Prepare complete underwriting package.

Responsible:

Pacific Insurance PH

Review includes:

- Document completeness
- Legibility
- Missing information
- Consistency with application answers

Status:

Internal Review

## Step 5: Submit to Pacific Cross

Purpose:

Submit medical application package.

Responsible:

Pacific Insurance PH

System records:

- Submission Date
- Pacific Cross Contact
- Submitted Documents
- Notes

Status:

Submitted to Pacific Cross

## Step 6: Medical Underwriting Review

Purpose:

Await underwriting evaluation.

Responsible:

Pacific Cross

Possible outcomes:

- Standard Acceptance
- Acceptance With Conditions
- Acceptance With Loading
- Acceptance With Exclusions
- Treatment Area Limitation Option
- Request For Additional Information
- Decline

Status:

Medical Underwriting Review

## Step 7: Additional Information Required (Optional)

Purpose:

Handle underwriting follow-up requests.

Responsible:

Pacific Insurance PH

Examples:

- New laboratory tests
- Additional doctor's report
- Specialist consultation
- Clarification letter

This step may repeat multiple times.

Status:

Additional Information Required

## Step 8: Medical Evaluation Completed

Purpose:

Receive final underwriting decision.

Responsible:

Pacific Cross

Possible outputs:

### Standard Approval

No special conditions.

### Approval With Loading

Higher premium.

### Approval With Exclusions

Certain conditions excluded.

Requires:

Exclusion Endorsement

### Treatment Area Limitation Option

Client may choose TAL discount.

Requires:

TAL Conforme Letter

### Conditional Acceptance

Requires:

Client Application for Coverage (CAC)

### Declined

Application closed.

Status:

Medical Evaluation Completed

## Step 9: Client Decision

Purpose:

Review underwriting results with client.

Responsible:

Pacific Insurance PH

Client chooses:

- Accept proposal
- Accept with exclusions
- Accept with loading
- Accept TAL option
- Decline offer

System records decision.

Status:

Client Decision Pending

## Step 10: Required Endorsements Signed

Purpose:

Collect underwriting acceptance documents.

Examples:

- CAC
- TAL Conforme Letter
- Exclusion Acceptance
- Other Pacific Cross Endorsements

Status:

Endorsements Pending

↓

Endorsements Completed

## Step 11: Illustrative Proposal Issued

Purpose:

Receive final billing proposal.

Responsible:

Pacific Cross

System records:

- Proposal Amount
- Loadings Applied
- Discounts Applied
- Exclusions Applied

Status:

Illustrative Proposal Issued

## Step 12: Client Payment

Same process as Standard Workflow.

System records:

- Payment Amount
- Payment Method
- Proof of Payment

Status:

Payment Received

## Step 13: Payment Confirmation Submitted

Purpose:

Forward proof of payment to Pacific Cross.

Responsible:

Pacific Insurance PH

Status:

Payment Confirmed

## Step 14: Policy Processing

Purpose:

Await issuance.

Status:

Policy Processing

## Step 15: Policy Issued

System records:

- Policy Number
- Effective Date
- Expiry Date
- Renewal Date
- Endorsements
- Policy Documents

Status:

Policy Issued

## Step 16: Active Client

Purpose:

Transition to servicing and renewal management.

Additional medical underwriting history must remain attached to the policy for future renewals.

Status:

Active Client

# Special Documents

## Medical Documents

- Medical Questionnaire
- Physician Reports
- Laboratory Results
- Diagnostic Results
- Hospital Records
- Prescription Records

## Pacific Cross Underwriting Documents

- CAC (Client Application for Coverage)
- TAL Conforme Letter
- Exclusion Endorsement
- Medical Coverage Endorsement
- Illustrative Proposal

# Important System Rules

## Rule 1

Medical requirements must be configurable.

Pacific Cross may change requirements in the future.

## Rule 2

The system must support multiple underwriting cycles.

Pacific Cross may request additional documents more than once.

## Rule 3

Medical history must remain attached to the client and policy record.

This information may be needed during:

- Renewals
- Claims
- Future applications

## Rule 4

Underwriting outcomes must not be hardcoded.

Possible outcomes should be configurable.

# Automation Opportunities

Version 1

- Missing medical document reminders
- Underwriting follow-up reminders
- Additional information reminders
- Endorsement signature reminders
- Proposal follow-up reminders
- Payment follow-up reminders

# Exception Paths

## Client Refuses Medical Requirements

Status:

Closed - Incomplete Requirements

## Pacific Cross Declines Application

Status:

Closed - Declined

Reason must be recorded.

## Client Rejects Underwriting Terms

Status:

Closed - Client Declined Offer

Reason must be recorded.

# Success Criteria

A medical application is successfully completed when:

- Underwriting decision received
- Required endorsements signed
- Payment received
- Policy issued
- Medical endorsements stored
- Client moved to Active Client status
