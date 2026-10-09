# Worldpay callback and test input findings

Checked on 9 October 2026. No provider notification was received or fabricated.

## Express Hosted Payments

The official Hosted Payments page describes a browser ReturnURL, ValidationCode comparison and an authenticated TransactionQuery. The reviewed Express material does not document a server notification endpoint, signing configuration or delivery retry contract for this account. This finding does not prove that no optional notification product exists. Worldpay must confirm its availability for the exact merchant product and account.

Source: https://docs.worldpay.com/apis/express/hosted-payments

Specification: https://docs.worldpay.com/assets/pdf/ExpressInterfaceSpecification3.pdf

Screenshot: screenshots/2026-10-09-09-express-return-reporting.png

## Access Events

The official Access Events page describes server webhooks. An implementation manager must enable the URL and events. The page documents certificate or HMAC checks and delivery retries. It does not establish compatibility with Express credentials. No Access Events account or endpoint was provisioned for this work.

Source: https://docs.worldpay.com/access/products/events

Screenshot: screenshots/2026-10-09-10-access-events.png

## Express controlled decline input

The official MercuryPay Express Vantiv reference supplies its test card table on page 1. Pages 2 and 3 describe keyed credit denial tests with partial authorization disabled. Its 2.57 dollar trigger expects Express code 20, Declined, on the specified Visa test card. Card values were read privately and are excluded from evidence. The current hosted page supplied a valid future expiry option. The actual app checkout returned Declined. Reporting recorded declined authorization 674988272 with transaction status code 2. A Reporting transaction status code is different from an Express request response code.

Source: https://docs.worldpay.com/assets/pdf/MercuryPay_Express_Vantiv_Testing_Quick_Reference_03092021.pdf

The public Null Processor sale table was reviewed but was not used to infer an authorization decline. Access card inputs restricted to the Try environment were not used for the Express checkout.

## Acceptance decision

The genuine server notification, authenticity verification and duplicate notification replay requirement remains blocked. Reporting polling and hosted return verification are not verified webhook evidence. Worldpay must either provision a suitable server route or confirm a different merchant product. Any change to the brief requires explicit review.
