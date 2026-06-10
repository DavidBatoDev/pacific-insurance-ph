> Source: `Workflow 8_ Travel Insurance Fulfillment V2.docx` — converted from the client’s Word document.

# Workflow 8: Travel Insurance Fulfillment

## Pacific Insurance PH Agency Operations Platform (Version 2)

# Purpose

Manage the end-to-end travel insurance fulfillment process for Pacific Insurance PH.

Unlike medical insurance products, travel insurance operates as a rapid fulfillment workflow focused on:

- Fast turnaround
- Immediate payment collection
- Portal-based policy purchase
- Rapid policy delivery

The system should support the current operational process while remaining flexible for future payment methods and staffing changes.

# Business Owner

Pacific Insurance PH

# External Provider

Pacific Cross

# Workflow Trigger

A client requests travel insurance coverage.

Examples:

- Holiday travel
- Business travel
- Family travel
- Student travel
- Visa-related travel
- Short-term international travel

# Core Business Principle

The system should not be designed around a specific person.

The system should be designed around:

Payment Destinations

and

Portal Operators

which may change over time.

Examples:

Today:

- Eman GCash
- Eman UnionBank

Future:

- Pacific Insurance PH Business Account
- Pacific Insurance PH Maya
- Online Payment Gateway

# Workflow Status Flow

Travel Request Created

↓

Travel Details Collected

↓

Eligibility Validated

↓

Quote Confirmed

↓

Payment Request Generated

↓

Payment Request Sent

↓

Awaiting Payment

↓

Payment Proof Received

↓

Payment Verified

↓

Payment Acknowledged

↓

Portal Purchase Pending

↓

Portal Purchase Completed

↓

Policy Delivered

↓

Closed

# Detailed Workflow Steps

## Step 1: Travel Request Created

Purpose:

Create travel insurance request.

Responsible:

Pacific Insurance PH

System generates:

Travel Request Number

Example:

TRV-2026-000123

System records:

- Client
- Inquiry Date
- Assigned Staff Member
- Notes

Status:

Travel Request Created

## Step 2: Travel Details Collected

Purpose:

Collect traveler and trip information.

Required Information:

### Traveler Information

- Full Name
- Date of Birth
- Age
- Passport Number
- Nationality
- Contact Information

### Trip Information

- Destination
- Departure Date
- Return Date
- Trip Duration

System calculates:

- Traveler Age
- Trip Duration

Status:

Travel Details Collected

## Step 3: Eligibility Validated

Purpose:

Verify traveler eligibility.

System checks:

- Age limits
- Destination restrictions
- Product eligibility rules

Rules must remain configurable.

Possible outcomes:

Eligible

or

Ineligible

Status:

Eligibility Validated

## Step 4: Quote Confirmed

Purpose:

Determine travel insurance premium.

System records:

- Coverage Option
- Premium
- Currency
- Quote Date
- Quote Expiry Date

Status:

Quote Confirmed

## Step 5: Payment Request Generated

Purpose:

Generate formal Pacific Insurance PH payment request.

System creates:

- Reference Number
- Premium Amount
- Payment Instructions
- Payment Destination
- QR Code (if available)

The generated document should appear professional and branded.

Status:

Payment Request Generated

## Step 6: Payment Request Sent

Purpose:

Send payment request to client.

Delivery methods:

- Email
- WhatsApp
- Viber
- SMS

System records:

- Sent Date
- Sent By
- Delivery Method

Status:

Payment Request Sent

## Step 7: Awaiting Payment

Purpose:

Wait for client payment.

System tracks:

- Outstanding Amount
- Due Date
- Reminder Schedule

Status:

Awaiting Payment

## Step 8: Payment Proof Received

Purpose:

Receive proof of payment.

Accepted forms:

- Screenshot
- Transfer Confirmation
- Deposit Slip
- Payment Reference

System records:

- Payment Date
- Payment Amount
- Payment Method
- Uploaded Proof

Status:

Payment Proof Received

## Step 9: Payment Verified

Purpose:

Verify payment was actually received.

Responsible:

Assigned Staff Member

Verification includes:

- Correct amount
- Correct payment destination
- Successful transfer
- No duplicate transaction

System records:

- Verified By
- Verification Date

Status:

Payment Verified

## Step 10: Payment Acknowledged

Purpose:

Provide client confidence and confirmation.

System generates:

Travel Payment Acknowledgement

Includes:

- Travel Request Number
- Amount Received
- Date Received
- Status
- Next Step

Important:

This is not an insurance receipt.

This is a Pacific Insurance PH payment acknowledgement.

Status:

Payment Acknowledged

## Step 11: Portal Purchase Pending

Purpose:

Queue policy purchase.

Responsible:

Assigned Portal Operator

Examples:

- Eman
- Matt
- Future Staff Member

System records:

- Assigned Portal Operator
- Queue Date
- Priority

Status:

Portal Purchase Pending

## Step 12: Portal Purchase Completed

Purpose:

Purchase policy through Pacific Cross portal.

Responsible:

Assigned Portal Operator

System records:

- Purchase Date
- Portal Operator
- Policy Number
- Portal Confirmation Number

Expected processing time:

Minutes

Status:

Portal Purchase Completed

## Step 13: Policy Delivered

Purpose:

Deliver policy to traveler.

Documents:

- Travel Policy
- Certificate of Insurance
- Travel Assistance Information
- Claims Contact Information

System records:

- Delivery Date
- Delivery Method

Status:

Policy Delivered

## Step 14: Closed

Purpose:

Finalize travel insurance request.

System records:

- Completion Date
- Total Processing Time
- Issuance Time

Status:

Closed

# Payment Destination Architecture

The workflow must never reference specific personal accounts.

Instead use:

Payment Destination

Examples:

- Eman GCash
- Eman UnionBank
- Matt Bank Account
- Pacific Insurance PH Business Account
- Maya Business
- PayMongo

Each transaction stores:

- Payment Destination Used
- Account Snapshot
- Payment Method

Historical transactions must remain unchanged even if payment accounts are updated later.

# Portal Operator Architecture

The workflow must never assume Eman is the portal user.

Use:

Portal Operator

Examples:

- Eman
- Matt
- Future Operations Staff

Every purchase records:

- Operator
- Purchase Date
- Confirmation Number

# Important System Rules

## Rule 1

Payment must be verified before portal purchase.

## Rule 2

Payment acknowledgement must be sent before policy purchase.

## Rule 3

Travel policies must be linked to the client record.

## Rule 4

Payment destinations must be configurable.

## Rule 5

Portal operators must be configurable.

## Rule 6

Travel insurance workflows remain separate from medical insurance workflows.

# Automation Opportunities

Version 1

- Payment request emails
- Payment reminders
- Payment acknowledgement generation
- Purchase queue alerts
- Policy delivery emails
- Travel dashboard alerts

# Key Performance Indicators

Average Quote-to-Payment Time

Average Payment-to-Issuance Time

Average Issuance-to-Delivery Time

Travel Conversion Rate

Travel Revenue

Travel Policies Issued

Outstanding Payment Requests

# Success Criteria

A travel insurance transaction is successful when:

- Payment is verified
- Payment acknowledgement is sent
- Portal purchase is completed
- Policy number is recorded
- Policy is delivered
- Travel request is closed
- Full transaction history is preserved
