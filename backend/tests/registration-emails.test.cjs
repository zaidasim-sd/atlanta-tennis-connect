const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const nodemailer = require("nodemailer");
const { League } = require("../dist/models/League");
const { Reservation } = require("../dist/models/Reservation");
const { RegistrationEmail } = require("../dist/models/RegistrationEmail");
const { WorldpayPayment } = require("../dist/payment/worldpayPayment");
const payments = require("../dist/payment");
let state = "payment_pending";
let amount = 3500;
payments.getPaymentProvider = () => ({
  name: "worldpay",
  async retrievePayment() { return { status: state, amountCents: amount, currency: "usd" }; },
});
const { confirmPayment } = require("../dist/lib/reservationService");
const { deliverRegistrationEmails, registrationMessage, smtpConfig } = require("../dist/lib/registrationEmail");
const savedTransport = nodemailer.createTransport;
const sent = [];
let reject = false;
nodemailer.createTransport = () => ({
  async sendMail(message) {
    if (reject) throw Object.assign(new Error("secret must never be logged"), { code: "EAUTH" });
    sent.push(message);
    await new Promise(resolve => setTimeout(resolve, 10));
    return { accepted: [message.to], rejected: [] };
  },
  close() {},
});
let db;
let reservation;
before(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri());
  await Promise.all([League.init(), Reservation.init(), RegistrationEmail.init(), WorldpayPayment.init()]);
});
after(async () => {
  nodemailer.createTransport = savedTransport;
  await mongoose.disconnect();
  await db.stop();
});
beforeEach(async () => {
  for (const model of Object.values(mongoose.models)) await model.deleteMany({});
  sent.length = 0; reject = false; state = "payment_pending"; amount = 3500;
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_USER = "sender@example.com";
  process.env.SMTP_PASS = "test-only-not-a-secret";
  process.env.SMTP_FROM = "sender@example.com";
  process.env.MERCHANT_NOTIFICATION_EMAIL = "merchant@example.com";
  process.env.EMAIL_ENABLED = "true";
  process.env.WORLDPAY_ENVIRONMENT = "sandbox";
  await League.create({ slug: "email-league", seasonSlug: "season", name: "Midtown <Open>",
    format: "men-singles", skillLevel: "3.5", feeCents: 3500, scheduleDay: "Tuesday",
    scheduleTime: "6 PM", venue: "Piedmont", playerLimit: 10, spotsRemaining: 9,
    startDate: "2026-11-01", endDate: "2026-12-01" });
  reservation = await Reservation.create({ leagueSlug: "email-league", playerSlug: "player",
    playerEmail: "player@example.com", paymentProvider: "worldpay", amountCents: 3500,
    status: "payment_pending", paymentIntentId: "worldpay_test", idempotencyKey: "reservation",
    heldAt: new Date(), expiresAt: new Date(Date.now() + 600000) });
  await WorldpayPayment.create({ _id: "worldpay_test", amountCents: 3500,
    transactionId: "authorization-test", captureTransactionId: "capture-test" });
});
test("pending and amount mismatched payments cannot queue confirmation emails", async () => {
  await confirmPayment("worldpay_test", "registered");
  assert.equal(await RegistrationEmail.countDocuments(), 0);
  state = "paid"; amount = 1;
  await assert.rejects(confirmPayment("worldpay_test", "registered"), /amount mismatch/);
  assert.equal(await RegistrationEmail.countDocuments(), 0);
  assert.equal(sent.length, 0);
});
test("cancelled payments release their hold without confirmation emails", async () => {
  state = "cancelled";
  await confirmPayment("worldpay_test", "paid");
  assert.equal((await Reservation.findById(reservation.id)).status, "cancelled");
  assert.equal((await League.findOne()).spotsRemaining, 10);
  assert.equal(await RegistrationEmail.countDocuments(), 0);
  assert.equal(sent.length, 0);
});
test("verified payment sends separate player and merchant emails with league details and sandbox label", async () => {
  state = "paid";
  await confirmPayment("worldpay_test", "paid");
  assert.equal((await Reservation.findById(reservation.id)).status, "registered");
  assert.deepEqual(sent.map(m => m.to).sort(), ["merchant@example.com", "player@example.com"]);
  for (const m of sent) {
    assert.match(m.subject, /\[Sandbox\]/);
    for (const value of ["Midtown <Open>", "Piedmont", "Tuesday", "USD 35.00"]) assert.ok(m.text.includes(value));
    if (m.to === "merchant@example.com") assert.ok(m.text.includes("capture-test"));
    if (m.to === "player@example.com") {
      assert.ok(m.text.includes("2026-11-01"));
      assert.ok(!m.text.includes("capture-test"));
    }
    assert.match(m.html, /Midtown &lt;Open&gt;/);
    assert.ok(!m.html.includes("Midtown <Open>"));
  }
  assert.equal(await RegistrationEmail.countDocuments({ status: "sent" }), 2);
});
test("concurrent confirmation replays and workers send one message per recipient role", async () => {
  state = "paid";
  process.env.EMAIL_ENABLED = "false";
  await Promise.all(Array.from({ length: 8 }, () => confirmPayment("worldpay_test", "paid")));
  assert.equal(await RegistrationEmail.countDocuments(), 2);
  process.env.EMAIL_ENABLED = "true";
  await Promise.all(Array.from({ length: 8 }, () => deliverRegistrationEmails()));
  await confirmPayment("worldpay_test", "paid");
  assert.equal(sent.length, 2);
  assert.equal((await League.findOne()).spotsRemaining, 9);
});
test("SMTP outage preserves confirmed registration and retries durable messages", async () => {
  state = "paid"; reject = true;
  await confirmPayment("worldpay_test", "paid");
  assert.equal((await Reservation.findById(reservation.id)).status, "registered");
  assert.equal(await RegistrationEmail.countDocuments({ status: "pending", attempts: 1, lastErrorCode: "EAUTH" }), 2);
  await deliverRegistrationEmails();
  assert.equal(sent.length, 0);
  reject = false;
  await RegistrationEmail.updateMany({}, { nextAttemptAt: new Date(0) });
  await deliverRegistrationEmails();
  assert.equal(sent.length, 2);
  assert.equal(await RegistrationEmail.countDocuments({ status: "sent", attempts: 2 }), 2);
});
test("missing SMTP host queues messages without claiming delivery or consuming attempts", async () => {
  delete process.env.SMTP_HOST;
  assert.equal(smtpConfig(), null);
  state = "paid";
  await confirmPayment("worldpay_test", "paid");
  assert.equal(sent.length, 0);
  assert.equal(await RegistrationEmail.countDocuments({ status: "pending", attempts: 0 }), 2);
});
test("SMTP display name uses login mailbox and port 587 uses STARTTLS", () => {
  process.env.SMTP_FROM = "Baseline Atlanta Tennis";
  process.env.SMTP_PORT = "587";
  assert.equal(smtpConfig().from, "sender@example.com");
  assert.equal(smtpConfig().fromName, "Baseline Atlanta Tennis");
  assert.equal(smtpConfig().secure, false);
  process.env.SMTP_FROM = "Unsafe\r\nBcc: other@example.com";
  assert.equal(smtpConfig(), null);
});
test("expired delivery claims recover with the same Message-ID", async () => {
  state = "paid"; process.env.EMAIL_ENABLED = "false";
  await confirmPayment("worldpay_test", "paid");
  const email = await RegistrationEmail.findOne({ kind: "player" });
  assert.match(registrationMessage(email).text, /No live money/);
  await RegistrationEmail.updateMany({}, { status: "sending", leaseUntil: new Date(0), leaseToken: "crashed-worker" });
  process.env.EMAIL_ENABLED = "true";
  await deliverRegistrationEmails();
  const originalIds = sent.map(m => m.messageId).sort();
  await RegistrationEmail.updateMany({}, { status: "pending", nextAttemptAt: new Date(0) });
  await deliverRegistrationEmails();
  assert.deepEqual(sent.slice(2).map(m => m.messageId).sort(), originalIds);
});
