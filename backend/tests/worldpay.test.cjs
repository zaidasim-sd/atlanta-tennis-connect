const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const {
  WorldpayProvider,
  worldpayStatus,
  operationKey,
  parseExpressResponse,
} = require("../dist/payment/worldpayProvider");
const { WorldpayPayment } = require("../dist/payment/worldpayPayment");
let db, originalFetch, requests, state, setupFails;
const input = {
  reservationId: "0123456789abcdef01234567",
  amountCents: 4500,
  currency: "usd",
  description: "League registration",
  playerEmail: "player@example.com",
  metadata: { leagueSlug: "fall-league" },
};
before(async () => {
  for (const key of ["API_KEY", "ACCEPTOR_ID", "APP_ID", "ACCOUNT_ID"])
    process.env[`WORLDPAY_HOSTED_PAYMENTS_${key}`] = "test";
  process.env.CLIENT_URL = "http://localhost:5173";
  originalFetch = global.fetch;
  db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri());
});
after(async () => {
  global.fetch = originalFetch;
  await mongoose.disconnect();
  await db?.stop();
});
beforeEach(async () => {
  await WorldpayPayment.deleteMany({});
  requests = [];
  state = null;
  setupFails = false;
  global.fetch = async (url, options) => {
    requests.push({ url, body: options.body });
    const method = options.body.match(/^<([A-Za-z]+)/)[1];
    if (method === "TransactionSetup" && setupFails) throw new Error("timeout");
    let fields = "";
    if (method === "TransactionSetup")
      fields =
        "<TransactionSetup><TransactionSetupID>setup-123</TransactionSetupID></TransactionSetup>";
    if (method === "TransactionQuery")
      fields = `<ReportingData>&lt;Items&gt;${state ? `&lt;Item&gt;&lt;TransactionID&gt;txn-123&lt;/TransactionID&gt;&lt;TransactionStatusCode&gt;${state}&lt;/TransactionStatusCode&gt;&lt;ApprovedAmount&gt;45.00&lt;/ApprovedAmount&gt;&lt;/Item&gt;` : ""}&lt;/Items&gt;</ReportingData>`;
    if (method === "CreditCardAuthorizationCompletion") state = "6";
    if (method === "CreditCardVoid") state = "4";
    if (method === "CreditCardReturn")
      fields = "<Transaction><TransactionID>refund-123</TransactionID></Transaction>";
    return new Response(
      `<${method}Response><Response><ExpressResponseCode>0</ExpressResponseCode>${fields}</Response></${method}Response>`,
    );
  };
});
test("hosted creation persists a single session, uses sandbox and escapes XML", async () => {
  const provider = new WorldpayProvider();
  const first = await provider.createPayment({ ...input, description: "League & tennis" });
  const second = await provider.createPayment(input);
  assert.equal(
    first.checkoutUrl,
    "https://certtransaction.hostedpayments.com/?TransactionSetupID=setup-123",
  );
  assert.deepEqual(first, second);
  assert.equal(requests.length, 1);
  assert.match(requests[0].body, /League &amp; tennis/);
  assert.match(requests[0].body, /<TransactionSetupMethod>2<\/TransactionSetupMethod>/);
  assert.equal(first.clientSecret, undefined);
});
test("ambiguous creation cannot issue another payable session", async () => {
  const provider = new WorldpayProvider();
  setupFails = true;
  await assert.rejects(provider.createPayment(input), /timeout/);
  setupFails = false;
  await assert.rejects(provider.createPayment(input), /unresolved/);
  assert.equal(requests.length, 1);
});
test("server reports authorization and completes it before reporting paid", async () => {
  const provider = new WorldpayProvider();
  const created = await provider.createPayment(input);
  state = "5";
  assert.equal((await provider.retrievePayment(created.paymentIntentId)).status, "authorized");
  await provider.capturePayment(created.paymentIntentId);
  assert.equal((await provider.retrievePayment(created.paymentIntentId)).status, "paid");
  assert.match(
    requests.find((r) => r.body.startsWith("<CreditCardAuthorizationCompletion")).body,
    /<IdempotencyKey>[a-f0-9-]{36}<\/IdempotencyKey>/,
  );
});
test("cancellation expires checkout and voids authorization", async () => {
  const provider = new WorldpayProvider();
  const created = await provider.createPayment(input);
  state = "5";
  await provider.cancelPayment(created.paymentIntentId);
  assert.equal((await provider.retrievePayment(created.paymentIntentId)).status, "cancelled");
  assert.ok(requests.some((r) => r.body.startsWith("<TransactionSetupExpire")));
});
test("a completed payment cannot be cancelled; refunds use the transaction ID", async () => {
  const provider = new WorldpayProvider();
  const created = await provider.createPayment(input);
  state = "6";
  await assert.rejects(provider.cancelPayment(created.paymentIntentId), /already succeeded/);
  const refund = await provider.refundPayment({
    paymentIntentId: created.paymentIntentId,
    amountCents: 2000,
  });
  assert.equal(refund.refundId, "refund-123");
  assert.match(requests.at(-1).body, /<TransactionAmount>20.00<\/TransactionAmount>/);
});
test("unverified webhook and invalid responses cannot confirm payment", async () => {
  await assert.rejects(new WorldpayProvider().parseWebhookEvent(), /authenticated reconciliation/);
  assert.throws(() =>
    parseExpressResponse("<Response><ExpressResponseCode>20</ExpressResponseCode></Response>"),
  );
  assert.throws(() => parseExpressResponse("<!DOCTYPE foo><Response/>"));
  assert.equal(worldpayStatus("16"), "payment_pending");
  assert.equal(operationKey("capture"), operationKey("capture"));
  assert.notEqual(operationKey("capture"), operationKey("refund"));
});

test('provider selection loads only the requested adapter', () => {
  const { spawnSync } = require('node:child_process');
  for (const name of ['mock', 'worldpay']) {
    const run = spawnSync(process.execPath, ['-e', `const p=require('./dist/payment').getPaymentProvider(); console.log(p.name); if(Object.keys(require.cache).some(k=>k.endsWith('stripeProvider.js'))) process.exit(2)`], {
      cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8',
      env: { ...process.env, PAYMENT_PROVIDER: name, STRIPE_SECRET_KEY: '' }
    });
    assert.equal(run.status, 0, run.stderr); assert.equal(run.stdout.trim(), name);
  }
});
test('concurrent creation cannot issue two hosted sessions', async () => {
  const provider = new WorldpayProvider();
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => provider.createPayment(input)));
  assert.ok(results.some(r => r.status === 'fulfilled'));
  assert.equal(requests.filter(r => r.body.startsWith('<TransactionSetup ')).length, 1);
});
test('amount changes and unsupported currency are rejected', async () => {
  const provider = new WorldpayProvider();
  await provider.createPayment(input);
  await assert.rejects(provider.createPayment({ ...input, amountCents: 5000 }), /amount mismatch/);
  await assert.rejects(provider.createPayment({ ...input, currency: 'eur' }), /USD/);
});


test('Reporting No Record(s) is pending only in query context', async () => {
  const xml = '<TransactionQueryResponse><Response><ExpressResponseCode>90</ExpressResponseCode><ExpressResponseMessage>No Record(s)</ExpressResponseMessage></Response></TransactionQueryResponse>';
  assert.throws(() => parseExpressResponse(xml), /code 90/);
  assert.equal(parseExpressResponse(xml, true).ReportingData, '');
  assert.throws(() => parseExpressResponse(xml.replace('No Record(s)', 'Other failure'), true), /code 90/);
  const provider = new WorldpayProvider();
  const created = await provider.createPayment(input);
  const simulatedFetch = global.fetch;
  global.fetch = async (url, options) => options.body.startsWith('<TransactionQuery ')
    ? new Response(xml) : simulatedFetch(url, options);
  const result = await provider.retrievePayment(created.paymentIntentId);
  assert.equal(result.status, 'payment_pending');
  assert.equal(result.amountCents, input.amountCents);
});
