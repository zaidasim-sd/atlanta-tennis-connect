# Worldpay and E2Pay practical payment validation

Sandbox evidence updated 9 October 2026

Decision pending merchant and provider confirmation. Fresh success, decline and abandonment are evidenced. Live payment readiness is not established.

# Requirement status

| Requirement | Status | Evidence |
| --- | --- | --- |
| Worldpay product and sandbox | Done | E1, S8, S11 |
| Intended E2Pay and eligibility | Blocked | S2 to S7 |
| US availability and USD | Partly done | E5, S11 |
| Unique reference and hosted checkout | Done | E5 |
| Successful sandbox payment | Done | E5, E9 |
| Controlled decline in the app | Done | E6 |
| Abandonment and expiry recovery | Done | E3 |
| Browser double click | Done | E2 |
| Eight concurrent create calls | Partly done | E7 |
| Return replay and refresh | Done | E4 |
| Genuine notification and replay | Blocked | E8 |
| Transaction and currency evidence | Partly done | E5, E9 |
| Portal charge count screenshot | Blocked | E9 API only |
| Late payment and actual outage | Not done | Not run |
| Outstanding authorization | Blocked | E10 |
| Successful refund | Blocked | E11 |
| Settlement and dispute exercise | Not done | S14, proposals |
| Production approval and live claim | Blocked | No approval |
| Outreach drafts | Done | E12, not sent |
| Tests and disposable user cleanup | Done | E13, E14 |

# Decision and scope

Worldpay Express Hosted Payments is a working sandbox candidate. A fresh browser payment, controlled decline and abandoned checkout recovery have now been recorded. These prove sandbox behavior. They do not establish production approval or live settlement. E2Pay remains blocked until Mr Saad identifies the intended provider and that provider confirms US eligibility and USD charging and settlement.

Recommendation: decision pending merchant and provider confirmation. Continue Worldpay validation while keeping the shared payment interface. Neither provider is ready for an unconditional live payment claim under the assigned requirements.

# Identify E2Pay first

The researched candidate is PT E2Pay Global Utama in Indonesia, identified by Fiuu as an acquired business. This is not yet confirmed as the E2Pay intended by Mr Saad. The earlier reference to PT Sprint Mandiri is unsupported and must not be used. The similarly named e2pay.org website shown in Figure 3 is not identity evidence for this candidate. [2]

| Required information | Current finding |
| --- | --- |
| Company and official website | Candidate: PT E2Pay Global Utama. Fiuu contact page lists the entity. www.e2pay.co.id is the candidate website. Intended provider still needs confirmation. [2, 3] |
| US processing and USD | US merchant acceptance and USD charging and settlement are not confirmed. The reviewed Direct API explicitly specifies IDR (Indonesian Rupee) only. This does not establish the capabilities of every product. [7] |
| API and hosted checkout | Candidate documentation is available at e2payprod.gitbook.io. Hosted checkout and a sandbox endpoint are documented. [4, 5] |
| Callbacks and verification | Candidate documentation describes Notify and Callback routes plus payment queries. No integration was tested. Merchant eligibility, signing configuration and duplicate event behavior require confirmation. [6, 7] |
| Sandbox account | Not obtained. A login portal was found; the screenshots do not prove that signup is impossible. Request the correct test merchant and credentials from integration support. [4] |
| Onboarding and support | Exact merchant checklist and approval timing not confirmed. Candidate technical contact: integration@e2pay.co.id. Fiuu also lists merchant support and refund or dispute contact routes. [3, 4] |

## Minimum action required from Mr Saad

Confirm the legal company name, official URL and existing sales or merchant contact. If the Indonesian candidate is intended, ask integration support for written US and USD eligibility, the exact merchant document checklist, sandbox MerchantID or MerchantCode, signing keys, test cards, endpoint documentation and an approval owner. No request submission or approval date is evidenced. We cannot promise access by Friday.

# Worldpay product and sandbox access

The implemented product is Worldpay Express XML with Express Hosted Payments and the Reporting API. Worldpay Integrated Payments, LLC is named in the Express specification. This is distinct from Access Worldpay and its Hosted Payment Pages product. Express is the product actually exercised here; the chosen US merchant account must be provisioned for it. [8, 10]

Sandbox status: obtained. We created a Worldpay account and used hosted payment credentials. Figures 4 to 7 show the signup and developer dashboard. Figures 9 to 13 show hosted checkout and registration confirmation. No merchant or implementation manager approval was needed for the test access used here. That does not establish the route for production approval or every Worldpay product.

## Credentials and approval dependency

Express requires AccountID, AccountToken, AcceptorID and ApplicationID. These map to the four WORLDPAY_HOSTED_PAYMENTS environment values. The test environment uses the certification transaction and reporting endpoints. Production requires approved live merchant credentials, the assigned terminal settings and confirmation that Express supports this US online league business and its USD bank settlement. No production approval is evidenced. [8]

## Implementation location and provider selection

Repository: https://github.com/zaidasim-sd/atlanta-tennis-connect/tree/worldpay. Origin and the worldpay branch were checked. The starting commit is 891965060a58839eb9a3ad273f54683580546069. New evidence and the confirmation endpoint fix remain local. They are not claimed as pushed. The proof of concept remains in the tennis app, with a separate disposable database for these runs. [1] (https://github.com/zaidasim-sd/atlanta-tennis-connect/tree/worldpay) (https://github.com/zaidasim-sd/atlanta-tennis-connect/tree/worldpay)

PAYMENT_PROVIDER selects mock, stripe or worldpay. The selected adapter is constructed through the shared PaymentProvider interface. Worldpay uses worldpayProvider.ts and worldpayPayment.ts in backend/src/payment, reservationService.ts in backend/src/lib, and the Worldpay checkout component in src/components. Existing reservations retain their provider; finish them before switching environments.

## Flow implemented

The backend creates a pending reservation with a 15 minute capacity hold and uses its identifier as the unique order reference. A durable session claim prevents concurrent creation of multiple hosted sessions. Card entry occurs on Worldpay. Before registration confirmation, authenticated Reporting checks the order reference, amount and merchant identifiers when supplied. Returned currency is checked when present. Capture TransactionID is saved separately from authorization TransactionID. A browser return alone cannot confirm payment.

Hosted checkout expires after 10 minutes. Reservations hold capacity for 15 minutes. Checkout closure and Reporting must show no live authorization before capacity is released. Unresolved state deliberately retains capacity beyond the deadline. This differs from the brief's unconditional release rule on purpose, to prevent a charge after a spot has been sold again. The new decline and abandonment runs safely released capacity. [8, 11]

## Hosted checkout versus direct card entry

Hosted checkout is recommended for V1. Worldpay collects the card fields. The tennis application does not receive raw card numbers or CVV in this flow. Direct card entry would expand the card handling scope. Hosted checkout reduces PCI exposure, but the merchant must confirm its required PCI validation, secure its website and access, prevent card data in logs, and manage refunds and disputes. Hosting does not remove those responsibilities. [8, 11, 14]

The browser return checks TransactionSetupID and ValidationCode, followed by authenticated Reporting. This is not a server webhook. The reviewed Express documentation gives no server notification route, signing configuration or delivery contract for this account. Worldpay must confirm whether an optional route exists. Access Events documents server webhooks but needs implementation manager provisioning and does not establish Express compatibility. No notification was captured or fabricated. [8, 11, 13]

# Practical evidence and test results

Original screenshots remain as historical evidence with sensitive fields redacted. New screenshots were captured through the browser on 8 and 9 October 2026. The fresh success, decline, abandonment, double click and refresh runs are described below. Raw provider evidence is parsed XML with fields outside the allowlist redacted. It is not a byte for byte XML copy. Test results use saved files and are not portal charge counts.

## Actual sandbox records

Initial read only verification on 8 October 2026 between 06:36:07 and 06:36:09 UTC returned the records below. Later authenticated Reporting identified capture 674877825 linked to authorization 674877822 for order ending 709a3ae5. Completed authorization indicates provider reported capture completion, not bank settlement. USD below is the merchant configured currency; observed Reporting data did not independently return currency.

| Order suffix and USD | Worldpay transaction evidence | App result |
| --- | --- | --- |
| 709a3ae5   35.00 | 674877821 Declined, code 2; 674877822 AuthCompleted, code 6. Linked capture: 674877825.  | registered paidAt 06:27:55 UTC |
| 0f923253   40.00 | 674877186 and 674877189 Declined 674877238 AuthCompleted, code 6 | registered paidAt 06:12:44 UTC |
| 709a38e3   40.00 | 674877436 Authorized, code 5 | payment_pending No paidAt value |

The earlier successful orders remain historical evidence. Authorization 674877436 remained Authorized in the fresh 9 October state check. The one permitted reversal retry on 8 October at 12:41 UTC again returned code 20, Declined. It was stopped. Capacity remains held and the reservation is unconfirmed. No extra reversal or refund was submitted. [E10]

## Tests completed and evidence limits

| Case | Result and evidence |
| --- | --- |
| Hosted checkout and success | Fresh 3500 cent success on 9 October. One confirmed registration and capture 674988144. New numbered screenshots and E5, E9. Earlier figures are historical. |
| Decline or failure | Fresh documented 257 cent decline. Authorization 674988272 is Declined. Reservation failed, confirmed count zero and capacity restored to 10. E6 and decline figures. |
| Unique reference and refresh | Unique order references are saved. Three browser refreshes and two hosted return verifier replays preserved one registration, capture 674988144 and capacity 9. E4, E9. |
| Double submission | Actual browser double click produced one checkout. Eight authenticated HTTP requests produced one reservation and setup. Six returned 201, two returned 500. No second setup. E2, E7. |
| Ambiguous creation | Automated test blocks a new payable session after a timeout. Manual recovery still required. |
| Authorization and capture | Fresh authorization 674988139 is AuthCompleted. Separate capture 674988144 is Approved. One capture is found by reference query. E5, E9. |
| Cancellation and abandonment | Fresh abandoned checkout expired after no payment. Reporting found no transaction and capacity returned from held 9 to 10. Decline also released safely. Late payment was not run. E3, E6. |
| Webhook and duplicate events | The hosted return verifier was replayed twice. No genuine server notification was available or tested. Reporting replay is not notification replay. E4, E8. |
| Refund and amount checks | Automated amount and returned currency checks pass. Earlier refund rejection is a prior reported finding with missing raw output. No fresh or successful refund. E11, E13. |
| Provider isolation and code 90 | Automated tests confirm selected adapter only. Reporting No Record(s) is treated as pending only in the exact query context. |

The baseline had 44 passing backend tests. The final suite has 45 passing tests, zero failures, zero skips and zero cancellations. Frontend and API TypeScript checks pass. The extra test verifies that the old browser confirmation route cannot create or change a registration. CORS tests accept configured origins and reject unrelated sites. Actual sandbox evidence and automated tests are labelled separately. [E13]

# What must happen before a live payment claim

## Engineering acceptance gates

1. Resolve the genuine server notification requirement. No provider event was captured. Express browser return verification and Reporting polling are not verified webhook evidence. Worldpay must confirm and provision the route or a suitable product. [E8]

2. Durable transaction evidence is implemented. Amount, reference, reservation, provider status, event time and verification time are recorded. Capture IDs are separate. Observed Reporting data still supplies no currency field. USD is merchant configuration, labelled merchant_configuration, and does not meet independent provider currency verification. Confirm USD presentment and settlement with the approved merchant account. [E5, E9]

3. Fresh success, controlled decline, abandonment, double click, return replay and refresh now have saved evidence. Eight concurrent HTTP create calls produced one reservation and setup, but two requests failed while creation was unresolved. The unpaid setup had no Reporting charge record. Genuine duplicate notification, portal counts and late payment remain open. [E2, E3, E4, E5, E6, E7, E9]

4. Authorization 674877436 remains unresolved after one more declined reversal. Capacity stays held. The new decline and abandoned checkout safely released their holds. Automated outage recovery passes. A controlled actual outage and late payment exercise were not run. [E3, E6, E10, E13]

5. No successful refund is claimed. The prior report states that a 100 cent return for capture 674877825 returned code 103. The earlier raw refund output file is empty and does not prove that response. A fresh read found a pending refund operation. No refund was submitted in this session. Obtain provider resolution and successful Reporting and portal evidence. Settlement and dispute procedures below are proposals, not completed tests. [E11]

## Merchant approval and production validation

Mr Saad or the authorized merchant owner must confirm the legal entity, obtain the Worldpay onboarding checklist and submit the requested business, ownership, identity, website and settlement bank information. Exact documents, review timing, pricing, reserves and certification requirements remain provider decisions. The team needs live AccountID, AccountToken, AcceptorID, ApplicationID, assigned terminal details and written US and USD approval before switching to production.

After engineering and merchant approval, perform one authorized low value live payment, match the provider transaction and registration, verify settlement to the approved bank account and test the agreed refund process. Only then state that live payments and settlement have been validated. Sandbox success cannot establish live settlement.

## Refunds chargebacks settlement and disputes

The Express specification documents CreditCardReturn, CreditCardReversal, CreditCardVoid, authorization completion and batch methods. The Hosted Payments page excludes unlinked refunds. These documented methods do not establish entitlement or successful execution for this account. Worldpay's merchant support page links transaction history, settlement details and chargeback resources. Account funding terms, fees, reserves and response deadlines remain unconfirmed. No bank settlement or dispute was tested. [8, 11, 14]

Proposed settlement procedure, not tested: obtain the assigned batch and settlement reports. Match capture IDs, order references, amounts, refunds and totals to the local ledger and bank deposit. Investigate differences. Worldpay must confirm the available reports, funding terms and account access before this can become an approved operating procedure.

Proposed dispute procedure, not tested: monitor the approved provider channel. Record the reference, capture ID, amount, reason and provider deadline. Preserve registration evidence and respond through the authorized portal. Reconcile the final adjustment. Do not invent a contractual deadline or release capacity from an unverified notice.

For the E2Pay candidate, the reviewed material describes hosted checkout, notifications and a test endpoint. Its Direct API specifies IDR. Fiuu publishes transaction, refund and dispute contact routes. None of this confirms US eligibility, USD settlement or refund API entitlement for the Atlanta operator. No E2Pay integration or merchant account was tested. [3, 5, 6, 7]

## Evidence retained

Saved evidence is under docs/evidence. The status note lists exact filenames for E1 to E14. The original screenshot files remain inputs. New browser screenshots are under docs/evidence/screenshots. Outreach drafts are under docs/outreach and were not sent. Both disposable users and their database were removed after evidence capture. Provider sandbox transaction records remain. No test access path was added. [E12, E14]

# New witnessed sandbox runs

Controlled decline: order 6ac8701dd322b225fc340675 used the official Express test card and 257 cent trigger. The hosted page returned Declined. Reporting records authorization 674988272 with transaction status code 2. The app marked the reservation failed, left it unconfirmed and restored capacity to 10. The fee was changed only in the disposable test league. [12, E6]

Abandonment: order 6ac78e559a3e1e883801d9cf reached a blank hosted form and was closed without payment on 8 October at 12:36:53 UTC. Its hold deadline was 12:51:37 UTC. Reconciliation ran on 9 October at 04:28 UTC after the interrupted session resumed. Reporting found no transaction. The reservation expired and held capacity 9 returned to 10. This does not prove release exactly at the deadline. [E3]

Success: order 6ac86f32d322b225fc3404e3 completed a 3500 cent payment. Authorization 674988139 is AuthCompleted and capture 674988144 is Approved. The app had one confirmed registration and capacity 9. The hosted return verifier was replayed twice, reconciliation ran twice and the page was refreshed three times. One registration, one capture ID and capacity 9 remained. No video was recorded because the available browser tool has no video recording API. [E4, E5, E9]

Double submission: the browser double click created one checkout for order 6ac78f769a3e1e883801daa6. Eight adapter calls reused it. A separate eight request HTTP run created one reservation and setup for order 6ac8712dd322b225fc340789. Six requests returned 201 and two returned 500 while creation was unresolved. Capacity changed from 10 to 9 and returned to 10 after verified cancellation. This protects against a second session but leaves a request reliability gap. [E2, E7]

An unpaid hosted setup has no Reporting charge record. For the paid success order, two Reporting rows are one authorization and one capture. The approved capture count is one. These are authenticated API records, not portal screenshots. Portal completeness and bank settlement remain unverified. No portal account email or authenticated portal access was available. [E9]

Confirmation safeguard: the old browser supplied confirmation endpoint is disabled with HTTP 410. It cannot create a paid registration. A regression test and real local HTTP check verify this. The shared PaymentProvider interface is unchanged. A remaining frontend call to that obsolete endpoint ignores its response but can no longer change server records. Its removal and general success error handling remain follow up work. [E13]

Cleanup: both disposable users, their sessions and the dedicated test database were removed after evidence capture. Five test leagues and five test reservations were removed. Original application data was not deleted or reset. The provider sandbox transactions remain. No test access path was added. The local test servers and temporary card input material were removed or stopped. [E14]

| Scenario | Reporting rows | Approved captures | Confirmed app entries |
| --- | --- | --- | --- |
| Abandonment | 0 | 0 | 0 |
| Decline | 1 | 0 | 0 |
| Double click | 0 | 0 | 0 |
| HTTP concurrency | 0 | 0 | 0 |
| Fresh success | 2 | 1 | 1 |

## Saved evidence references

E1 worldpay-run-manifest-2026-10-09.json

E2 2026-10-08T124134089Z-concurrent.json and double click screenshots

E3 2026-10-09T042800611Z-job.json and abandonment screenshots

E4 2026-10-09T043822571Z-replay.json and refresh screenshots

E5 2026-10-09T043718677Z-snapshot.json and numbered success screenshots

E6 2026-10-09T044300429Z-snapshot.json and decline screenshots

E7 2026-10-09T044424800Z-http-concurrent.json

E8 worldpay-callback-findings-2026-10-09.md and official page screenshots

E9 2026-10-09T045201384Z-reports.json, authenticated API only

E10 2026-10-08T124109681Z-reverse.json and 2026-10-09-original-state-check.json

E11 Prior report only. Raw refund output is empty. Current operation is pending. No new refund.

E12 docs/outreach contains three drafts. None was sent or submitted.

E13 2026-10-09-final-backend.txt, 2026-10-09-final-typescript.txt and confirmation route check JSON

E14 2026-10-09-cleanup.json

# Sources and provider contacts

Official links and saved evidence were checked on 8 and 9 October 2026. Sources have unique numbers. Candidate E2Pay material does not establish the intended provider or US merchant approval.

1 Proof of concept repository and worldpay branch (https://github.com/zaidasim-sd/atlanta-tennis-connect/tree/worldpay)

2 Fiuu identifies PT E2Pay Global Utama (https://fiuu.com/newsroom/detail/fiuu-fintech-acquires-indonesias-e2pay)

3 Fiuu official contact and Indonesia support routes (https://fiuu.com/contact-us/)

4 E2Pay candidate documentation and integration support (https://e2payprod.gitbook.io/payment-gateway)

5 E2Pay candidate hosted checkout and sandbox path (https://e2payprod.gitbook.io/payment-gateway/api-documentation/technical-doc-of-fiuu-id/hosted-integration-apis)

6 E2Pay candidate notification and query flow (https://e2payprod.gitbook.io/payment-gateway/api-documentation/technical-doc-of-fiuu-id/online-payment-transaction-process)

7 E2Pay candidate Direct API and IDR restriction (https://e2payprod.gitbook.io/payment-gateway/specification/direct-api)

8 Worldpay Express Interface Specification (https://docs.worldpay.com/assets/pdf/ExpressInterfaceSpecification3.pdf)

9 Worldpay developer dashboard (https://docs.worldpay.com/dashboard/)

10 Published Worldpay merchant agreement, not proof of this account terms (https://go.worldpay.com/rs/092-EMI-875/images/WIP-MPA_SM-Terms_and_Conditions-v10.2024.pdf)

11 Worldpay Express Hosted Payments (https://docs.worldpay.com/apis/express/hosted-payments)

12 Official Express test cards and triggers (https://docs.worldpay.com/assets/pdf/MercuryPay_Express_Vantiv_Testing_Quick_Reference_03092021.pdf)

13 Access Events provisioning and verification (https://docs.worldpay.com/access/products/events)

14 Worldpay US merchant support (https://www.worldpay.com/en/merchant-support)

## E2Pay next action and owner

Owner: Mr Saad confirms the intended company, website and merchant contact. The E2Pay and Fiuu inquiries are saved as drafts only. No send date or submission date is recorded. Provider answers must establish US eligibility, USD charging and settlement, the merchant checklist and usable test credentials before integration starts. [E12]

## Worldpay next action and owner

Owner: the developer completes the remaining evidence and notification work once provisioned. Mr Saad or the authorized merchant owner obtains production approval and asks Worldpay implementation support to confirm the product, server notification route, USD configuration, reversal and refund entitlements, settlement reports and dispute access. The support message is a draft only. [E8, E10, E11, E12]

## Screenshot interpretation

The 16 historical figures remain below. Browser address rows and sensitive fields are redacted. The card fields in Figure 10 are redacted. These redactions do not create new test evidence. Figures 14 and 15 do not prove duplicate charge prevention. Fresh browser figures follow the historical appendix.

# Screenshot evidence

## Figure 1 Fiuu contact form

A contact route was located. The screenshot does not show a submitted inquiry or approval.

## Figure 2 E2Pay sandbox portal

The portal requires a merchant login. Test credentials were not obtained.

# Screenshot evidence

## Figure 3 Similarly named website

The e2pay.org page is preserved as a research observation. It is not evidence of the intended company or gateway.

## Figure 4 Worldpay developer signup

Developer account registration was available. Production merchant approval is a separate step.

# Screenshot evidence

## Figure 5 Worldpay developer dashboard

The account provides product discovery and credential routes.

# Screenshot evidence

## Figure 6 Worldpay product catalogue

The catalogue illustrates why the exact Worldpay product must be selected before merchant onboarding.

# Screenshot evidence

## Figure 7 Express and Hosted Payments options

The dashboard includes Express XML and Hosted Payments, the route used for this test.

## Figure 8 Registration before checkout

A USD 40 registration was prepared. This screenshot retains the old Stripe summary label. Shared checkout labels have since been corrected to provider neutral wording; the screenshot predates that change.

# Screenshot evidence

## Figure 9 Worldpay checkout handoff

The application offers the hosted checkout and waits for provider confirmation.

## Figure 10 Worldpay hosted payment form

Historical card input has been redacted. This figure is not fresh test evidence. The new blank hosted form and matching Reporting records provide the current checkout evidence.

# Screenshot evidence

## Figure 11 Processing after return

The return URL and processing screen alone are not payment confirmation evidence.

## Figure 12 Confirmed player dashboard

The dashboard shows the player registered for Fowler Park Mixed Doubles.

# Screenshot evidence

## Figure 13 Registration confirmation

The application shows a USD 40 registration confirmation. Server records provide the stronger payment evidence.

## Figure 14 Processing and pending capture

The application retains the reservation while payment processing is unresolved.

# Screenshot evidence

## Figure 15 Hosted page unavailable

Reopening the page failed. This does not by itself prove duplicate charge or double booking prevention.

## Figure 16 Further successful registration

The application shows a USD 35 registration. The matching completed authorization is recorded in the server evidence.

# New browser evidence

## Figure 17 Null Processor reference

Shows a processor specific reference. It does not establish the authorization decline trigger used here. Full capture: 2026-10-08-01-express-null-rules.png

## Figure 18 Abandonment capacity before

Shows 10 available spots before checkout. It does not prove a provider transaction count. Full capture: 2026-10-08-02-abandon-capacity-before.png

# New browser evidence

## Figure 19 Abandonment pending reservation

Shows the pending Worldpay handoff. It does not prove payment or expiry. Full capture: 2026-10-08-03-abandon-pending.png

## Figure 20 Abandonment hosted form

Shows the blank hosted form reached before closing. It does not prove expiry or absence of authorization. Full capture: 2026-10-08-04-abandon-hosted-empty.png

# New browser evidence

## Figure 21 Double click creation state

Shows the disabled button after the double click. It does not independently prove charge counts. Full capture: 2026-10-08-05-double-click.png

## Figure 22 Double click checkout result

Shows one pending checkout in the app. Saved server counts establish one setup; this is not a portal audit. Full capture: 2026-10-08-06-double-checkout.png

# New browser evidence

## Figure 23 Abandonment capacity after

Shows capacity restored to 10 after reconciliation. It does not prove release exactly at the hold deadline. Full capture: 2026-10-09-07-abandon-capacity-after.png

## Figure 24 Abandonment dashboard

Shows no confirmed registration for the test user at that time. Reporting supplies the no authorization evidence. Full capture: 2026-10-09-08-abandon-dashboard.png

# New browser evidence

## Figure 25 Express return and Reporting documentation

Shows browser return validation and Reporting guidance. It does not prove that every optional notification product is unavailable. Full capture: 2026-10-09-09-express-return-reporting.png

## Figure 26 Access Events provisioning

Shows implementation manager provisioning for Access Events. It does not establish Express credential compatibility. Full capture: 2026-10-09-10-access-events.png

# New browser evidence

## Figure 27 Controlled decline capacity before

Shows 10 spots before the fee was configured for the decline test. It does not prove a charge outcome. Full capture: 2026-10-09-decline-01-capacity-before.png

## Figure 28 Controlled decline hosted result

Shows the actual Declined banner with card fields excluded. It does not prove app capacity release by itself. Full capture: 2026-10-09-decline-02-hosted-result.png

# New browser evidence

## Figure 29 Controlled decline app state

Shows that the reservation ended and was not confirmed. Reporting and server records establish its failed state. Full capture: 2026-10-09-decline-03-app-state.png

## Figure 30 Controlled decline capacity after

Shows capacity restored to 10. It does not replace the saved zero capture count. Full capture: 2026-10-09-decline-04-capacity-after.png

# New browser evidence

## Figure 31 Success sequence 1 reservation

Shows the 35 dollar registration before payment. It does not prove a charge. Full capture: 2026-10-09-success-01-reservation.png

## Figure 32 Success sequence 2 hosted checkout

Shows the blank Worldpay hosted form and order reference. It does not prove approval. Full capture: 2026-10-09-success-02-hosted.png

# New browser evidence

## Figure 33 Success sequence 3 return loading

Shows the app reloading after provider processing. It does not prove payment confirmation. Full capture: 2026-10-09-success-03-processing.png

## Figure 34 Success sequence 4 confirmation

Shows the app confirmed entry. Reporting independently records one approved capture; this screen does not prove settlement. Full capture: 2026-10-09-success-04-confirmation.png

# New browser evidence

## Figure 35 Success sequence 5 dashboard

Shows one confirmed league entry for the test user. It does not prove portal completeness or bank settlement. Full capture: 2026-10-09-success-05-dashboard.png

## Figure 36 Confirmation after refresh

Shows the same confirmed entry after refresh. Saved replay counts, not the image alone, prove unchanged registration and capture counts. Full capture: 2026-10-09-success-refresh.png

# New browser evidence

## Figure 37 Confirmation after route fix

Shows the existing confirmed entry after the endpoint fix. It does not demonstrate a new charge. Full capture: 2026-10-09-success-after-fix-refresh.png
