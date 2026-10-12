# Validation evidence collected 12 October 2026

Environment: https://atlanta-tennis-staging.vercel.app. Deployment: `dpl_jqV5yDjnLt4BR2AuPc8WejUU5RWi`, labelled source `f7c375920faae9692dc4e03caa13beb2a413ad18`. This is not the local source release `071e114`; no replacement staging deployment was performed.

## Provider and staging records

- `stripe-declines-initial.json`: real insufficient-funds and fraudulent declines, 09:48-09:49 PKT. Saves intent/event IDs, test mode, unpaid application state, held capacity and cancellation cleanup.
- `stripe-declines.json`: repeat functional run, 09:51-09:52 PKT, adding two concurrent same-player retries and authenticated refresh. Both reuse the original reservation, intent and expiry. This is not a load test.
- `webhook-event-followup.json`: first-run Stripe events retrieved again at 09:49:25 PKT; pending deliveries fell from 2 to 0.
- `webhook-delivery-logs.json`: four actual staging webhook HTTP 200 records at 09:48:08, 09:48:17, 09:48:26 and 09:48:30 PKT. Runtime request logs do not contain event IDs; correlation is by time. No manually signed webhook was posted by these runners.
- `qa-cleanup.json`: dedicated QA league capacity restored, no active reservations, league closed and seven new QA accounts disabled. Financial and audit records retained; shared demo data not deleted.

The recorded real webhook scope is failure-event delivery/acknowledgement. It does not newly establish successful-payment registration, full replay behavior on the deployed build, production performance or live merchant readiness.

## Local source verification

- `backend-tests.txt`: 33 passing integration tests, including anonymous, cross-account, nonexistent/unpaid and forged-amount confirmation cases, then actual provider-state success and a single confirmation audit entry under repeated calls. Uses an in-memory MongoDB replica set.
- `backend-unit-tests.txt`: 7 passing unit tests.
- `frontend-tests.txt`: 27 passing frontend tests.
- `frontend-typecheck.txt`: successful TypeScript checks.
- `frontend-build.txt`: successful production build.

Screenshots embedded in the PDF are genuine browser captures of `evidence-viewer.cjs`, a read-only local display of the saved records. They are not Stripe Dashboard images. The full raw records accompany the screenshots; the viewer does not execute tests or change state.

## Repeating the real decline runner

Use only a dedicated, disposable, approved staging QA league. The current recorded fixture is closed after cleanup. Prepare a fresh men-singles 4.0 league with ZIP 30309, two available places, an open registration window and no existing QA registrations. The current deployed build requires `homeCourtId=mcclatchey`, which matches that ZIP.

Set `VALIDATION_ENV_FILE` to a protected environment file containing a Stripe test secret (the runner rejects live secrets), `TEST_LEAGUE_ID` to the QA fixture slug, and optionally `TEST_BASE_URL` and a new `VALIDATION_OUTPUT` path. Run `node backend/scripts/validate-stripe-declines.cjs` from the repository root. Never overwrite prior evidence when recording a new run. The runner cancels created holds and signs out; close the QA fixture and disable its newly created accounts afterwards, retaining audit history. Do not point it at a live-money environment.
