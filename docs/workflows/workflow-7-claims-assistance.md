> Source: `Workflow 7_ Claims Assistance.docx` — converted from the client’s Word document.

# Workflow 7: Claims Assistance

## Pacific Insurance PH Agency Operations Platform

# Purpose

Assist clients in preparing, submitting, tracking, and following up insurance claims with Pacific Cross.

Pacific Insurance PH does not adjudicate claims.

Pacific Insurance PH acts as the client's advocate and coordinator throughout the claims process.

This workflow applies to:

- Select Policies
- Blue Royale Policies
- BC Flexi Policies (if applicable)
- Future Pacific Cross products

# Business Owner

Pacific Insurance PH

# External Provider

Pacific Cross

# Workflow Trigger

A client wishes to submit an insurance claim.

Common triggers include:

- Hospitalization
- Surgery
- Outpatient treatment
- Emergency treatment
- Accident
- Medical reimbursement
- Other covered medical expenses

# Workflow Status Flow

Claim Inquiry

↓

Claim Assessment

↓

Requirements Sent

↓

Requirements Received

↓

Internal Review

↓

Submitted To Pacific Cross

↓

Claim Review

↓

Compliance Required (Optional)

↓

Additional Documents Submitted

↓

Claim Decision Received

↓

Client Notified

↓

Claim Closed

# Detailed Workflow Steps

## Step 1: Claim Inquiry

Purpose:

Record a client's intention to submit a claim.

Responsible:

Pacific Insurance PH

System records:

- Client
- Policy
- Claim Type
- Date of Incident
- Initial Description

Status:

Claim Inquiry

## Step 2: Claim Assessment

Purpose:

Determine claim category and requirements.

Responsible:

Pacific Insurance PH

Examples:

- Inpatient Claim
- Outpatient Claim
- Surgery Claim
- Emergency Claim
- Accident Claim

System determines:

- Required Documents
- Applicable Checklist
- Claims Contact

Status:

Claim Assessment

## Step 3: Requirements Sent

Purpose:

Provide claim instructions and document checklist.

Responsible:

Pacific Insurance PH

Documents may include:

- Notification of Claim Form
- Requirements Checklist
- Submission Instructions

Requirements vary by claim type.

The system must support configurable claim requirement templates.

Status:

Requirements Sent

## Step 4: Requirements Received

Purpose:

Collect supporting claim documents.

Responsible:

Pacific Insurance PH

Examples:

- Notification of Claim Form
- Medical Records
- Service Invoices
- Official Receipts
- Laboratory Results
- Physician Reports
- Discharge Summary

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

- Missing documents
- Missing signatures
- Incomplete forms
- Document quality

Possible outcomes:

Complete → Proceed

Incomplete → Return to Client

Status:

Internal Review

## Step 6: Submit To Pacific Cross

Purpose:

Submit claim package.

Responsible:

Pacific Insurance PH

System records:

- Submission Date
- Pacific Cross Claims Contact
- Submitted Documents
- Submission Notes

Status:

Submitted To Pacific Cross

## Step 7: Claim Review

Purpose:

Await Pacific Cross evaluation.

Responsible:

Pacific Cross

Possible outcomes:

- Under Review
- Compliance Required
- Approved
- Rejected
- Credited

Status:

Claim Review

## Step 8: Compliance Required (Optional)

Purpose:

Handle requests for additional information.

Responsible:

Pacific Insurance PH

Examples:

- Missing medical records
- Additional physician reports
- Clarification letters
- Additional receipts
- Additional laboratory results

This step may occur multiple times.

Status:

Compliance Required

## Step 9: Additional Documents Submitted

Purpose:

Provide requested compliance documents.

Responsible:

Pacific Insurance PH

System records:

- Documents Submitted
- Submission Date
- Notes

Status:

Additional Documents Submitted

## Step 10: Claim Decision Received

Purpose:

Record Pacific Cross decision.

Responsible:

Pacific Insurance PH

Possible outcomes:

### Approved

Claim payable.

### Rejected

Claim denied.

Reason should be recorded.

### Credited

Applied against policy obligations or future benefits.

### Partial Approval

Only part of the claim approved.

Status:

Claim Decision Received

## Step 11: Client Notification

Purpose:

Communicate claim outcome.

Responsible:

Pacific Insurance PH

Communication methods:

- Email
- Phone
- Viber
- WhatsApp

System records:

- Notification Date
- Method
- Staff Member

Status:

Client Notified

## Step 12: Claim Closed

Purpose:

Finalize claim record.

System records:

- Final Outcome
- Amount Claimed
- Amount Approved
- Closure Date

Status:

Claim Closed

# Claim Outcomes

The system should support configurable outcomes.

Examples:

- Approved
- Partially Approved
- Rejected
- Credited
- Withdrawn
- Closed

# Required Documents

Requirements vary by claim type.

Examples:

## Core Documents

- Notification of Claim Form

## Supporting Documents

- Medical Records
- Physician Reports
- Laboratory Results
- Official Receipts
- Service Invoices
- Discharge Summary
- Diagnostic Reports

Requirements must remain configurable.

# Important System Rules

## Rule 1

Claim requirements must not be hardcoded.

Pacific Cross may change claim requirements.

## Rule 2

Claims should always be linked to:

- Client
- Policy
- Product
- Pacific Cross Contact

## Rule 3

Compliance requests may occur multiple times.

The system must support multiple compliance cycles.

## Rule 4

Pacific Insurance PH is not responsible for claim decisions.

The system should clearly distinguish:

Internal Actions

vs

Pacific Cross Decisions

## Rule 5

All claim communications should be logged.

Claims are one of the highest-risk areas for misunderstandings and disputes.

# Relationship Management Opportunity

Claims are often emotionally significant moments.

Upon claim closure, the system may create an optional relationship activity.

Examples:

- Recovery Check-In
- Thank You Message
- VIP Follow-Up
- Wellness Follow-Up

This should be configurable through the Relationship Management Module.

# Automation Opportunities

Version 1

- Missing document reminders
- Compliance reminders
- Follow-up tasks
- Claim aging alerts
- Client update reminders
- Claims dashboard alerts

# Exception Paths

## Missing Requirements

Status:

Pending Client Documents

## Compliance Required

Return to:

Requirements Collection Process

## Client Withdraws Claim

Status:

Closed - Withdrawn

## Duplicate Claim

Status:

Merged With Existing Claim

# Success Criteria

A claim workflow is successfully completed when:

- Claim submitted
- Required documents collected
- Pacific Cross decision recorded
- Client informed
- Claim record closed
- Communication history preserved

# Future Reporting

Potential reports:

- Claims Submitted
- Claims Approved
- Claims Rejected
- Claims By Product
- Average Claim Resolution Time
- Compliance Request Rate
- Client Satisfaction Follow-Up Rate

These reports may be added in future phases.
