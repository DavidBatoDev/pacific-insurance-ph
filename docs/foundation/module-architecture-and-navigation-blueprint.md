> Source: `Module Architecture & Navigation Blueprint V1.docx` — converted from the client’s Word document.

# Module Architecture & Navigation Blueprint

## Pacific Insurance PH Agency Operations Platform

# Purpose

Define the complete module architecture of the Pacific Insurance PH platform.

This blueprint serves as the master map of the system.

It describes:

- Core modules
- Module relationships
- Navigation structure
- Data ownership
- User interaction flow

# System Design Philosophy

The platform is built around the Client.

Every major business process ultimately relates back to a client.

# Core System Structure

Client

↓

Applications

↓

Policies

↓

Renewals

↓

Claims

↓

Travel Insurance

↓

Documents

↓

Communications

↓

Relationship Activities

# Module Overview

## Module 1

Dashboard

Purpose:

Operational command center.

Primary Users:

- Matt
- Eman

Functions:

- KPI Monitoring
- Work Queues
- Alerts
- Activity Feed

## Module 2

Clients

Purpose:

Central CRM module.

Primary Record:

Client

Functions:

- Client Profiles
- Contact Information
- Activity History
- Relationship Tracking

## Module 3

Applications

Purpose:

Manage all new business applications.

Functions:

- Application Processing
- Requirements Collection
- Medical Review Tracking
- Payment Tracking
- Policy Issuance Tracking

Products Supported:

- Select
- Blue Royale
- BC Flexi
- FlexiShield
- Future Products

## Module 4

Policies

Purpose:

Manage active insurance policies.

Functions:

- Policy Tracking
- Status Management
- Coverage Information
- Document Management

## Module 5

Renewals

Purpose:

Manage policy renewal lifecycle.

Functions:

- Renewal Scheduling
- Reminder Tracking
- Renewal Payments
- Renewal Processing

## Module 6

Claims

Purpose:

Manage claims assistance workflow.

Functions:

- Claim Tracking
- Document Collection
- Compliance Tracking
- Status Updates

## Module 7

Travel Insurance

Purpose:

Manage travel insurance fulfillment.

Functions:

- Travel Requests
- Quotes
- Payment Requests
- Payment Verification
- Portal Purchase Tracking
- Policy Delivery

## Module 8

Documents

Purpose:

Centralized document management.

Functions:

- Upload
- Storage
- Versioning
- Security
- Client Visibility Controls

## Module 9

Communications

Purpose:

Central communication history.

Functions:

- Email Tracking
- Notification Tracking
- Communication Logs

## Module 10

Tasks

Purpose:

Operational workload management.

Functions:

- Task Creation
- Assignment
- Due Dates
- Follow-Up Tracking

## Module 11

Relationship Management

Purpose:

Client loyalty and retention.

Functions:

- Birthday Activities
- Anniversary Activities
- Welcome Activities
- Loyalty Programs
- Custom Activities

## Module 12

Reports & Analytics

Purpose:

Business intelligence.

Functions:

- KPI Reporting
- Pipeline Reporting
- Renewal Reporting
- Claims Reporting
- Travel Reporting

## Module 13

Settings & Administration

Purpose:

Platform configuration.

Functions:

- User Management
- Product Configuration
- Payment Destinations
- Templates
- Workflow Rules

# Client Hub Module

Separate but connected.

Purpose:

Provide clients with a secure read-only experience.

Functions:

- Policy Visibility
- Claim Visibility
- Renewal Visibility
- Travel Visibility
- Document Access
- Status Tracking

# Navigation Structure

Dashboard

Clients

Applications

Policies

Renewals

Claims

Travel Insurance

Documents

Tasks

Relationship Management

Reports

Settings

# Client-Centric Data Flow

Client

↓

Application

↓

Policy

↓

Renewal

↓

Claim

↓

Documents

↓

Communications

↓

Relationship Activities

# Cross-Module Relationships

## Client Module

Connected To:

- Applications
- Policies
- Renewals
- Claims
- Travel Insurance
- Documents
- Communications
- Relationship Activities

## Applications Module

Connected To:

- Clients
- Policies
- Documents
- Tasks
- Communications

## Policies Module

Connected To:

- Clients
- Renewals
- Claims
- Documents

## Renewals Module

Connected To:

- Clients
- Policies
- Documents
- Communications

## Claims Module

Connected To:

- Clients
- Policies
- Documents
- Communications
- Tasks

## Travel Insurance Module

Connected To:

- Clients
- Payment Requests
- Documents
- Communications

# Security Boundaries

## Internal Modules

Accessible only to staff.

Examples:

- Tasks
- Internal Notes
- Reports
- Settings

## Client Hub

Accessible only to client.

Limited visibility.

No internal records exposed.

# Version 1 Core Modules

Must Be Included:

✅ Dashboard

✅ Clients

✅ Applications

✅ Policies

✅ Renewals

✅ Claims

✅ Travel Insurance

✅ Documents

✅ Tasks

✅ Communications

✅ Relationship Management

✅ Reports

✅ Settings

✅ Client Hub

# Future Modules

Potential future additions:

## Commission Management

Track:

- Commissions
- Vouchers
- Payments

## Referral Management

Track:

- Referral Sources
- Referral Partners
- Referral Performance

## Marketing CRM

Track:

- Campaigns
- Lead Sources
- Email Marketing

## Online Payments

Support:

- GCash
- Maya
- Payment Gateways

## Pacific Cross Integrations

Potential future integrations.

Not included in Version 1.

# Success Criteria

The Module Architecture is successful when:

- Every business process has a clear home
- Navigation is intuitive
- Data flows logically
- Future growth is supported
- New products can be added without redesigning the system
- The platform remains client-centric
