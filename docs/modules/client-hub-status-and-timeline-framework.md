> Source: `Client Hub Status & Timeline Framework.docx` — converted from the client’s Word document.

# Client Hub Status & Timeline Framework

## Pacific Insurance PH Agency Operations Platform

# Purpose

Define the status system used throughout the Client Hub.

The goal is to provide clients with clear, understandable updates without exposing internal operations, underwriting discussions, or Pacific Cross communications.

This framework standardizes how statuses appear across:

- Applications
- Policies
- Claims
- Renewals
- Travel Insurance

# Design Principles

## Principle 1

Statuses must be client-friendly.

Avoid internal terminology whenever possible.

Example:

Instead of:

"Pending Underwriting Review"

Use:

"Under Review"

## Principle 2

Statuses should communicate action.

The client should immediately understand:

- What is happening
- What is required
- What happens next

## Principle 3

Statuses should not expose internal discussions.

Do not display:

- Internal notes
- Pacific Cross communications
- Internal task names
- Internal escalation details

## Principle 4

Statuses should remain consistent across modules.

The same colors and meanings should be used throughout the Client Hub.

# Status Color System

## Green

Meaning:

Completed / Approved / Active

Examples:

- Active
- Approved
- Issued
- Renewed
- Delivered

## Blue

Meaning:

In Progress

Examples:

- Submitted
- Under Review
- Processing

## Orange

Meaning:

Waiting For Client Action

Examples:

- Awaiting Documents
- Awaiting Payment
- Additional Information Required

## Red

Meaning:

Issue Preventing Progress

Examples:

- Rejected
- Expired
- Declined
- Ineligible

## Gray

Meaning:

Closed / Historical

Examples:

- Completed
- Withdrawn
- Archived

# Application Status Framework

## Submitted

Description:

Your application has been received.

Color:

Blue

## Under Review

Description:

Your application is being reviewed.

Color:

Blue

## Additional Information Required

Description:

Additional information or documents are needed.

Color:

Orange

## Awaiting Payment

Description:

Payment is required before processing can continue.

Color:

Orange

## Processing

Description:

Your application is being finalized.

Color:

Blue

## Policy Issued

Description:

Your policy has been issued.

Color:

Green

## Not Proceeding

Description:

The application has been closed.

Color:

Gray

# Claims Status Framework

## Submitted

Description:

Your claim has been received.

Color:

Blue

## Additional Documents Required

Description:

Additional documents are needed.

Color:

Orange

## Under Review

Description:

Your claim is currently being reviewed.

Color:

Blue

## Approved

Description:

Your claim has been approved.

Color:

Green

## Partially Approved

Description:

Part of your claim has been approved.

Color:

Green

## Rejected

Description:

Your claim was not approved.

Color:

Red

## Closed

Description:

The claim process has been completed.

Color:

Gray

# Renewal Status Framework

## Renewal Upcoming

Description:

Your policy is approaching renewal.

Color:

Blue

## Awaiting Payment

Description:

Payment is required to complete your renewal.

Color:

Orange

## Renewal Processing

Description:

Your renewal is currently being processed.

Color:

Blue

## Renewed

Description:

Your policy has been successfully renewed.

Color:

Green

## Not Renewed

Description:

The renewal process has been closed.

Color:

Gray

# Travel Insurance Status Framework

## Quote Confirmed

Description:

Your travel insurance quote is ready.

Color:

Blue

## Payment Request Sent

Description:

Payment instructions have been sent.

Color:

Orange

## Awaiting Payment

Description:

Payment is required before policy issuance.

Color:

Orange

## Payment Verified

Description:

Payment has been confirmed.

Color:

Blue

## Policy Purchase In Progress

Description:

Your travel policy is being processed.

Color:

Blue

## Policy Issued

Description:

Your travel policy has been issued.

Color:

Green

## Closed

Description:

Your travel insurance request is complete.

Color:

Gray

# Policy Status Framework

## Active

Description:

Your policy is active.

Color:

Green

## Pending Activation

Description:

Your policy is being finalized.

Color:

Blue

## Expiring Soon

Description:

Your policy is approaching expiration.

Color:

Orange

## Expired

Description:

Your policy is no longer active.

Color:

Red

## Cancelled

Description:

Your policy has been cancelled.

Color:

Gray

# Client Timeline Framework

Every major record should display a timeline.

Examples:

Applications

Claims

Renewals

Travel Insurance

# Example Timeline

Application Submitted

✓ May 1

↓

Documents Received

✓ May 3

↓

Under Review

✓ May 5

↓

Awaiting Payment

(Current)

↓

Policy Issuance

(Pending)

# Timeline Rules

## Rule 1

Clients should see:

Completed Steps

Current Step

Upcoming Step

## Rule 2

Clients should never see:

Internal Staff Tasks

Internal Escalations

Internal Pacific Cross Communications

## Rule 3

Timeline updates should be generated automatically from workflow status changes.

# Client Action Required System

The Client Hub should prominently display any action required from the client.

Examples:

- Upload Missing Documents
- Submit Additional Information
- Make Payment
- Review Renewal

Action items should always appear at the top of the Client Hub dashboard.

# Notification Integration

Future versions may generate:

- Email Notifications
- SMS Notifications
- Viber Notifications
- WhatsApp Notifications

when status changes occur.

Version 1 only requires status visibility inside the Client Hub.

# Success Criteria

A client should be able to answer the following questions without contacting Pacific Insurance PH:

- What is the current status?
- What happens next?
- Is anything required from me?
- When was the last update?
- Who should I contact if I need help?

If those questions can be answered from the Client Hub, the Status & Timeline Framework is successful.
