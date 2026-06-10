> Source: `Prospect Pipeline Module Blueprint.docx` — converted from the client’s Word document.

# Prospect Pipeline Module Blueprint

## Pacific Insurance PH Agency Operations Platform

# Purpose

The Prospect Pipeline module manages potential clients before they become formal insurance applicants.

Its purpose is to help Pacific Insurance PH track and guide a person from first inquiry through discovery, information gathering, brochure review, proposal preparation, product selection, and conversion into an application.

This module supports both Matt and Eman.

# Why This Module Exists

Pacific Insurance PH’s process does not begin at the application stage.

Before a client applies, Pacific Insurance PH may need to:

- Capture inquiry details
- Understand the prospect’s needs
- Send brochures
- Collect initial information
- Identify possible product fit
- Request proposal support from Pacific Cross
- Send proposal details to the prospect
- Follow up
- Convert the prospect into an application

# Prospect Lifecycle

## 1. New Inquiry

A new person expresses interest.

Sources may include:

- Referral
- Existing client referral
- Website
- Facebook
- Viber
- WhatsApp
- Phone
- Walk-in
- Partner referral

## 2. Discovery

Pacific Insurance PH discusses the prospect’s situation.

Examples:

- Individual coverage
- Family coverage
- Travel insurance
- Business / group coverage
- Existing HMO
- Budget
- Medical considerations

## 3. Information Gathering

Pacific Insurance PH sends an intake form to collect initial information.

This is not the official Pacific Cross application form.

It is used to help determine product fit and prepare next steps.

## 4. Product Interest Identified

Possible products:

- Select
- Blue Royale
- BC Flexi
- FlexiShield
- TravelSafe
- Future products

## 5. Brochure Sent

Pacific Insurance PH sends the relevant brochure or product information.

The system records:

- Brochure sent
- Date sent
- Sent by
- Product version

## 6. Proposal Preparation

If needed, Pacific Insurance PH gathers information required to request or prepare a proposal.

This may include:

- Age
- Dependents
- Desired coverage
- Travel destination
- Existing HMO information
- Medical disclosures at a high level

## 7. Proposal Requested

Pacific Insurance PH requests proposal support from Pacific Cross or prepares quote details internally, depending on product.

## 8. Proposal Sent

Pacific Insurance PH sends proposal or quotation details to the prospect.

## 9. Product Selected

Prospect chooses a product or plan.

## 10. Application Started

Prospect is ready to begin the formal application process.

## 11. Converted

The system converts the prospect into:

- Client record
- Application record

The original prospect record remains for pipeline reporting.

## 12. Lost / Not Proceeding

Prospect does not proceed.

Reason should be recorded.

Examples:

- Too expensive
- Not interested
- No response
- Chose another provider
- Not eligible
- Timing issue

# Prospect Record Fields

- Prospect Reference Number
- Full Name
- Email
- Mobile Number
- Lead Source
- Assigned Staff
- Current Stage
- Product Interest
- Notes
- Next Follow-Up Date
- Date Created
- Last Activity Date
- Lost Reason
- Converted Client ID
- Converted Application ID

# Prospect Intake Form

The system should allow Pacific Insurance PH to send a prospect intake form.

Purpose:

- Collect initial details
- Reduce manual back-and-forth
- Help identify product fit
- Prepare proposal requirements

The intake form should be configurable by product type.

# Conversion Rule

When a prospect is converted:

The system creates:

- Client Record
- Application Record

The Prospect status becomes:

Converted

The prospect record remains available for reporting.

# Important Rules

## Rule 1

Prospects are not the same as clients.

A person becomes a client only after conversion.

## Rule 2

The intake form is not the official insurance application form.

## Rule 3

Prospect data should transfer into the application where appropriate.

## Rule 4

The Prospect module should remain lightweight.

It should not become a full marketing automation CRM in Version 1.

# Dashboard Impact

The main dashboard should include a small Prospect Snapshot.

Examples:

- Active Prospects
- Follow-Ups Due
- Proposals Pending
- Ready to Convert

The full prospect workflow should live inside the Prospect module.

# Success Criteria

The Prospect Pipeline module is successful when Pacific Insurance PH can:

- Track new inquiries
- Send intake forms
- Send brochures
- Follow up prospects
- Track proposals
- Convert prospects into applications
- Report on lost and converted opportunities
