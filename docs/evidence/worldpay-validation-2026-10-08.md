# Worldpay validation status, October 8 2026

Implemented against Worldpay Express Hosted Payments. This remains a sandbox integration with production acceptance gates outstanding.

## Implemented

Durable reporting observations link each provider transaction to the reservation and order. Amount and merchant reference are checked, returned currency is checked when present, capture IDs are saved separately, and repeated observations are deduplicated. Hosted return ValidationCode is checked before independent Reporting verification. Browser returns cannot prove payment. Cancellation closes checkout and verifies the provider state before releasing capacity. Refund requests have durable operation records, deterministic retry keys and a cumulative amount limit. CORS now accepts configured origins instead of every Vercel site. Shared checkout labels no longer say Stripe.

## Actual sandbox observations

Order `6ac73799002db8be709a3ae5`: authorization `674877821` was declined, authorization `674877822` became AuthCompleted for USD 35 as configured by the merchant, and linked completion `674877825` was recovered from authenticated Reporting. Reporting did not independently return currency. The existing reservation is registered. Reconciliation replay preserved 5 remaining spots and 21 confirmed registrations. See the adjacent JSON evidence. This is a replay of an already registered reservation, not a fresh browser payment test or a provider portal charge count audit.

Order `6ac73581002db8be709a38e3`: authorization `674877436` remains Authorized for 4000 cents. Its hosted setup has expired. Reversal returned code 20, Declined. The reservation remains unconfirmed and capacity remains held. It has not been forcibly released, captured after the deadline, or reported as resolved. Worldpay support must identify the permitted reversal route and verify a terminal nonpayable state before release.

A real 100 cent sandbox return was attempted for the registered USD 35 payment. Worldpay rejected it with code 103, Invalid Transaction Type, including after recovery of the capture reference. No successful refund is claimed. The refund operation remains unresolved for investigation. Do not change operation keys or submit a second refund until the provider portal and Reporting have been checked for the first operation.

## Automated verification

44 backend tests pass, including hosted session creation concurrency, durable observation replay, reference and amount mismatches, returned currency mismatches, hosted return validation, refund reference selection and replay, cancellation retry after an outage, authentication, configured CORS origins, capacity races, and reservation expiry. Frontend and API TypeScript checks pass. These tests use simulated provider responses and cannot substitute for actual provider charge counts or notification delivery.

## Outstanding acceptance evidence

| Requirement | Status and next action |
| --- | --- |
| Genuine server notification, authenticity check and replay | Blocked. Express documentation describes browser redirect validation and Reporting. Ask Worldpay implementation support to confirm a server notification product and provision its credentials, event signing scheme and endpoint configuration. Access Events is a separate product. |
| Independent currency confirmation | Not supplied in observed Express Reporting. Obtain merchant USD confirmation or a supported provider response containing currency. Merchant configuration fallback is labelled in stored evidence. |
| Fresh success, controlled decline, refresh and double click | Existing actual success and decline records are available. Run a fresh witnessed browser matrix with before and after counts and portal charge counts. Automated replay and creation concurrency pass. |
| Duplicate registration and duplicate notification | Registration concurrency is automated. Genuine duplicate notification test requires the notification route. Provider portal duplicate charge evidence remains outstanding. |
| Abandonment and late payment | Safe capacity retention is implemented. Complete fresh sandbox scenarios and record provider terminal state plus capacity counts. Do not call an expired page proof of no charge. |
| Outstanding authorization | Provider reversal rejected. Obtain Worldpay resolution, then rerun reconciliation and record the capacity release. |
| Outage and recovery | Automated outage recovery passes. A controlled actual sandbox outage exercise and recovery log remain outstanding. |
| Sandbox refund | Actual request rejected. Confirm merchant permissions and dependent transaction requirements with Worldpay; obtain a successful return, Reporting record and portal evidence. |
| Settlement and disputes | Operational procedures are in the integration guide. Merchant funding terms, portal permissions, reports and dispute deadlines require confirmation. |

Recommendation: decision pending merchant and provider confirmation. Do not claim that the full acceptance checklist or live payment readiness is complete. Mr Saad or the merchant account owner should authorize Worldpay implementation support to confirm the product, server notification availability, USD configuration, reversal and return permissions, settlement reports and dispute access. No E2Pay capability is inferred from this Worldpay work.
