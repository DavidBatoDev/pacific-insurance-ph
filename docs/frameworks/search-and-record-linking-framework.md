> Source: `Search, Global Search & Record Linking Framework.docx` — converted from the client’s Word document.

# Search, Global Search & Record Linking Framework

## Pacific Insurance PH Agency Operations Platform

# Purpose

Define how records are connected, searched, and navigated throughout the Pacific Insurance PH platform.

The goal is to ensure that staff can quickly locate information regardless of where they start.

This framework applies to:

- Clients
- Applications
- Policies
- Renewals
- Claims
- Travel Insurance
- Documents
- Communications
- Tasks
- Relationship Activities

# Design Philosophy

The platform should be client-centric.

Everything ultimately revolves around the client.

# Core Relationship Model

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

Documents

↓

Communications

↓

Relationship Activities

# Client As Master Record

The Client record serves as the primary anchor for all activity.

Every major record should link back to a client.

Examples:

### Application

Belongs To:

Client

### Policy

Belongs To:

Client

### Renewal

Belongs To:

Policy

Client

### Claim

Belongs To:

Policy

Client

### Travel Request

Belongs To:

Client

### Document

Belongs To:

Client

and

Related Record

### Communication

Belongs To:

Client

and

Related Record

# Global Search

Purpose:

Allow staff to search the entire platform from one search bar.

# Searchable Record Types

## Clients

Search By:

- Name
- Email
- Mobile Number
- Client Reference Number

## Applications

Search By:

- Application Number
- Applicant Name

## Policies

Search By:

- Internal Policy Number
- Pacific Cross Policy Number

## Renewals

Search By:

- Renewal Number

## Claims

Search By:

- Claim Number

## Travel Insurance

Search By:

- Travel Reference Number

## Documents

Search By:

- File Name
- Document Type
- Document Number

## Communications

Search By:

- Email Subject
- Communication Number

# Search Result Display

Results should be grouped by type.

Example:

Search:

John Santos

Results:

Client

Application

Policy

Claim

Travel Request

Document

# Universal Record Header

Every major record should display a summary panel.

Example:

Client:

John Santos

CLI-2026-000123

Display:

- Active Policies
- Open Claims
- Upcoming Renewals
- Open Travel Requests

# Record Linking Rules

## Client → Applications

One Client

Can Have

Many Applications

## Client → Policies

One Client

Can Have

Many Policies

## Policy → Renewals

One Policy

Can Have

Many Renewals

## Policy → Claims

One Policy

Can Have

Many Claims

## Client → Travel Requests

One Client

Can Have

Many Travel Requests

## Client → Documents

One Client

Can Have

Many Documents

## Client → Communications

One Client

Can Have

Many Communications

# Related Records Panel

Every record should show related information.

Example:

Application Screen

Shows:

- Client
- Documents
- Communications
- Tasks

Claim Screen

Shows:

- Client
- Policy
- Documents
- Communications

Travel Request Screen

Shows:

- Client
- Travelers
- Payment Requests
- Documents

# Quick Navigation

Users should be able to jump directly to related records.

Example:

Client

↓

Policy

↓

Claim

↓

Documents

Without returning to menus.

# Recent Records

The system should maintain:

Recent Clients

Recent Applications

Recent Claims

Recent Travel Requests

Recent Documents

For fast access.

# Favorites / Pinned Records

Future enhancement.

Allow users to pin:

- VIP Clients
- Complex Claims
- Important Applications

# Duplicate Detection

The system should help identify possible duplicates.

Examples:

Same:

- Email
- Mobile Number
- Name + Date of Birth

Potential duplicate warning should appear.

# Advanced Search Filters

Support filtering by:

## Clients

- Assigned Staff
- Product
- Status

## Policies

- Product
- Expiry Date
- Status

## Claims

- Status
- Date Range

## Travel Insurance

- Destination
- Status
- Travel Dates

# Search Permissions

Search results should respect user permissions.

Examples:

Clients may only access:

Their own records.

Read-Only users cannot modify records.

# Client Hub Search

Version 1:

No search required.

Clients primarily navigate through:

- Dashboard
- Policies
- Claims
- Documents

# Future Enhancements

Potential future additions:

- OCR Document Search
- AI Search Assistant
- Natural Language Search

Examples:

"Show me claims awaiting documents"

"Show me renewals due this month"

Not included in Version 1.

# Success Criteria

The Search Framework is successful when:

- Staff can locate any record within seconds
- Related records are easy to navigate
- Duplicate records are minimized
- Search remains fast as data grows
- Users spend less time navigating menus
- The client remains the central record throughout the platform
