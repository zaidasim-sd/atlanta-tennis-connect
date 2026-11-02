const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { EzPayDirectProvider } = require("../dist/payment/ezPayDirectProvider");

let originalEnv;
beforeEach(() => {
  originalEnv = { ...process.env };
  process.env.EZPAYDIRECT_SECRET_KEY = "epd_test_sk_test";
  process.env.EZPAYDIRECT_WEBHOOK_SECRET = "whsec_test";
});
afterEach(() => { process.env = originalEnv; });

test("EPD webhook verifies its raw body, timestamp, and signature", async () => {
  const payload = Buffer.from(JSON.stringify({
    id: "evt_123", type: "order.succeeded", data: { object: { id: "ord_123" } },
  }));
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = crypto.createHmac("sha256", process.env.EZPAYDIRECT_WEBHOOK_SECRET)
    .update(`${timestamp}.${payload.toString("utf8")}`).digest("hex");
  const provider = new EzPayDirectProvider();
  assert.deepEqual(await provider.parseWebhookEvent(payload, `t=${timestamp},v1=${digest}`), {
    eventId: "evt_123", type: "order.succeeded", paymentIntentId: "ord_123", status: "paid",
  });
  await assert.rejects(provider.parseWebhookEvent(payload, `t=${timestamp},v1=${"00".repeat(32)}`), /Invalid EPD webhook signature/);
});

test("EPD creates only a pending local checkout before a card token exists", async () => {
  const provider = new EzPayDirectProvider();
  const result = await provider.createPayment({
    reservationId: "0123456789abcdef01234567", amountCents: 3500, currency: "usd",
    description: "League registration", playerEmail: "player@example.test", metadata: {},
  });
  assert.equal(result.paymentIntentId, "epd_pending_0123456789abcdef01234567");
  assert.equal(result.status, "payment_pending");
  await assert.rejects(provider.createPayment({
    reservationId: "id", amountCents: 1, currency: "eur", description: "x", playerEmail: "a@b.test", metadata: {},
  }), /USD/);
});
