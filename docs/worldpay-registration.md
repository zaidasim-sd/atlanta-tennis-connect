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

Express checkout sessions last up to ten minutes. A session is reused on refresh; if it expires, cancel the reservation and reserve again. Cancellation expires the hosted session and voids outstanding authorization before releasing capacity. USD payments, full refunds, and partial refunds are supported. Retrying the same refund amount for the same payment uses the same operation key, preventing duplicate refunds.

Session creation uses a durable MongoDB claim. If session creation has an ambiguous network/database failure, retries fail closed instead of creating a second payable session. The organizer must inspect the Express portal before resolving that claim and reservation. Do not simply delete the claim while a hosted session may still be usable.

Changing providers does not migrate old reservations. Existing reservations retain their provider and cannot be processed by a different adapter. Finish or cancel outstanding checkouts before switching a deployed environment.

Validation: `npm --prefix backend run build`, `node --test backend/tests/worldpay.test.cjs`, `npm --prefix backend test`, and `npm run typecheck`. The Worldpay tests use simulated API responses; complete an end-to-end checkout with your sandbox merchant before production.

API contract: [Worldpay Express Interface Specification](https://docs.worldpay.com/assets/pdf/ExpressInterfaceSpecification3.pdf), Hosted Payments, TransactionSetup, TransactionQuery, TransactionSetupExpire, and credit transaction methods.
