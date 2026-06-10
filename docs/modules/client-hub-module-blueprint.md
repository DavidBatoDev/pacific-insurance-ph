> Source: `Client Hub Module Blueprint.docx` — converted from the client’s Word document.

# Client Hub Module Blueprint

## Pacific Insurance PH Agency Operations Platform

# Purpose

The Client Hub provides clients with a secure, read-only view of their relationship with Pacific Insurance PH.

The goal is to:

- Reduce repetitive status inquiries
- Improve transparency
- Improve client confidence
- Improve document accessibility
- Reduce administrative workload for Matt and Eman

The Client Hub is not intended to be a full self-service portal in Version 1.

# Business Objectives

The Client Hub should allow clients to:

- View policy information
- View application status
- View claim status
- View renewal status
- View travel insurance status
- Download approved client-facing documents
- Contact Pacific Insurance PH

The Client Hub should reduce the need for clients to repeatedly contact Pacific Insurance PH for routine updates.

# Guiding Principle

The Client Hub should provide information, not administration.

Version 1 is designed as:

Read Only

The client can view information but cannot modify records.

# Access Method

Clients access their Client Hub through a secure link.

Example:

[https://hub.pacificinsuranceph.com/client/secure-token](https://hub.pacificinsuranceph.com/client/secure-token)

Optional security layer:

Client must verify:

- Last Name
- Date of Birth

before viewing their information.

# Client Hub Home Screen

The Home Screen provides a summary of the client's relationship with Pacific Insurance PH.

Sections:

- Client Information
- Active Policies
- Applications In Progress
- Claims In Progress
- Upcoming Renewals
- Travel Insurance Requests
- Recent Activity
- Documents
- Contact Information

# Client Profile Section

Display:

- Full Name
- Email Address
- Mobile Number
- Assigned Contact Person

Examples:

- Matt
- Eman
- Future Operations Staff

# My Policies Section

Purpose:

Provide visibility into active policies.

Display:

- Product Name
- Plan Name
- Policy Number
- Status
- Effective Date
- Expiry Date

Examples:

- Select
- Blue Royale
- BC Flexi
- FlexiShield
- TravelSafe

# Applications Section

Purpose:

Allow clients to monitor applications in progress.

Display:

- Application Type
- Current Status
- Last Updated Date
- Next Step

Examples:

Status:

- Submitted
- Under Review
- Awaiting Requirements
- Awaiting Payment
- Policy Processing
- Policy Issued

# Claims Section

Purpose:

Provide visibility into claim progress.

Display:

- Claim Reference Number
- Claim Type
- Current Status
- Last Updated Date
- Required Action

Examples:

Status:

- Submitted
- Additional Documents Required
- Under Review
- Approved
- Rejected
- Closed

# Renewals Section

Purpose:

Provide visibility into upcoming renewals.

Display:

- Policy
- Renewal Date
- Renewal Status
- Outstanding Requirements

Examples:

Status:

- Renewal Upcoming
- Awaiting Payment
- Renewal Processing
- Renewed

# Travel Insurance Section

Purpose:

Provide visibility into travel insurance requests.

Display:

- Travel Request Number
- Destination
- Travel Dates
- Policy Number
- Current Status

Examples:

Status:

- Awaiting Payment
- Payment Verified
- Policy Purchase Pending
- Policy Issued
- Closed

# Documents Section

Purpose:

Allow clients to access approved documents.

Examples:

- Policy Schedule
- Policy Certificate
- E-Card
- Renewal Notice
- Travel Insurance Policy
- Travel Insurance Certificate
- Claims Forms
- Application Forms

Only documents marked as Client Visible should appear.

# Recent Activity Section

Purpose:

Show the latest updates relevant to the client.

Examples:

- Application submitted
- Payment received
- Policy issued
- Claim updated
- Renewal notice generated

Display:

- Activity
- Date
- Status

# Contact Pacific Insurance PH Section

Purpose:

Provide easy access to support.

Display:

- Contact Person
- Phone Number
- Email Address

Examples:

- Matt
- Eman
- Future Operations Staff

Optional:

- Call Button
- Email Button
- WhatsApp Button
- Viber Button

# Information Clients Can View

The Client Hub may display:

- Policy Status
- Application Status
- Claim Status
- Renewal Status
- Travel Insurance Status
- Client-Facing Documents
- Contact Information
- Recent Activity

# Information Clients Must Not View

The Client Hub must never display:

- Internal Staff Notes
- Internal Tasks
- Pacific Cross Internal Communications
- Commission Information
- Internal Follow-Ups
- Internal Underwriting Notes
- Medical Evaluation Notes
- Internal Claim Discussions
- Employee Information
- Audit Logs

# Security Rules

## Rule 1

Every Client Hub must use a unique secure access token.

## Rule 2

Client Hub links must not expose database identifiers.

Do not use:

Client ID

Instead use:

Secure Token

## Rule 3

Optional identity verification should be supported.

Examples:

- Last Name
- Date of Birth

## Rule 4

All Client Hub access should be logged.

Store:

- Date
- Time
- IP Address
- Device Information

# Future Enhancements

Future versions may include:

- Document Upload
- Proof of Payment Submission
- Claims Document Submission
- Secure Messaging
- Online Forms
- Account Login
- Full Client Portal Features

These features are not included in Version 1.

# Success Criteria

The Client Hub is considered successful when:

- Clients can independently view their status
- Clients can download approved documents
- Clients can understand the next required action
- Routine status inquiries are reduced
- Pacific Insurance PH maintains control of all sensitive information
- Compliance and privacy requirements are maintained

# Version 1 Summary

The Client Hub is a secure, read-only client experience that provides visibility into policies, applications, claims, renewals, travel insurance requests, and documents without requiring a full client portal or user account system.
