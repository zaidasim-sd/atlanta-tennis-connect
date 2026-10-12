# Baseline ATL V1 gap closure and launch decisions

Updated: 12 October 2026. Branch: `backend/staging-load-test-v1`.

**Release decision: NOT PRODUCTION READY.** The original two security fixes are completed. New saved Stripe evidence closes the decline and real failure-event webhook-delivery evidence gaps within the tested scope. Infrastructure, operational and production-validation gates remain open.

## Consistent payment verification status

This correction supersedes the affected entries in Sections 2.3 and 3 of the submitted report.

| Scenario | Correct status | Evidence needed for closure |
| --- | --- | --- |
| Stripe test-mode failed payment | Built and verified for the two recorded decline cases | Real insufficient-funds and fraudulent-card results on 12 October; test-mode intents remained unpaid, application state stayed payment_pending, held capacity was retained, and cancellation restored capacity. See stripe-declines.json and screenshots. |
| Real Stripe webhook delivery to staging | Built and verified for real failure-event delivery and acknowledgement | Stripe-generated payment_failed events, pending_webhooks falling from 2 to 0, and four corresponding staging webhook HTTP 200 request records. Logs correlate by time and do not contain event IDs. Successful-payment webhook registration is not newly verified. |
| Mock failed-payment logic | Built and verified within automated-test scope | Existing automated evidence; this does not prove a Stripe decline |
| Webhook signature rejection and replay logic | Built and verified within automated-test scope | Existing automated evidence; this does not prove provider delivery |

## Completed security fixes

Both issues were addressed and pushed in [commit 19e908b](https://github.com/zaidasim-sd/atlanta-tennis-connect/commit/19e908b) on [backend/staging-load-test-v1](https://github.com/zaidasim-sd/atlanta-tennis-connect/tree/backend/staging-load-test-v1). They are not reopened by this report.

- League creation requires a valid organiser session. Tests confirm 401 without a session, 403 for a player and 201 for an organiser; rejected requests do not create leagues.
- CORS uses exact configured/project deployment URLs, with localhost automatically allowed only outside production. The wildcard header was removed from `backend/vercel.json`. Existing CORS and preflight checks pass.
- Backend build and all 32 automated tests passed on 10 October 2026.

Additional gap fixed on 12 October: the legacy `/api/registrations/confirm` route could fabricate a paid registration from browser data. It now requires authentication and ownership, finds an existing reservation and reconciles actual provider state. The frontend shows completion only after server-confirmed registration, and no longer fabricates a registration after a verification error. Regression coverage verifies anonymous/cross-account/no-reservation/unpaid rejection, the stored amount and capacity, and single confirmation after provider success. All 33 backend tests, 7 backend unit tests, 27 frontend tests, TypeScript checks and frontend build passed. This new fix is pushed as source; replacement of the different manual staging build is pending.

Staging evidence: deployment `dpl_jqV5yDjnLt4BR2AuPc8WejUU5RWi`, labelled source `f7c375920faae9692dc4e03caa13beb2a413ad18`, at `https://atlanta-tennis-staging.vercel.app`. This differs from Git head `19e908b` before this update. Deployed decline/retry evidence and local new-fix tests must not be represented as the same build.

## Infrastructure choices and recommended decision

The current choices confirmed in this discussion are **MongoDB Atlas Free** and **Vercel Hobby**. These are not evidence that the commercial launch requirements are met.

### Vercel hosting and reservation scheduling

Official Vercel documentation limits Hobby cron jobs to once daily, with execution within the scheduled hour. More frequent expressions fail deployment. Pro supports minute-level scheduling. The repository's daily expiry and reconciliation schedules cannot provide automatic release within minutes after a 15-minute hold. Request-triggered expiry is useful but does not establish unattended cleanup.

Vercel also restricts Hobby to personal, non-commercial use. A platform accepting paid league registrations should use an eligible commercial plan before launch.

**Ali's decision:** approve Vercel Pro or another commercial hosting arrangement that supports frequent authenticated background work, including its current quoted cost and usage limits. Recommended approach: approve the hosting plan first, then set expiry to every 2 minutes and reconciliation to every 5 minutes, deploy, and retain several actual invocation records. Do not change the live Hobby schedule to an unsupported frequency or treat cron as an exact execution guarantee. Alert on missed invocations and provider failures; retain holds while a payment remains payable.

Sources checked on 10 October 2026: [Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Hobby plan](https://vercel.com/docs/plans/hobby), [Fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines).

### Database capacity and recovery

Atlas Free has no managed Atlas backups. MongoDB documents `mongodump` and `mongorestore` as a manual alternative. The submitted load record reports 500-user p95 times of approximately 8 to 19 seconds and errors in two of three runs on M0. These dated local tests do not establish deployed capacity, and upgrading alone is not proof of capacity.

**Ali's decision:** approve a database budget, expected peak concurrency and measurable acceptance targets, plus maximum acceptable data loss and recovery time. Recommended approach: compare currently offered paid tiers that meet the backup requirements, select a candidate, and rerun representative staging tests before committing to a capacity claim. Configure retention and a restore drill into an isolated database. If retaining Free for test use, automate encrypted off-site dumps and verify restoration; a successful dump alone is not a recovery test. Free/Hobby should not be signed off as the production configuration while these gates remain unmet.

Sources: [Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/), [Atlas backup and restore](https://www.mongodb.com/docs/atlas/backup-restore-cluster/).

## Remaining gates and required actions

| Gap | Current position | Action and closure evidence |
| --- | --- | --- |
| Stripe decline and webhook delivery | Built and verified within recorded scope | Evidence is saved. Rerun on the approved release build; successful-payment webhook registration remains a separate scenario. |
| Full Gate A validation | Partially verified on deployed system | Concurrent same-player retries returned the same reservation and Stripe intent without extending expiry; authenticated refresh found the original hold. Expiry/race and payment-at-expiry still need deployed and selected-tier evidence. |
| Background job timing | Partially built; plan decision required | Approve eligible scheduling, configure it and save deployed executions and restored capacity. |
| Refund issuing and spot policy | Partially built; policy decision required | Ali must approve who may refund, full/partial eligibility and whether/when capacity is released. Then build an organiser-only, retry-safe refund workflow and test provider outcomes and concurrent retries. Do not assume a refund automatically frees a spot. |
| Live payment setup | Blocked by business decision | Confirm provider, merchant entity, currency, settlement account and agreement; then approve a controlled live test with retained reconciliation evidence. Existing test keys are not live approval. |
| Backups and restore | Not built/verified in submitted record | Configure the chosen recovery method and retention, run isolated restore, compare counts/indexes and demonstrate recovery targets. |
| Monitoring and retention | Partially built | Select destination and owner; implement and test failure alerts for jobs, payment processing, database errors and availability; approve retention and record a received alert. |
| Confirmation/receipt email | Not built in submitted record | Choose provider and authenticated sending domain; implement durable retry-safe sending, then verify delivery and duplicate suppression. |
| Support contact | Not built in submitted record | Ali supplies/approves a monitored address and accountable owner; publish it and test receipt. Do not invent an address. |
| Redeploy and secrets process | Runbook prepared; execution unverified | Follow the companion runbook, record a successful redeploy and recovery; assign secret owners and review expiry/rotation. |
| Payment setting per environment | Not verified | Record the effective provider and test/live mode in each deployed environment without exposing keys. Local configuration alone is insufficient. |
| Synthetic/demo data removal | Pending controlled cleanup | Inventory and identify test records, take and verify a backup, approve an exact removal manifest, clean only those records and reconcile capacity. Never bulk-wipe the shared database. |
| Final release smoke test | Not verified | Run the complete player/admin/payment journey on the production configuration with a reviewer and obtain explicit sign-off. |

## Validation limits and evidence

Real Stripe decline runs were executed at 09:48 to 09:52 PKT on 12 October 2026. The repeat run included same-player concurrent retries and refresh. These are a few functional requests, not a provider load test. Screenshots are genuine captures of a local read-only viewer of the saved JSON/log evidence; they are not Stripe Dashboard screenshots. Raw records are retained alongside them. The screenshot of the staging homepage proves UI availability only.

QA cleanup restored the dedicated league to two spots with zero active reservations, closed that synthetic league and disabled seven newly created QA accounts. Financial/audit records remain retained. Shared demo data was not bulk-deleted.

No new live-payment, backup/restore, received alert, delivered email, production-tier load test or deployed expiry/race pass is claimed. Provider selection, refund rules, email/support and monitoring ownership still require decisions. Separate Worldpay evidence on another branch does not verify Stripe scenarios here.

**Next decision sequence:** Ali approves commercial hosting and database/recovery requirements, then payment/refund and communication policies. Engineering deploys and validates the approved configuration, saves all evidence and updates each status only after its closure criteria pass. Until then, the release decision remains **NOT PRODUCTION READY**.
