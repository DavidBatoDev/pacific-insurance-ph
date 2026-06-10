> Source: `Design Principle_ Configurable Insurance Operations System.docx` — converted from the client’s Word document.

# Design Principle: Configurable Insurance Operations System

## Pacific Insurance PH Operations Platform

## Core Assumption

This system is being built only for Matt and his assistant.

The system must support their internal sales, servicing, renewal, claims, document, and follow-up operations.

The system cannot control or change Pacific Cross processes.

Pacific Cross remains an external party.

# Key Design Constraint

Pacific Cross may change:

- Product names
- Plan tiers
- Coverage limits
- Premium rates
- Brochures
- Application forms
- Underwriting rules
- Required documents
- Renewal rules
- Payment methods
- Claims requirements
- Assigned territory sales manager
- Department contacts
- Email addresses
- Processing timelines

Therefore, these items must be configurable by Matt, Eman, or an admin user.

# Product Versioning Requirement

The app must support product versions.

Example:

Select 2025

Select 2027

Blue Royale 2025

Blue Royale 2028

Each product version may have different:

- Plan tiers
- Coverage limits
- Premium tables
- Optional benefits
- Discounts
- Eligibility rules
- Application forms
- Brochures

Old clients must remain linked to the product version they originally purchased.

New clients should use the currently active product version.

# Recommended Product Data Design

## Product

Example:

- Select
- Blue Royale
- BC Flexi
- Travel Insurance

## Product Version

Example:

- Select 2025
- Select 2027

## Plan Option

Example:

- Select Plus Private 5M
- Blue Royale Plan C

## Add-On

Example:

- Dental
- Outpatient
- Personal Accident
- Vision

## Discount Rule

Example:

- Co-payment discount
- Group discount
- Deductible discount
- Treatment Area Limitation discount

## Required Document Template

Example:

- Standard Application Checklist
- Senior Application Checklist
- Medical Condition Checklist
- TAL Checklist
- Renewal Amendment Checklist

# External Contact Flexibility

Pacific Cross contacts must not be hardcoded.

The system should have an editable Contact Directory for:

- Territory Sales Manager
- Claims Department
- Commission Contact
- Travel Insurance Contact
- Billing / Payment Contact
- Customer Service
- Branch Contacts

Each contact should include:

- Name
- Role
- Email
- Phone
- Department
- Status
- Replacement Contact
- Notes
- Effective Date
- Last Verified Date

# Staff Change Scenario

If Glynn is replaced, the system should allow Matt/Eman to update the Pacific Cross contact assigned to new submissions.

Old records should still show that previous cases were handled by Glynn.

New records should use the new assigned contact.

This requires contact history, not just one editable text field.

# Workflow Flexibility

Workflows should be template-based.

Examples:

- New Business Standard
- New Business With Medical Evaluation
- Senior Application
- Renewal Standard
- Renewal With Amendment
- Reinstatement
- Claim Submission
- Travel Insurance

Each workflow should allow configurable:

- Steps
- Status labels
- Required documents
- Email templates
- Assigned internal user
- Assigned Pacific Cross contact
- Follow-up reminders
- Due dates

# Document Flexibility

Forms and brochures should be stored as versioned documents.

Each document should include:

- Document name
- Product
- Product version
- Document type
- File attachment
- Effective date
- Expiry date
- Active/inactive status
- Notes

This prevents the team from accidentally sending old brochures or old forms to clients.

# Email Template Flexibility

Email templates should be editable.

Templates should be linked to:

- Product
- Product version
- Workflow
- Workflow step
- Client type

Example:

Template: Send Select Application Package Product: Select Version: 2025 Workflow: New Business Standard Step: Application Package Sent

# Pricing Flexibility

Premium tables should not be manually coded into the app logic.

They should be importable or editable by an admin.

Preferred beta version:

Use Google Sheets as the source for premium tables.

Later app version:

Use an admin pricing table import tool.

# System Rule

The app should never assume Pacific Cross rules are permanent.

Instead, the app should ask:

- Which product version applies?
- Which form version applies?
- Which document checklist applies?
- Which Pacific Cross contact should receive this?
- Which email template should be used?
- Which pricing table is active?

# Practical Implication

This app should be built as:

Configurable CRM + Workflow Engine + Document Management System

Not:

Hardcoded Pacific Cross App

# Summary

The system must be flexible enough to survive:

- Product changes
- Staff turnover
- Form changes
- Pricing changes
- Process changes
- Contact changes

without requiring a developer every time Pacific Cross updates something.
