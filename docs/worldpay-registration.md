# Worldpay Express Hosted Payments

Set `PAYMENT_PROVIDER=worldpay` in the backend environment and restart the API. Use `stripe` or `mock` to select those adapters instead. Only the selected adapter is constructed; Worldpay does not require Stripe credentials or a Stripe publishable key.

Required Worldpay credentials:

```dotenv
WORLDPAY_HOSTED_PAYMENTS_API_KEY=<Express AccountToken>
WORLDPAY_HOSTED_PAYMENTS_ACCEPTOR_ID=<AcceptorID>
WORLDPAY_HOSTED_PAYMENTS_APP_ID=<ApplicationID>
WORLDPAY_HOSTED_PAYMENTS_ACCOUNT_ID=<AccountID>
WORLDPAY_ENVIRONMENT=sandbox
```

`WORLDPAY_API_KEY` is not used by this adapter: Express authenticates using AccountID, AccountToken, and AcceptorID in the XML request. Access Worldpay is a different API and its keys are not interchangeable with Express credentials.

`CLIENT_URL` must identify the frontend origin. Optionally override it with `WORLDPAY_RETURN_ORIGIN`. In deployment use the public HTTPS frontend origin. `WORLDPAY_TERMINAL_ID` defaults to `0001`; use the terminal assigned to your merchant account if different. Set `WORLDPAY_ENVIRONMENT=production` only with provisioned production credentials.

Players are redirected to Worldpay's card entry page and returned to registration. The frontend polls the authenticated reconciliation endpoint. The backend independently queries Express Reporting, checks the amount, and completes an authorization only while the reservation is active. Redirect parameters cannot mark a payment paid. Express redirects are not Stripe-style webhooks; the existing reconciliation cron also checks pending Worldpay payments.

Express checkout sessions last up to ten minutes. A session is reused on refresh; if it expires, cancel the reservation and reserve again. Cancellation closes the hosted session and requests reversal of an outstanding authorization. Capacity is released only after Reporting verifies cancellation. Outages and unresolved reversals retain capacity for retry, even beyond the nominal hold deadline. A missing setup is treated as expired only for the exact documented missing setup response after ten minutes; this does not cancel an authorization by itself.

The adapter implements full and partial return requests against the capture transaction ID, durable refund operations, a cumulative refund limit, and a deterministic operation key. Retrying the same amount returns the same refund operation; it does not request another equal sized refund. An ambiguous refund remains locked for investigation. These controls do not prove that the merchant supports refunds: the actual sandbox return attempt on October 8 was rejected with code 103, Invalid Transaction Type. Successful provider refund evidence remains outstanding.

Each authenticated Reporting observation persists transaction ID, order reference, reservation, amount, currency source, provider status, provider event time and verification time. Identical observations are deduplicated. Capture transaction IDs are persisted separately. Raw Reporting responses and card fields are not stored. The actual Express report returned no currency field. `WORLDPAY_MERCHANT_CURRENCY=USD` is mandatory in production and must match the merchant configuration; this fallback is explicitly recorded as `merchant_configuration`, not independent provider currency verification. If Reporting supplies currency, a mismatch is rejected.

Hosted browser returns are checked against the setup ID and saved ValidationCode, followed by authenticated Reporting verification. This endpoint is a browser return, not a server webhook. No genuine server notification has been captured for this Express account. Access Worldpay Events is a separate product requiring provider enablement and cannot be implemented using these Express credentials alone. See [Worldpay Events](https://docs.worldpay.com/access/products/events). Strict server callback acceptance remains blocked pending Worldpay's confirmation of the merchant product and notification route.

Configure exact frontend origins in `CLIENT_URL` and `ALLOWED_ORIGINS`. Unrelated Vercel sites and arbitrary localhost origins are rejected. Add each legitimate preview origin explicitly, then restart the API. Do not solve a CORS rejection by allowing every Vercel origin.

Session creation uses a durable MongoDB claim. If session creation has an ambiguous network/database failure, retries fail closed instead of creating a second payable session. The organizer must inspect the Express portal before resolving that claim and reservation. Do not simply delete the claim while a hosted session may still be usable.

Changing providers does not migrate old reservations. Existing reservations retain their provider and cannot be processed by a different adapter. Finish or cancel outstanding checkouts before switching a deployed environment.

Validation: `npm --prefix backend run build`, `node --test backend/tests/worldpay.test.cjs`, `npm --prefix backend test`, and `npm run typecheck`. The Worldpay tests use simulated API responses; complete an end-to-end checkout with your sandbox merchant before production.

API contract: [Worldpay Express Interface Specification](https://docs.worldpay.com/assets/pdf/ExpressInterfaceSpecification3.pdf), Hosted Payments, TransactionSetup, TransactionQuery, TransactionSetupExpire, and credit transaction methods.

## Sandbox evidence and operational procedures

See [validation status](evidence/worldpay-validation-2026-10-08.md). After building the backend, run the sandbox only evidence utility:

```powershell
node backend/scripts/worldpay-sandbox-validate.cjs inspect worldpay_RESERVATION_ID
node backend/scripts/worldpay-sandbox-validate.cjs reconcile worldpay_RESERVATION_ID
node backend/scripts/worldpay-sandbox-validate.cjs refund worldpay_RESERVATION_ID 100
```

`reconcile` repeats reconciliation and records capacity and confirmed registration counts before and after. `refund` makes a real sandbox refund request and replays the same operation; use it only for an intended test refund. Neither command verifies charge counts in the provider portal or generates webhook evidence.

Daily settlement reconciliation: obtain the merchant batch and settlement report from Worldpay. Match capture IDs, references, gross amounts, refunds, fees and settlement totals to the local ledger and bank deposit. Investigate missing, duplicated, reversed and unmatched records before closing the day. Authorization or capture approval alone is not proof of bank settlement. Confirm batch schedule, reporting access, settlement currency and funding terms with the merchant implementation team.

Dispute procedure: monitor the merchant portal and provider notices daily until a genuine dispute event route is enabled. Record the dispute ID, original capture ID, reason, amount, response deadline and evidence location in the operations case register. Preserve registration acceptance and attendance evidence, submit the response through Worldpay's approved channel, and reconcile the final debit or reversal. Do not auto-release a player's spot from an unverified notice. Confirm contractual deadlines, fees and portal permissions with Worldpay before live use.
