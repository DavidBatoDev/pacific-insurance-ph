> Source: `Reference Numbering & Record Identification Framework.docx` — converted from the client’s Word document.

# Reference Numbering & Record Identification Framework

## Pacific Insurance PH Agency Operations Platform

# Purpose

Define the identification and numbering system used throughout the platform.

Every major record should have:

1. Internal System ID
1. Human-Friendly Reference Number

The internal ID is used by the system.

The reference number is used by:

- Staff
- Clients
- Reports
- Emails
- Documents
- Client Hub

# Design Principles

## Principle 1

Reference numbers should be human-readable.

Users should never need to reference database IDs.

## Principle 2

Reference numbers should be unique.

No duplicates.

## Principle 3

Reference numbers should indicate record type.

Users should immediately recognize what they are viewing.

## Principle 4

Reference numbers should remain permanent.

Once assigned, a reference number should never change.

# Record Identification Structure

Every record contains:

## Internal ID

Example:

104582

Used only by the system.

## Public Reference Number

Example:

APP-2026-000123

Visible to users.

# Client Reference Number

Purpose:

Identify clients.

Format:

CLI-2026-000123

Example:

CLI-2026-000123

Generated when a client is first created.

Remains the same for life.

# Application Reference Number

Purpose:

Identify new applications.

Format:

APP-2026-000123

Example:

APP-2026-000123

Used in:

- Emails
- Client Hub
- Documents
- Internal communication

# Policy Reference Number

Purpose:

Internal policy tracking.

Format:

POL-2026-000123

Example:

POL-2026-000123

Note:

This is separate from the official Pacific Cross policy number.

Store both.

# Pacific Cross Policy Number

Purpose:

Official provider policy identifier.

Example:

PC-123456789

Provided by Pacific Cross.

Stored alongside internal policy record.

# Renewal Reference Number

Purpose:

Track renewal processes.

Format:

REN-2026-000123

Example:

REN-2026-000123

Every renewal receives its own record.

# Claim Reference Number

Purpose:

Track claims.

Format:

CLM-2026-000123

Example:

CLM-2026-000123

Used in:

- Client Hub
- Claims communications
- Internal tracking

# Travel Insurance Reference Number

Purpose:

Track travel insurance requests.

Format:

TRV-2026-000123

Example:

TRV-2026-000123

Used throughout travel workflow.

# Document Reference Number

Purpose:

Track uploaded and generated documents.

Format:

DOC-2026-000123

Example:

DOC-2026-000123

Used for:

- Audit trail
- Version control

# Task Reference Number

Purpose:

Track operational tasks.

Format:

TSK-2026-000123

Example:

TSK-2026-000123

# Communication Reference Number

Purpose:

Track emails and communications.

Format:

COM-2026-000123

Example:

COM-2026-000123

# Relationship Activity Reference Number

Purpose:

Track loyalty and relationship activities.

Format:

REL-2026-000123

Examples:

- Birthday Activity
- Welcome Activity
- Anniversary Activity

# Payment Request Reference Number

Purpose:

Track payment requests.

Format:

PAY-2026-000123

Example:

PAY-2026-000123

Particularly important for:

- Travel Insurance
- Renewals
- Applications

# User Reference Number

Purpose:

Track system users.

Format:

USR-2026-000123

Example:

USR-2026-000123

# Client Hub Access Token

Purpose:

Provide secure client access.

Format:

Random Secure Token

Example:

4fX9qL2zA7mP8rT

Important:

Do not expose:

- Client ID
- Application ID
- Policy ID

inside URLs.

# Search Rules

Global Search should support:

- Client Name
- Email
- Mobile Number
- Policy Number
- Application Number
- Claim Number
- Travel Number
- Renewal Number

# Display Rules

Always display:

Reference Number

Examples:

Application:

APP-2026-000123

Claim:

CLM-2026-000456

Travel:

TRV-2026-000789

This makes communication easier between staff and clients.

# Future Growth Considerations

The numbering system should support:

- Multiple staff
- Multiple offices
- Future products
- Future modules

without requiring changes.

# Success Criteria

The framework is successful when:

- Every major record is uniquely identifiable
- Clients can reference records easily
- Staff can search quickly
- Reports are easier to understand
- Audit trails remain accurate
- Future modules can adopt the same structure
