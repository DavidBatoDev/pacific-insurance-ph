> Source: `Data Model _ Database Schema (+ Update at the bottom).docx` — converted from the client’s Word document.

# Data Model / Database Schema

## Pacific Insurance PH Operations Platform

NOTE: I’ve added an update at the bottom about an additional product called Flexishied (related to Travel insurance).

# Purpose

Define the core database structure for the custom app used by Matt and Eman to manage their Pacific Cross insurance agency operations.

The system will be built directly as a custom application, not as a Google Sheets beta.

# Core Database Design Principle

The system should be configurable and future-proof.

Pacific Cross may change products, plans, pricing, forms, contacts, and requirements. Therefore, the database must avoid hardcoding product details or workflow rules.

# Main Tables

## 1. Users

Stores internal system users.

Examples:

- Matt
- Eman
- Future assistant/admin

Fields:

- User ID
- Full Name
- Email
- Role
- Status
- Created Date
- Last Login

Roles:

- Owner
- Admin
- Assistant
- Viewer

## 2. Clients

Stores prospects, active clients, former clients, and policyholders.

Fields:

- Client ID
- First Name
- Last Name
- Date of Birth
- Age
- Email
- Mobile Number
- Address
- Preferred Communication Channel
- Client Type
- VIP Status
- Lead Source
- Assigned Internal User
- Status
- Notes
- Created Date
- Updated Date

Client Types:

- Prospect
- Individual Client
- Family Client
- Corporate Contact
- Former Client

## 3. Dependents / Insured Persons

Stores family members or additional insured persons connected to a client or policy.

Fields:

- Insured Person ID
- Primary Client ID
- Policy ID
- Full Name
- Relationship to Primary Client
- Date of Birth
- Age
- Gender
- Email
- Mobile Number
- Notes

## 4. Products

Stores main Pacific Cross product categories.

Examples:

- Select
- Blue Royale
- BC Flexi
- Travel Insurance

Fields:

- Product ID
- Product Name
- Product Category
- Description
- Status
- Created Date
- Updated Date

## 5. Product Versions

Stores product versions by year or brochure cycle.

Examples:

- Select 2025
- Blue Royale 2025
- Select 2027

Fields:

- Product Version ID
- Product ID
- Version Name
- Effective Date
- Expiry Date
- Status
- Notes

Rule:

Every policy must be linked to the product version used at time of sale.

## 6. Plan Options

Stores plan tiers/options under each product version.

Examples:

- Select Plus Ward
- Select Plus Private 5M
- Select Standard Private 2M
- Blue Royale Plan A
- Blue Royale Plan B
- Blue Royale Plan C

Fields:

- Plan Option ID
- Product Version ID
- Plan Name
- Plan Family
- Coverage Tier
- Coverage Currency
- Maximum Coverage
- Coverage Description
- Status

## 7. Add-Ons / Optional Benefits

Stores optional benefits available for each product version or plan.

Examples:

- Outpatient
- Dental
- Vision
- Personal Accident

Fields:

- Add-On ID
- Product Version ID
- Plan Option ID
- Add-On Name
- Description
- Eligibility Rule
- Premium Rule
- Status

## 8. Discount Rules

Stores configurable discount options.

Examples:

- Co-Payment Discount
- Group Discount
- Deductible Discount
- Treatment Area Limitation

Fields:

- Discount Rule ID
- Product Version ID
- Plan Option ID
- Discount Name
- Discount Type
- Discount Value
- Eligibility Rule
- Applies To
- Status

## 9. Premium Tables

Stores or imports product pricing.

Fields:

- Premium ID
- Product Version ID
- Plan Option ID
- Age Band
- Currency
- Base Premium
- Payment Mode
- Effective Date
- Status

Payment Modes:

- Annual
- Semi-Annual

## 10. Policies

Stores actual client policies.

Fields:

- Policy ID
- Client ID
- Product ID
- Product Version ID
- Plan Option ID
- Policy Number
- Policy Status
- Effective Date
- Expiry Date
- Renewal Date
- Currency
- Premium Amount
- Payment Mode
- Assigned Internal User
- Pacific Cross Contact ID
- Notes

Policy Statuses:

- Pending
- Active
- Expired
- Renewed
- Cancelled
- Lapsed

## 11. Applications

Tracks new business applications.

Fields:

- Application ID
- Client ID
- Policy ID
- Product Version ID
- Plan Option ID
- Application Type
- Application Status
- Assigned Internal User
- Pacific Cross Contact ID
- Date Started
- Date Submitted to Pacific Cross
- Proposal Received Date
- Proposal Sent to Client Date
- Payment Received Date
- Payment Proof Sent Date
- Policy Issued Date
- Notes

Application Types:

- Standard
- Medical Evaluation
- Senior Application
- Travel Insurance
- Group Application

## 12. Workflow Templates

Stores configurable workflows.

Examples:

- New Business Standard
- New Business Medical
- Senior Application
- Renewal Standard
- Renewal Amendment
- Reinstatement
- Claim Submission
- Travel Insurance

Fields:

- Workflow Template ID
- Workflow Name
- Description
- Product Category
- Status

## 13. Workflow Steps

Stores steps inside each workflow template.

Fields:

- Workflow Step ID
- Workflow Template ID
- Step Name
- Step Order
- Description
- Default Assigned Role
- Default Due Days
- Required Document Rule
- Status

## 14. Workflow Instances

Stores actual workflows created for a client, policy, application, renewal, or claim.

Fields:

- Workflow Instance ID
- Workflow Template ID
- Client ID
- Policy ID
- Application ID
- Claim ID
- Renewal ID
- Current Step
- Current Status
- Assigned User
- Start Date
- Completed Date
- Notes

## 15. Required Document Templates

Stores configurable document checklists.

Examples:

- Standard Application Checklist
- Senior Application Checklist
- Medical Evaluation Checklist
- TAL Checklist
- Renewal Amendment Checklist
- Claim Reimbursement Checklist

Fields:

- Requirement Template ID
- Template Name
- Product Version ID
- Workflow Template ID
- Description
- Status

## 16. Required Document Items

Stores individual required documents inside each checklist.

Fields:

- Required Document Item ID
- Requirement Template ID
- Document Name
- Required / Optional
- Applies To
- Notes
- Sort Order

## 17. Documents

Stores uploaded client documents and Pacific Cross documents.

Examples:

- Application Form
- Valid ID
- Attestation Letter
- Medical Questionnaire
- Illustrative Proposal
- Policy
- E-card
- Official Service Invoice
- Renewal Notice
- Claim Form

Fields:

- Document ID
- Client ID
- Policy ID
- Application ID
- Claim ID
- Renewal ID
- Document Type
- Document Name
- File URL
- Version
- Uploaded By
- Uploaded Date
- Status
- Notes

## 18. Document Library

Stores reusable official forms, brochures, and templates.

Fields:

- Library Document ID
- Product Version ID
- Document Name
- Document Type
- File URL
- Effective Date
- Expiry Date
- Status
- Notes

Document Types:

- Brochure
- Application Form
- Attestation Letter
- Medical Questionnaire
- Renewal Form
- Claim Form
- Email Template Attachment

## 19. Payments

Tracks client payments.

Fields:

- Payment ID
- Client ID
- Policy ID
- Application ID
- Renewal ID
- Payment Amount
- Currency
- Payment Method
- Payment Date
- Proof of Payment Document ID
- Sent to Pacific Cross
- Sent to Pacific Cross Date
- OR Number
- OR Received Date
- Notes

## 20. Commissions

Tracks commission follow-up.

Fields:

- Commission ID
- Policy ID
- Client ID
- Payment ID
- OR Number
- Commission Voucher Status
- Commission Amount
- Currency
- Pacific Cross Commission Contact ID
- Follow-Up Date
- Received Date
- Notes

Statuses:

- Not Started
- Waiting for OR
- Voucher Pending
- Received
- Issue / Follow-Up Required

## 21. Renewals

Tracks policy renewals.

Fields:

- Renewal ID
- Policy ID
- Client ID
- Renewal Notice Date
- Policy Expiry Date
- Renewal Due Date
- Grace Period End Date
- Renewal Status
- Early Payment Flag
- Renewal Payment Date
- Renewal Completed Date
- Notes

Statuses:

- Upcoming
- Notice Received
- Reminder Sent
- Awaiting Payment
- Paid
- Renewed
- Grace Period
- Reinstatement Required
- Lapsed

## 22. Claims

Tracks claims.

Fields:

- Claim ID
- Client ID
- Policy ID
- Claim Type
- Incident Date
- Claim Submitted Date
- Pacific Cross Claims Contact ID
- Claim Status
- Compliance Required
- Compliance Due Date
- Claim Outcome
- Amount Claimed
- Amount Approved
- Currency
- Notes

Statuses:

- Draft
- Documents Pending
- Submitted
- Pending Review
- Compliance Required
- Approved
- Rejected
- Credited
- Closed

## 23. Communication Logs

Tracks client and Pacific Cross communication.

Fields:

- Communication ID
- Client ID
- Policy ID
- Application ID
- Renewal ID
- Claim ID
- Direction
- Channel
- Subject
- Summary
- Date
- Related User
- External Contact ID
- Email Thread ID
- Notes

Channels:

- Gmail
- Phone
- Viber
- WhatsApp
- iMessage
- In-Person
- Other

## 24. Email Templates

Stores reusable email templates.

Fields:

- Email Template ID
- Template Name
- Product Version ID
- Workflow Template ID
- Workflow Step ID
- Subject
- Body
- Status
- Last Updated Date

## 25. External Contacts

Stores Pacific Cross contacts and vendors.

Fields:

- External Contact ID
- Name
- Organization
- Role
- Department
- Email
- Phone
- Status
- Effective Date
- End Date
- Replacement Contact ID
- Notes

Types:

- Pacific Cross Territory Sales Manager
- Claims Contact
- Commission Contact
- Travel Contact
- Vendor
- Other

## 26. Tasks

Tracks operational tasks.

Fields:

- Task ID
- Task Title
- Task Type
- Client ID
- Policy ID
- Application ID
- Renewal ID
- Claim ID
- Assigned User
- Due Date
- Priority
- Status
- Completed Date
- Notes

Task Types:

- Follow-Up
- Missing Document
- Renewal Reminder
- Claim Follow-Up
- Payment Follow-Up
- Commission Follow-Up
- Relationship Activity

## 27. Relationship Event Types

Stores configurable relationship events.

Examples:

- Birthday
- Welcome Client
- Policy Anniversary
- Renewal Thank You
- Referral Thank You
- VIP Check-In
- Claim Approval Follow-Up

Fields:

- Relationship Event Type ID
- Event Name
- Description
- Trigger Type
- Default Timing
- Default Action
- Status

## 28. Relationship Activities

Stores actual relationship actions.

Fields:

- Relationship Activity ID
- Client ID
- Policy ID
- Relationship Event Type ID
- Activity Date
- Action Type
- Assigned User
- Status
- Cost
- Vendor Contact ID
- Notes

Action Types:

- Email
- Call
- Gift
- Card
- Reminder
- Manual Follow-Up

## 29. Referrals

Tracks referrals.

Fields:

- Referral ID
- Referring Client ID
- Referred Person Name
- Referred Person Contact
- Referral Date
- Referral Status
- Converted Client ID
- Thank You Activity ID
- Notes

Statuses:

- New
- Contacted
- In Progress
- Converted
- Not Converted

## 30. Audit Logs

Tracks system changes.

Fields:

- Audit Log ID
- User ID
- Action
- Table Name
- Record ID
- Previous Value
- New Value
- Timestamp

# Key Relationships

Client has many Policies.

Client has many Applications.

Client has many Claims.

Client has many Communication Logs.

Client has many Relationship Activities.

Policy belongs to one Client.

Policy belongs to one Product Version.

Policy belongs to one Plan Option.

Application belongs to one Client.

Application may become one Policy.

Renewal belongs to one Policy.

Claim belongs to one Policy.

Payment belongs to one Policy, Application, or Renewal.

Document may belong to a Client, Application, Policy, Renewal, or Claim.

Workflow Instance may belong to an Application, Renewal, Claim, or Relationship Activity.

# Important Rules

## Product Version Rule

Every policy must store the product version used at the time of sale.

This prevents old policies from being affected when Pacific Cross updates products.

## Document Version Rule

Every client-facing form or brochure sent must be tied to the document version used.

## Contact History Rule

Applications, claims, renewals, and commission follow-ups must store the Pacific Cross contact used at that time.

If a Pacific Cross contact is replaced, historical records should not be overwritten.

## Workflow Flexibility Rule

Workflow templates and steps should be configurable by an admin.

Matt and Eman should not need a developer to adjust simple step names, document requirements, or reminder timing.

## Relationship Flexibility Rule

Relationship events should be configurable.

The app should not be limited to birthday gifts.

Matt and Eman should be able to create new relationship event types later, such as:

- 5-Year Client Anniversary
- 10-Year Client Anniversary
- Referral Thank You
- Claim Recovery Follow-Up

# Suggested Build Priority

## Build First

- Users
- Clients
- Dependents
- Products
- Product Versions
- Plan Options
- Policies
- Applications
- Documents
- Payments
- Renewals
- Claims
- Tasks
- External Contacts

## Build Second

- Workflow Templates
- Workflow Steps
- Workflow Instances
- Required Document Templates
- Email Templates
- Communication Logs

## Build Third

- Relationship Events
- Relationship Activities
- Referrals
- Commissions
- Audit Logs
- Advanced Dashboards

# Summary

The data model should support a flexible agency operations system, not a hardcoded Pacific Cross CRM.

The system should be able to adapt when products, contacts, forms, pricing, workflows, and client relationship strategies change.

**Data Model Update: FlexiShield and External Coverage**

## Purpose

Update the database schema to support FlexiShield as a separate Pacific Cross product line.

FlexiShield introduces a new concept:

First-Layer Coverage

This means Pacific Insurance PH must track external HMO coverage that exists before FlexiShield becomes payable.

# Product Table Update

The Products table should allow the following Product Categories:

- Primary Medical
- Group Medical
- Second-Layer Medical
- Travel Insurance
- Other

Example:

Product Name: FlexiShield Product Category: Second-Layer Medical Provider: Pacific Cross Status: Active

# New Table: External Coverage / First-Layer Coverage

## Purpose

Stores external HMO or insurance coverage that may affect a Pacific Insurance PH policy.

This is required for FlexiShield and may be useful for future products.

## Fields

- External Coverage ID
- Client ID
- Policy ID
- Coverage Type
- Provider Name
- Plan Name
- Maximum Benefit Limit
- Currency
- Effective Date
- Expiry Date
- Status
- Proof Document ID
- Notes

## Coverage Types

Examples:

- HMO
- Corporate HMO
- Employer Health Plan
- Other Insurance
- Unknown

# FlexiShield Policy Fields

For FlexiShield policies, the system should capture:

- First-Layer Coverage ID
- First-Layer HMO Provider
- First-Layer HMO Plan
- First-Layer Maximum Benefit Limit
- Deductible Range
- FlexiShield Variant

# FlexiShield Plan Options

The Plan Options table should support:

- FlexiShield 150
- FlexiShield 200

Example:

Plan Option: FlexiShield 150 Deductible Range: PHP150,000 to PHP199,000

Plan Option: FlexiShield 200 Deductible Range: PHP200,000 and up

# Required Document Template Update

FlexiShield may require a product-specific checklist.

Example:

FlexiShield Application Checklist

Possible requirements:

- Application Form
- Valid ID
- Proof of Existing HMO
- HMO Schedule of Benefits
- HMO Maximum Benefit Limit
- Other Supporting Documents

Requirements should remain configurable.

# Claims Implication

FlexiShield claims are different because they depend on exhaustion of the first-layer HMO.

Claims should be able to capture:

- First-layer HMO exhausted?
- HMO MBL amount
- HMO payment proof
- Remaining eligible expenses
- FlexiShield payable amount

This does not require a separate claims workflow yet, but the claims table should allow product-specific claim fields.

# System Rule

A FlexiShield policy should not be considered complete unless first-layer coverage details are recorded.

# Summary

FlexiShield confirms that the system must support external coverage relationships.

This keeps the app flexible for products that depend on other insurance, HMOs, or employer coverage.
