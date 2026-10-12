# Baseline ATL V1 redeploy and release runbook

Prepared 10 October 2026. Status: procedure prepared; deployment and recovery drill not yet recorded.

## Deployment

1. Record the release commit, branch, intended Vercel project and environment. Confirm the Git remote and project identity before deploying. Preserve Lovable history: use ordinary commits and pushes, never force-push published history.
2. Run `npm test --prefix backend` and `npm run test:unit --prefix backend`; save complete output, start/end timestamps and commit SHA. Run applicable frontend checks from the root package scripts.
3. Inventory production variables in the hosting settings: database connection, effective payment provider, test/live mode, browser origins, session-cookie settings, cron authentication and provider webhook configuration. Record presence, purpose and owner, never secret values. Ensure the local Worldpay environment does not silently configure a Stripe release.
4. Confirm the plan supports the selected cron frequency and commercial use. On the approved configuration, deploy expiry every 2 minutes and reconciliation every 5 minutes. Keep the daily Hobby configuration until an eligible plan is selected. Record the deployed configuration and actual executions.
5. Deploy the recorded commit through the configured Git/Vercel integration. Record deployment ID, URL, environment, source SHA and completion status. A Git push alone is not deployment evidence.
6. Check health, league reads, authentication, player privacy, organiser-only creation and allowed/denied CORS responses. For payment tests, use isolated synthetic accounts and a dedicated league with known capacity. Do not run load against a real card network.
7. Run Gate A and provider validation. Save redacted request/response evidence, provider references, reservation/audit state and capacity before/after. Retry and refresh must reuse the original reservation and intent; paid registration must be stored once. Decline must not register the player; payable funds must be resolved before releasing capacity.
8. Verify cleanup, restored test capacity, jobs, monitoring and receipt delivery. Keep required evidence even when removing synthetic records.

## Recovery and rollback

1. If validation fails, stop release approval and record the failing deployment and symptoms. Do not delete registrations or cancel paid transactions to make a test pass.
2. Redeploy the last known-good commit or use the hosting rollback feature. Do not reset or rewrite shared Git history. Confirm compatibility with any database changes first.
3. Repeat health/authentication checks and reconcile payment/reservation state. Capture rollback completion and reviewer confirmation.
4. Restore drills use a separate database. Never overwrite the active database. Check collections, counts, indexes, sample relationships and capacity calculations before accepting the recovery result.

## Secrets inventory and ownership

Record an accountable owner, storage location, environments, last review and rotation/revocation procedure for each secret: `MONGODB_URI`, provider API keys, webhook signing secret and `CRON_SECRET`. Record browser-origin and cookie settings separately as configuration. Rotate one environment at a time and verify callbacks/jobs after rotation. Never place secret values in evidence, commits or reports.

## Evidence record

Each record contains execution date/time with timezone, commit, deployment ID, environment, provider/mode, scenario, expected result, observed result, pass/fail assertions, provider references, persisted state and cleanup outcome. Mask tokens, session cookies, client secrets, personal data and credentials. An inaccessible environment or missing artifact remains unverified.
