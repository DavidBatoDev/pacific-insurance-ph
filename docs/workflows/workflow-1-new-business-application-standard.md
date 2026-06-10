> Source: `Workflow 1_ New Business Application (Standard).docx` — converted from the client’s Word document.

# Workflow 1: New Business Application (Standard)

## Pacific Insurance PH Agency Operations Platform

# Purpose

Manage the onboarding process for new clients applying for a standard Pacific Cross insurance policy through Pacific Insurance PH.

This workflow applies to:

- Select applicants
- Blue Royale applicants
- Ages 0–70
- No additional medical underwriting requirements beyond the standard application process

# Business Owner

Pacific Insurance PH

# External Provider

Pacific Cross

# Workflow Trigger

A prospective client expresses interest in obtaining a Pacific Cross insurance policy through Pacific Insurance PH.

Lead sources may include:

- Referral
- Existing client referral
- Personal network
- Business network
- Website inquiry
- Social media inquiry
- Walk-in inquiry
- Phone inquiry

# Workflow Status Flow

Lead

↓

Discovery

↓

Product Recommendation

↓

Application Package Sent

↓

Requirements Received

↓

Internal Review

↓

Submitted to Pacific Cross

↓

Under Review

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

## Step 1: Lead Created

Purpose:

Capture a new prospect.

Responsible:

Pacific Insurance PH

Actions:

- Create client record
- Record lead source
- Assign responsible staff member
- Schedule discovery conversation

Status:

Lead

## Step 2: Discovery Conversation

Purpose:

Understand client needs.

Responsible:

Pacific Insurance PH

Discussion topics:

- Age
- Family members
- Coverage goals
- Budget
- Travel frequency
- Existing insurance
- Medical history overview

Outputs:

- Product recommendation
- Initial qualification

Status:

Discovery

## Step 3: Product Recommendation

Purpose:

Recommend the appropriate Pacific Cross product.

Examples:

- Select Standard
- Select Plus
- Blue Royale Plan A
- Blue Royale Plan B
- Blue Royale Plan C

Outputs:

- Recommended product
- Recommended plan option

Status:

Product Recommendation

## Step 4: Application Package Sent

Purpose:

Provide application requirements.

Responsible:

Pacific Insurance PH

Documents may include:

- Application Form
- Brochure
- Attestation Letter
- Instructions

Documents must be selected from the current approved version in the Document Library.

Status:

Application Package Sent

## Step 5: Requirements Received

Purpose:

Collect required application documents.

Typical requirements:

- Completed Application Form
- Valid Government ID
- Attestation Letter
- Specimen Signatures

System must track:

- Received Date
- Missing Requirements
- Uploaded Documents

Status:

Requirements Received

## Step 6: Internal Review

Purpose:

Verify application completeness before submission.

Responsible:

Pacific Insurance PH

Review includes:

- Missing fields
- Missing signatures
- Missing documents
- Data inconsistencies

Possible Outcomes:

Complete → Proceed

Incomplete → Return to client

Status:

Internal Review

## Step 7: Submit to Pacific Cross

Purpose:

Submit application package to Pacific Cross.

Responsible:

Pacific Insurance PH

System should record:

- Submission Date
- Submitted By
- Pacific Cross Contact Used
- Submission Notes

Status:

Submitted to Pacific Cross

## Step 8: Under Review

Purpose:

Await Pacific Cross underwriting review.

Possible outcomes:

- Approved for proposal
- Request additional information
- Request medical clarification

Status:

Under Review

## Step 9: Illustrative Proposal Issued

Purpose:

Receive billing proposal from Pacific Cross.

Responsible:

Pacific Cross

System should record:

- Proposal Received Date
- Proposal Document
- Premium Amount
- Currency
- Plan Information

Status:

Illustrative Proposal Issued

## Step 10: Proposal Sent To Client

Purpose:

Present proposal and payment options.

Responsible:

Pacific Insurance PH

May include:

- Illustrative Proposal
- Payment Instructions
- Payment Methods

Status:

Awaiting Payment

## Step 11: Client Payment

Purpose:

Collect payment confirmation.

Accepted methods may include:

- Pacific Cross Payment Portal
- Credit Card
- Bank Transfer
- Over-the-Counter Payment
- Cashier Payment

System should record:

- Payment Date
- Amount
- Proof of Payment

Status:

Payment Received

## Step 12: Payment Confirmation Submitted

Purpose:

Forward proof of payment to Pacific Cross.

Important:

Policy issuance should not proceed until proof of payment has been submitted.

System should record:

- Date Submitted
- Pacific Cross Contact
- Confirmation Notes

Status:

Payment Confirmed

## Step 13: Policy Processing

Purpose:

Await policy issuance.

Typical outputs:

- Policy
- E-Card
- Official Service Invoice

Expected processing time:

Approximately 7–10 working days

Status:

Policy Processing

## Step 14: Policy Issued

Purpose:

Confirm issuance and delivery.

System should record:

- Policy Number
- Effective Date
- Expiry Date
- Renewal Date
- Policy Documents
- E-Card
- Official Service Invoice

Status:

Policy Issued

## Step 15: Active Client

Purpose:

Transition client into ongoing servicing.

Triggers:

- Renewal tracking
- Claims support eligibility
- Relationship management events
- Policy anniversary tracking

Status:

Active Client

# Required Documents

## Client Documents

- Application Form
- Valid ID
- Attestation Letter
- Specimen Signatures

## Pacific Cross Documents

- Illustrative Proposal
- Policy
- E-Card
- Official Service Invoice

# Automation Opportunities

Version 1

- Missing document reminders
- Proposal follow-up reminders
- Payment follow-up reminders
- Policy issuance follow-up reminders
- Task generation for stalled applications

# Exceptions

## Missing Requirements

Application remains in Requirements Pending status until completed.

## Medical Conditions Discovered

Application is transferred to:

Workflow 2: New Business Application (Medical Review)

## Applicant Age 71+

Application is transferred to:

Workflow 3: Senior Application

## Client Withdraws

Application status becomes:

Closed - Not Proceeding

Reason must be recorded.

# Success Criteria

A policy is considered successfully completed when:

- Policy Number exists
- Policy Status = Active
- Policy Documents received
- Client moved to Active Client status
- Renewal Date recorded
- Relationship Management tracking activated
