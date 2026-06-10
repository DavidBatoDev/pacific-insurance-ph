> Source: `Activity Timeline & Audit Trail Framework.docx` — converted from the client’s Word document.

# Activity Timeline & Audit Trail Framework

## Pacific Insurance PH Agency Operations Platform

# Purpose

Provide a complete chronological history of all activity within the Pacific Insurance PH platform.

The Activity Timeline serves as the system's operational memory.

The Audit Trail serves as the system's accountability record.

Together they provide:

- Visibility
- Accountability
- Compliance support
- Operational history
- Client service support
- Staff transparency

# Business Objectives

The system should answer questions such as:

- Who created this application?
- When was the document uploaded?
- When was payment received?
- Who verified the payment?
- When was the policy issued?
- Who updated the claim?
- When was the renewal reminder sent?
- When did the client access their Client Hub?

Without requiring staff to search through emails, Viber messages, or spreadsheets.

# Design Principles

## Principle 1

Every significant action creates an activity record.

## Principle 2

Activities should be automatic whenever possible.

## Principle 3

Audit records should never be editable.

## Principle 4

The timeline should tell the complete story of a record.

# Activity Timeline vs Audit Trail

## Activity Timeline

Human-friendly history.

Purpose:

Help staff understand what happened.

Example:

Application Created

May 1, 2026

9:42 AM

Created by Eman

## Audit Trail

System-level record.

Purpose:

Compliance and accountability.

Example:

Field Changed

Status

Old Value:

Awaiting Payment

New Value:

Payment Verified

User:

Eman

Timestamp:

2026-05-03 09:42:15

# Timeline Scope

The following records should have timelines:

## Client

## Application

## Policy

## Renewal

## Claim

## Travel Request

## Document

## Payment Request

## Relationship Activity

# Client Timeline

Examples:

- Client Created
- Contact Details Updated
- New Policy Issued
- Claim Submitted
- Renewal Started
- Travel Request Created

# Application Timeline

Examples:

- Application Created
- Documents Requested
- Documents Received
- Medical Review Required
- Payment Requested
- Payment Verified
- Policy Issued
- Application Closed

# Policy Timeline

Examples:

- Policy Created
- Policy Activated
- Renewal Created
- Policy Renewed
- Policy Expired

# Renewal Timeline

Examples:

- Renewal Generated
- Reminder Sent
- Payment Requested
- Payment Received
- Renewal Completed

# Claims Timeline

Examples:

- Claim Created
- Documents Requested
- Documents Received
- Submitted To Pacific Cross
- Compliance Required
- Additional Documents Submitted
- Claim Approved
- Claim Closed

# Travel Insurance Timeline

Examples:

- Travel Request Created
- Quote Confirmed
- Payment Request Sent
- Payment Verified
- Payment Acknowledged
- Portal Purchase Completed
- Policy Issued
- Policy Delivered

# Document Timeline

Examples:

- Uploaded
- Reviewed
- Approved
- Replaced
- Archived
- Downloaded

# Communication Timeline

Examples:

- Email Sent
- Renewal Reminder Sent
- Payment Request Sent
- Claim Notification Sent
- Travel Policy Delivered

# Relationship Timeline

Examples:

- Welcome Activity Created
- Birthday Reminder Generated
- Anniversary Activity Completed
- Loyalty Gift Delivered

# Activity Record Structure

Every timeline entry should contain:

- Activity Type
- Description
- Related Record
- User
- Date
- Time
- Notes (Optional)

# Activity Categories

## System Generated

Examples:

- Reference Number Created
- Renewal Generated
- Reminder Generated

## User Generated

Examples:

- Client Created
- Document Uploaded
- Payment Verified

## Communication Generated

Examples:

- Email Sent
- Client Notification Sent

# Audit Trail Scope

The audit trail should track:

## Record Creation

## Record Updates

## Status Changes

## Document Uploads

## Document Downloads

## User Logins

## Client Hub Access

## Permission Changes

## Settings Changes

# Audit Trail Structure

Every audit record should store:

- Record Type
- Record ID
- Action
- Old Value
- New Value
- User
- Timestamp
- IP Address (if available)

# Critical Audit Events

The following events should always be audited:

## Client Record Changes

## Payment Verification

## Policy Number Changes

## Claim Status Changes

## Document Visibility Changes

## User Permission Changes

## Settings Changes

# Client Hub Activity Logging

The system should record:

- Hub Accessed
- Documents Downloaded
- Verification Attempted
- Link Generated

Examples:

Client Hub Accessed

Client:

John Santos

Date:

June 12, 2026

IP:

xxx.xxx.xxx.xxx

# Timeline Display Rules

The timeline should display:

Newest First

or

Chronological View

depending on user preference.

# Timeline Filters

Support filtering by:

- Activity Type
- User
- Date Range
- Record Type

# Internal Notes

Internal notes should appear in timelines for staff.

Internal notes must never appear inside the Client Hub.

# Client Hub Timeline

Clients should see simplified activities only.

Examples:

✓ Application Submitted

✓ Payment Received

✓ Policy Issued

✓ Claim Updated

Clients should not see:

- Internal Notes
- Staff Discussions
- Pacific Cross Communications
- Internal Tasks

# Future Enhancements

Potential future additions:

- Timeline Comments
- Team Mentions
- Activity Subscriptions
- AI Activity Summaries

Not included in Version 1.

# Retention Rules

Activity history should never be deleted.

Audit records should remain permanent.

Archived records remain searchable.

# Success Criteria

The Activity Timeline & Audit Trail Framework is successful when:

- Staff can understand the history of any record
- Accountability is preserved
- Compliance requirements are supported
- Client service becomes easier
- Internal investigations are simplified
- Important actions are never lost or forgotten
