> Source: `Travel Insurance Module Requirements.docx` — converted from the client’s Word document.

# Travel Insurance Module Requirements

## Pacific Insurance PH Agency Operations Platform

# Purpose

Build a dedicated Travel Insurance module for Pacific Insurance PH.

Travel Insurance is treated as a separate service from health insurance products because it has:

- Faster processing
- Lower complexity
- Higher volume
- Separate Pacific Cross portal usage
- Immediate payment requirement
- A client trust issue around payment collection

# Core Business Problem

The current travel insurance process requires the client to send payment directly to Eman through personal GCash or bank transfer.

Eman then uses the funds to purchase the travel policy through the Pacific Cross portal using her agent login.

This creates a trust concern because the client sees a personal payment destination instead of a formal business payment process.

# Design Goal

Make the payment and issuance process feel professional, trackable, and legitimate while keeping the current operational reality.

The system should support the current process but remain flexible enough to support future payment methods, such as:

- Matt’s account
- Eman’s replacement
- Pacific Insurance PH company bank account
- Pacific Insurance PH GCash/Maya account
- Online payment gateway
- Direct Pacific Cross payment method

# Travel Insurance Workflow

## Step 1: Travel Request Created

Pacific Insurance PH creates a travel insurance request.

Required fields:

- Client Name
- Email
- Mobile Number
- Destination
- Departure Date
- Return Date
- Number of Travelers
- Purpose of Travel
- Notes

Status:

Travel Request Created

## Step 2: Traveler Details Collected

Required fields per traveler:

- Full Name
- Date of Birth
- Age
- Passport Number
- Nationality
- Email
- Mobile Number

Status:

Traveler Details Collected

## Step 3: Eligibility Checked

System checks basic eligibility.

Example rule:

- Traveler must be within allowed age range

Eligibility rules should be configurable.

Status:

Eligibility Checked

## Step 4: Quote / Premium Confirmed

Pacific Insurance PH calculates or confirms travel insurance premium.

Fields:

- Coverage Option
- Trip Duration
- Premium Amount
- Currency
- Quote Expiry Date

Status:

Quote Confirmed

## Step 5: Payment Request Generated

System generates a formal Pacific Insurance PH payment request.

The payment request includes:

- Pacific Insurance PH branding
- Travel Request Reference Number
- Client Name
- Traveler Name/s
- Destination
- Travel Dates
- Premium Amount
- Payment Destination
- Payment Instructions
- QR Code if available
- Proof of Payment Instructions

Status:

Payment Request Sent

## Step 6: Client Sends Payment

Client pays using the selected payment destination.

Payment destination may be:

- Eman GCash
- Eman Bank Account
- Matt Bank Account
- Pacific Insurance PH company account
- Future payment gateway

Payment destination must be configurable.

Status:

Awaiting Payment

## Step 7: Payment Proof Received

Client uploads or sends proof of payment.

System records:

- Payment Amount
- Payment Method
- Payment Destination
- Proof of Payment
- Payment Date
- Reference Number

Status:

Payment Proof Received

## Step 8: Payment Acknowledgement Issued

Pacific Insurance PH sends a payment acknowledgement.

Important:

This is not an official Pacific Cross receipt.

It is a Pacific Insurance PH payment acknowledgement confirming that payment has been received for processing.

Status:

Payment Acknowledged

## Step 9: Portal Purchase Completed

Eman or assigned staff logs into the Pacific Cross portal and purchases the travel policy.

System records:

- Staff Member
- Portal Used
- Purchase Date
- Portal Confirmation Number
- Policy Number

Status:

Policy Purchased

## Step 10: Travel Policy Delivered

Pacific Insurance PH sends the policy documents to the client.

Documents may include:

- Travel Insurance Policy
- Certificate of Insurance
- Travel Assistance Information
- Important Claims Instructions

Status:

Policy Delivered

## Step 11: Travel Case Closed

Travel insurance request is marked completed.

Status:

Closed

# Required System Features

## 1. Travel Request Form

Used internally by Matt or Eman.

Captures:

- Client details
- Travel details
- Traveler details
- Quote details
- Payment details
- Issuance details

## 2. Payment Destination Settings

Admin-configurable payment destinations.

Fields:

- Payment Destination Name
- Payment Method
- Account Name
- Account Number
- QR Code
- Assigned Staff Member
- Active / Inactive
- Effective Date
- Notes

Examples:

- Eman GCash
- Eman UnionBank
- Matt BPI
- Pacific Insurance PH Business Account
- Maya Business
- PayMongo

## 3. Payment Request Generator

Generates a formal client-facing payment request.

Must include:

- Reference Number
- Amount Due
- Payment Destination
- Instructions
- QR Code
- Due Date
- Disclaimer

## 4. Payment Acknowledgement Generator

Generates confirmation after payment is received.

Must include:

- Reference Number
- Amount Received
- Payment Method
- Date Received
- Status
- Next Step

Recommended wording:

“Payment has been received by Pacific Insurance PH for processing of your travel insurance request.”

## 5. Policy Delivery Email

Sends policy documents after purchase.

Must include:

- Policy Number
- Traveler Name
- Destination
- Travel Dates
- Attached Policy
- Assistance / Claims Instructions

# Important Rules

## Rule 1: Do Not Hardcode Eman

The system should not assume Eman is always the payment receiver or portal user.

Use configurable payment destinations and assigned staff.

## Rule 2: Payment Destination Must Be Stored Per Transaction

Each travel request must store which payment destination was used.

This preserves history if accounts change later.

## Rule 3: Payment Acknowledgement Is Not An Official Insurance Receipt

The system should clearly label it as a Pacific Insurance PH payment acknowledgement.

## Rule 4: Portal Purchase Remains Manual

Version 1 does not need to integrate directly with the Pacific Cross portal.

The app only tracks that the portal purchase was completed.

## Rule 5: Payment Methods Must Be Future-Proof

The module must support:

- Personal accounts
- Business accounts
- QR payments
- Bank transfer
- E-wallets
- Future payment gateways

# Recommended Statuses

- Draft
- Travel Details Needed
- Quote Confirmed
- Payment Request Sent
- Awaiting Payment
- Payment Proof Received
- Payment Acknowledged
- Policy Purchase Pending
- Policy Purchased
- Policy Delivered
- Closed
- Cancelled
- Ineligible

# Success Criteria

The Travel Insurance module works when Pacific Insurance PH can:

- Create a travel request
- Generate a formal payment request
- Collect proof of payment
- Send payment acknowledgement
- Track portal purchase
- Store policy number
- Deliver policy documents
- Preserve payment history
- Change payment destinations without developer work
