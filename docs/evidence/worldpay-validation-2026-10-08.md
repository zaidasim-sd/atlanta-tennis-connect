# Worldpay validation status

Updated on 9 October 2026. Browser work began on 8 October and resumed after interruption on 9 October. Only Worldpay certification endpoints were used. No production payment endpoint was called.

Recommendation: decision pending merchant and provider confirmation. Actual success, controlled decline and abandoned checkout recovery now have saved evidence. A genuine server notification and production merchant approval remain outstanding.

## Requirement status

| Requirement | Status | Evidence |
| --- | --- | --- |
| Exact Worldpay product and sandbox | Done | E1, sources 8 and 11 in the report |
| Exact intended E2Pay and US USD eligibility | Blocked | Existing candidate research, outreach drafts |
| Unique reference and hosted checkout | Done | E5 and success screenshots |
| Successful test payment | Done | E5, E9, success screenshots |
| Controlled decline in the app | Done | E6, decline screenshots |
| Abandoned checkout and released hold | Done | E3, abandonment screenshots |
| Browser double click | Done | E2, double click screenshots |
| Eight concurrent registration calls | Partly done | E7, one reservation and setup, two request failures |
| Hosted return replay and refresh | Done | E4, confirmation refresh screenshots |
| Genuine server notification and replay | Blocked | E8, no provider route provisioned |
| Transaction persistence and currency | Partly done | E5 and E9, currency is merchant configuration |
| Portal charge count screenshot | Blocked | E9 is API evidence only |
| Late payment and actual outage recovery | Not done | Not run in this session |
| Authorization 674877436 resolution | Blocked | E10, reversal retry declined |
| Successful refund | Blocked | Prior report records code 103, no new refund run |
| Settlement and dispute validation | Not done | Official material and proposed procedures only |
| Production approval and live settlement | Blocked | No live account approval or live test |
| Outreach drafts | Done | docs/outreach, drafts only |
| Final tests and disposable user cleanup | Done | E13 and E14 |

## Repository and isolated setup

Origin is https://github.com/zaidasim-sd/atlanta-tennis-connect.git. The checked out branch is worldpay. The starting commit is 891965060a58839eb9a3ad273f54683580546069. New evidence and the confirmation endpoint fix remain local and are not claimed as pushed.

The API used PAYMENT_PROVIDER=worldpay and WORLDPAY_ENVIRONMENT=sandbox. Local ports were 3001 for the API and 5173 for the frontend. The disposable database was worldpay_evidence_20261008. Importing the app did not start background jobs. Reconciliation was run explicitly.

Sandbox Witness was created through the normal browser signup flow with worldpay.evidence.20261008@example.test. The browser reached league registration while signed in. HTTP Witness was created through the normal signup API with worldpay.concurrent.20261009@example.test for the concurrency run. Random passwords and session cookies were not saved or printed. No authentication bypass was added.

## Actual new runs

### Controlled decline

Order 6ac8701dd322b225fc340675 used the documented Express test card and 257 cent amount. The disposable league fee was changed after the capacity screenshot and before reservation creation. The hosted page returned Declined. Reporting records authorization 674988272 as Declined, status code 2. The request response code and transaction status code are different fields.

The reservation is failed and unconfirmed. Checkout closure was verified. Capacity was 10 before the run and 10 after closure. Confirmed registrations stayed at zero. The stored payment state is cancelled after closure, while Reporting retains the historical decline. Card fields were excluded from the hosted result screenshot.

### Abandonment

Order 6ac78e559a3e1e883801d9cf reached the blank hosted form. The browser tab was closed without card entry on 8 October at 12:36:53 UTC. Its reservation deadline was 12:51:37 UTC. Reconciliation ran on 9 October at 04:28 UTC after the interrupted session resumed. This does not prove release precisely at the nominal deadline.

Reporting returned code 90, No Record(s), for this order. No authorization was found in the observed queries. Reconciliation closed the checkout, marked the reservation expired and released capacity. Capacity changed from the seeded 10 to the held 9 and returned to 10. Confirmed registrations remained zero. The final API query still found zero transaction records.

### Double click and concurrent registration

The browser double clicked Reserve Spot and Pay. The button became disabled while creation ran. One checkout was displayed. Order 6ac78f769a3e1e883801daa6 had one reservation and one hosted setup. Eight concurrent adapter create calls reused that setup. The unpaid order had zero Reporting transactions and was later expired safely.

A separate run sent eight authenticated HTTP registration requests for the same player and league. Order 6ac8712dd322b225fc340789 had one reservation and one setup. Six requests returned HTTP 201 with the same reservation. Two returned HTTP 500 while checkout creation was unresolved. This is a request reliability gap. It did not create a second session.

Capacity was 10 before, 9 after creation and 10 after verified cancellation. Confirmed registrations remained zero. Zero Reporting transactions is expected for an unpaid hosted setup. A created checkout is not a charge record. The brief's expectation of one Reporting charge record cannot apply before card submission. Portal charge counts remain outstanding.

### Success and duplicate confirmation

Order 6ac86f32d322b225fc3404e3 completed a 3500 cent sandbox payment through the app and hosted page. Reporting records authorization 674988139 as AuthCompleted and capture 674988144 as Approved. The app has one confirmed registration and capacity 9. The numbered screenshots show reservation, blank hosted checkout, the app return loading state, confirmation and dashboard. The return loading screenshot is not provider confirmation evidence.

The hosted return verification function was replayed twice. The reconciliation job was run twice. It found no pending paid reservation to transition. Before and after snapshots retain one registration, one saved capture ID and capacity 9. The confirmation page was refreshed three times. A later refresh after the confirmation route fix also showed the existing confirmed registration. The final Reporting query has two transaction rows, consisting of the authorization and one capture. Two rows do not mean two charges.

No video was recorded. The available browser tool exposes screenshot capture and does not expose video recording.

## Reporting API count comparison

These are authenticated Reporting API records, not portal screenshots. No portal account email or authenticated portal access was available. No third party account was created and no login challenge was bypassed.

| Order suffix | Reporting rows | Approved captures | Confirmed app registrations before cleanup |
| --- | --- | --- | --- |
| 3801d9cf abandonment | 0 | 0 | 0 |
| fc340675 decline | 1 | 0 | 0 |
| 3801daa6 double click | 0 | 0 | 0 |
| fc340789 HTTP concurrency | 0 | 0 | 0 |
| fc3404e3 success | 2 | 1 | 1 |

There is no observed mismatch between the saved app registrations and approved capture count. Portal completeness and bank settlement have not been independently verified. The query window and exact references are saved in E9.

## Outstanding authorization and refund

Authorization 674877436 was queried first and remained Authorized for 4000 cents. One more reversal was attempted using the adapter's existing deterministic key. It returned code 20, Declined. The before and after state remains unconfirmed and held. A read only state check on 9 October at 04:58 UTC still found Authorized and payment_pending. No further reversal or refund was submitted for that order. The evidence helper now blocks another reversal retry after the saved run.

The earlier report states that a 100 cent return for capture 674877825 returned code 103, Invalid Transaction Type. No refund was run in this session. The existing refund-validation.json file is empty and cannot prove that response. Treat code 103 as the prior reported finding. A successful refund and its raw provider evidence are still missing.

## Deliberate capacity rule

Capacity is deliberately retained while a payment can still succeed or provider state cannot be resolved. This can exceed the local hold deadline. It differs from the brief's unconditional release instruction on purpose. The reason is to prevent a charge after a released spot has been sold again. The brief has not been declared fully satisfied. A verified closed checkout with no live authorization can release capacity, as the new decline and abandonment runs demonstrate.

## Confirmation endpoint fix

The old POST /api/registrations/confirm route accepted browser supplied details and could mark a reservation registered without provider verification. It is now disabled with HTTP 410. Confirmation continues through the existing authenticated payment reconciliation routes. The shared PaymentProvider interface is unchanged.

A regression test checks anonymous, player and organizer requests, unchanged reservation status and unchanged capacity. A real local HTTP check also returned 410 after restarting the API. The frontend still contains an obsolete call to this route that ignores its response. That call no longer changes server records. Removing it and tightening its general success error handling are follow up work. Worldpay's checkout component already checks registered status before its success callback.

## Evidence references

E1: worldpay-run-manifest-2026-10-09.json

E2: 2026-10-08T124134089Z-concurrent.json and screenshots/2026-10-08-05-double-click.png and 2026-10-08-06-double-checkout.png

E3: 2026-10-09T042800611Z-job.json and abandonment screenshots

E4: 2026-10-09T043822571Z-replay.json and success refresh screenshots

E5: 2026-10-09T043718677Z-snapshot.json and numbered success screenshots

E6: 2026-10-09T044300429Z-snapshot.json and decline screenshots

E7: 2026-10-09T044424800Z-http-concurrent.json

E8: worldpay-callback-findings-2026-10-09.md and official page screenshots

E9: 2026-10-09T045201384Z-reports.json

E10: 2026-10-08T124109681Z-reverse.json and 2026-10-09-original-state-check.json

E11: Prior report finding only. The original refund raw output file is empty. No successful refund evidence exists.

E12: docs/outreach/e2pay-inquiry-draft.md, fiuu-contact-form-draft.md and worldpay-implementation-support-draft.md. Not sent or submitted.

E13: 2026-10-09-final-backend.txt, 2026-10-09-final-typescript.txt and 2026-10-09-confirmation-route-check.json. The baseline had 44 passing tests. The final suite has 45 passing tests, zero failures, zero skips and zero cancellations. Frontend and API TypeScript checks pass. A separate final backend unit run also passed 7 tests with zero failures. Its output is 2026-10-09-final-backend-unit.txt. The combined final backend count is 52.

E14: 2026-10-09-cleanup.json. Both test users, their sessions, five test leagues, five reservations and the disposable database were removed. The original database was not deleted or reset. Provider sandbox records remain. Local evidence servers were stopped. Temporary card input material was removed. No test only access path exists.

Provider responses in evidence are parsed XML with fields outside the allowlist redacted. They are not byte for byte XML copies. Application database records were observed before cleanup. Do not rerun disposable database reads after cleanup and describe empty results as the original test outcome.
