# Master System Blueprint (Version 2)

> Source: `Master System Blueprint (Version 2 + Update at the bottom).docx` — converted from the client’s Word document.

## Master System Blueprint (Version 2)

## Pacific Insurance PH Operations Platform

NOTE: I’ve added an update at the bottom about an additional product called Flexishied (related to Travel insurance).

# System Purpose

Provide Matt and Eman with a centralized operations platform to manage:

- Leads
- Clients
- Policies
- Applications
- Renewals
- Claims
- Documents
- Communications
- Tasks
- Relationships
- Pacific Cross interactions

The platform is designed around Matt and Eman's business processes, not Pacific Cross's internal systems.

# Core Design Principles

## Principle 1: Pacific Cross Is An External Partner

The platform must not assume Pacific Cross processes are fixed.

Products, forms, contacts, pricing, and requirements may change over time.

The platform must adapt without requiring software redevelopment.

## Principle 2: Configuration Over Custom Development

Whenever possible:

- Products should be configurable
- Contacts should be configurable
- Documents should be configurable
- Templates should be configurable
- Relationship events should be configurable

## Principle 3: Human-Centered Operations

Many clients are seniors.

Many clients prefer:

- Phone calls
- Viber
- WhatsApp
- Direct conversations

The system should support human service, not replace it.

# Module 1: CRM & Client Management

Purpose:

Maintain a complete client record.

Includes:

- Prospects
- Active clients
- Former clients
- Dependents
- Corporate groups

Tracks:

- Contact details
- Family relationships
- Policies
- Claims
- Communications
- Notes

# Module 2: Product & Plan Management

Purpose:

Manage Pacific Cross products and versions.

Supports:

Products

- Select
- Blue Royale
- BC Flexi
- Travel

Versions

- Select 2025
- Select 2027

Plan Structures

- Select Plus
- Select Standard
- Blue Royale A/B/C

Optional Benefits

- Outpatient
- Dental
- Vision
- Personal Accident

Discount Rules

- TAL
- Deductible
- Group Discount
- Co-Payment

# Module 3: Workflow Engine

Purpose:

Manage agency processes.

Workflows include:

- New Business Standard
- New Business Medical
- Senior Application
- Renewal Standard
- Renewal Amendment
- Reinstatement
- Claims
- Travel Insurance

Workflow steps must be configurable.

# Module 4: Application Management

Purpose:

Track policy applications from inquiry through issuance.

Tracks:

- Status
- Requirements
- Submission history
- Proposal issuance
- Payment
- Policy release

# Module 5: Document Management System

Purpose:

Store and version all documents.

Includes:

- Brochures
- Forms
- Endorsements
- Medical questionnaires
- Renewal forms
- Claim forms

Supports:

- Version control
- Effective dates
- Expiry dates
- Active status

# Module 6: Communication Hub

Purpose:

Maintain communication history.

Sources:

- Gmail
- Notes
- Phone logs
- Viber notes
- WhatsApp notes

Stores:

- Outbound communication
- Inbound communication
- Internal notes

# Module 7: Payment & Commission Tracking

Purpose:

Track payment processing and commission follow-up.

Tracks:

- Payment method
- Proof of payment
- OR number
- Commission voucher
- Commission status

# Module 8: Renewal Management

Purpose:

Manage retention and policy renewals.

Tracks:

- Renewal notice
- Renewal status
- Reminder schedule
- Grace period
- Reinstatement

Supports suppression of reminders for early payers.

# Module 9: Claims Management

Purpose:

Track claims from submission through resolution.

Tracks:

- Claim type
- Documents
- Compliance requests
- Outcomes

Statuses:

- Submitted
- Pending
- Compliance Required
- Approved
- Rejected
- Credited

# Module 10: Relationship Management

Purpose:

Support client retention and relationship building.

The system should not be limited to birthdays.

Supports configurable relationship events.

Examples:

- Birthday
- Welcome Client
- Policy Anniversary
- Renewal Thank You
- Referral Appreciation
- Claim Approval Follow-Up
- VIP Client Check-In

Administrators may create new event types without developer assistance.

Version 1 Actions:

- Create Task
- Send Email
- Send Reminder

Advanced automation may be added in future phases.

# Module 11: Contact Directory

Purpose:

Manage Pacific Cross and vendor contacts.

Supports:

- Territory Sales Managers
- Claims Contacts
- Commission Contacts
- Travel Insurance Contacts
- Vendors

Maintains contact history.

Allows staff changes without breaking historical records.

# Module 12: Task Management

Purpose:

Centralize all operational work.

Examples:

- Missing documents
- Follow-up calls
- Renewal reminders
- Claims follow-up
- Commission follow-up
- Relationship activities

# Module 13: Reporting & Dashboards

Includes:

Daily Operations Dashboard

Application Pipeline

Renewal Dashboard

Claims Dashboard

Commission Dashboard

Relationship Dashboard

# Phase 1 Deliverables

Google Sheets Operational System

Workflow Validation

Document Library

Application Tracking

Renewal Tracking

Claims Tracking

Task Tracking

Relationship Tracking

# Phase 2 Deliverables

Custom Web Application

Gmail Integration

Client Portal

Document Uploads

Automated Reminders

Advanced Reporting

Role-Based Access

Audit Logs

Advanced Relationship Automation

# Master Blueprint Update: FlexiShield Product Inclusion

## Product Portfolio Update

Pacific Insurance PH currently supports or may support the following Pacific Cross product lines:

- Select
- Blue Royale
- BC Flexi
- Travel Insurance / Travelsafe
- FlexiShield

FlexiShield should be treated as a separate product line.

# FlexiShield Product Classification

FlexiShield is a second-layer medical coverage product.

It is designed to provide additional medical coverage on top of an existing HMO plan.

Unlike Select or Blue Royale, FlexiShield is not a primary medical insurance product.

It requires the client to have an existing first-layer HMO plan.

# FlexiShield System Implication

The system must support products that depend on external or existing coverage.

For FlexiShield, the app should capture:

- Existing HMO provider
- Existing HMO plan name
- Existing HMO maximum benefit limit
- Deductible range
- First-layer coverage details
- Whether the first-layer HMO is active

# Updated Product Categories

The Product Library should support the following product categories:

## Primary Medical Insurance

Examples:

- Select
- Blue Royale

## Group / Corporate Medical Coverage

Examples:

- BC Flexi

## Second-Layer Medical Coverage

Examples:

- FlexiShield

## Travel Insurance

Examples:

- Travelsafe

# Workflow Impact

FlexiShield does not need a separate workflow at this stage.

It can use the existing medical insurance workflows:

- New Business Standard
- New Business Medical Review
- Senior Application
- Renewal Standard
- Renewal Amendment
- Reinstatement
- Claims Assistance

However, FlexiShield may require additional product-specific fields and requirements related to the client’s first-layer HMO.

# Product Design Rule

The system must not assume all medical products are standalone coverage.

Some products, such as FlexiShield, may depend on another active insurance or HMO plan.

Therefore, the Product Library must support:

- Standalone products
- Add-on products
- Second-layer products
- Travel products
- Group products
