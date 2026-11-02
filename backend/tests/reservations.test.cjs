const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { League } = require("../dist/models/League");
const { Season } = require("../dist/models/Season");
const { Reservation } = require("../dist/models/Reservation");
const { Player } = require("../dist/models/Player");
const { AuditLog } = require("../dist/models/AuditLog");
const { TournamentHistory } = require("../dist/models/TournamentHistory");
const payments = require("../dist/payment");
const intents = new Map();
let cancelFails = false;
let paymentWins = false;
let createFails = false;
const provider = {
  name: "stripe",
  async createPayment(input) {
    const id = `pi_${input.reservationId}`;
    if (!intents.has(id))
      intents.set(id, {
        paymentIntentId: id,
        status: "payment_pending",
        amountCents: input.amountCents,
      });
    if (createFails) throw new Error("Network timeout after Stripe accepted creation");
    return { ...intents.get(id), clientSecret: `${id}_secret_test` };
  },
  async retrievePayment(id) {
    return { ...intents.get(id) };
  },
  async capturePayment(id) {
    if (intents.get(id).status !== "authorized") throw new Error("Not capturable");
    intents.get(id).status = "paid";
  },
  async cancelPayment(id) {
    if (paymentWins) intents.get(id).status = "paid";
    if (cancelFails || intents.get(id).status === "paid") throw new Error("Cannot cancel");
    intents.get(id).status = "cancelled";
  },
};
payments.getPaymentProvider = () => provider;
const {
  createReservation,
  cancelReservation,
  confirmPayment,
  reconcileReservation,
  resumeCheckout,
} = require("../dist/lib/reservationService");
const { expireReservations } = require("../dist/jobs/expireReservations");
let db;
before(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri());
  await Promise.all([
    League.init(),
    Season.init(),
    Reservation.init(),
    Player.init(),
    AuditLog.init(),
    TournamentHistory.init(),
  ]);
});
after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
});
beforeEach(async () => {
  await Promise.all([
    League.deleteMany({}),
    Season.deleteMany({}),
    Reservation.deleteMany({}),
    Player.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  intents.clear();
  cancelFails = false;
  paymentWins = false;
  createFails = false;
  await Season.create({ slug: "s-test", name: "Test Season", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", operatingState: "active-season" });
  await League.create({
    slug: "l-test",
    seasonSlug: "s-test",
    name: "Test",
    format: "men-singles",
    skillLevel: "3.5",
    feeCents: 5000,
    scheduleDay: "Tuesday",
    scheduleTime: "6 PM",
    venue: "Test",
    playerLimit: 1,
    spotsRemaining: 1,
    registrationOpen: true,
  });
});
const reserve = (email = "player@example.com") =>
  createReservation({ leagueSlug: "l-test", playerEmail: email });
const spots = async () => (await League.findOne({ slug: "l-test" })).spotsRemaining;
test("20 simultaneous players compete for the final slot: exactly one hold", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, (_, i) => reserve(`p${i}@example.com`)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await spots(), 0);
  assert.equal(await Reservation.countDocuments(), 1);
});
test("retry returns same reservation and intent without extending 15-minute hold", async () => {
  const first = await reserve();
  const second = await reserve();
  assert.equal(first.reservation.id, second.reservation.id);
  assert.equal(first.clientSecret, second.clientSecret);
  assert.equal(first.reservation.expiresAt, second.reservation.expiresAt);
  assert.equal(
    new Date(first.reservation.expiresAt) - new Date(first.reservation.createdAt),
    900000,
  );
  assert.equal(intents.size, 1);
  assert.equal(await spots(), 0);
});
test("simultaneous cancellation and webhook replays release capacity only once", async () => {
  const { reservation: r } = await reserve();
  await Promise.all(Array.from({ length: 12 }, () => cancelReservation(r.id)));
  await Promise.all(
    Array.from({ length: 12 }, () => confirmPayment(r.paymentIntentId, "cancelled", "evt_repeat")),
  );
  assert.equal(await spots(), 1);
  assert.equal((await Reservation.findById(r.id)).status, "cancelled");
});
test("expiry cancels the payable Stripe intent before freeing slot", async () => {
  const { reservation: r } = await reserve();
  await Reservation.updateOne({ _id: r.id }, { expiresAt: new Date(Date.now() - 1) });
  await Promise.all([expireReservations(), expireReservations()]);
  assert.equal(intents.get(r.paymentIntentId).status, "cancelled");
  assert.equal(await spots(), 1);
  assert.equal((await Reservation.findById(r.id)).status, "expired");
});
test("provider outage never frees a still-payable slot", async () => {
  const { reservation: r } = await reserve();
  cancelFails = true;
  await assert.rejects(cancelReservation(r.id));
  assert.equal(await spots(), 0);
  assert.equal((await Reservation.findById(r.id)).status, "payment_pending");
});
test("payment wins cancellation race: registered and capacity stays consumed", async () => {
  const { reservation: r } = await reserve();
  paymentWins = true;
  await assert.rejects(cancelReservation(r.id));
  assert.equal(await spots(), 0);
  assert.equal((await Reservation.findById(r.id)).status, "registered");
});
test("delayed success webhook after TTL still confirms paid held slot", async () => {
  const { reservation: r } = await reserve();
  await Reservation.updateOne({ _id: r.id }, { expiresAt: new Date(Date.now() - 1) });
  intents.get(r.paymentIntentId).status = "paid";
  await expireReservations();
  assert.equal((await Reservation.findById(r.id)).status, "registered");
  assert.equal(await spots(), 0);
});
test("declined attempt retains slot; stale failure webhook cannot undo success", async () => {
  const { reservation: r } = await reserve();
  await confirmPayment(r.paymentIntentId, "failed", "evt_decline");
  assert.equal(await spots(), 0);
  intents.get(r.paymentIntentId).status = "paid";
  await Promise.all([
    confirmPayment(r.paymentIntentId, "paid", "evt_success"),
    confirmPayment(r.paymentIntentId, "failed", "evt_old"),
  ]);
  assert.equal((await Reservation.findById(r.id)).status, "registered");
  assert.equal(await spots(), 0);
});
test("reconciliation of cancelled reservation cannot repeatedly release or revive it", async () => {
  const { reservation: r } = await reserve();
  await cancelReservation(r.id);
  for (let i = 0; i < 3; i++) assert.equal((await reconcileReservation(r.id)).status, "cancelled");
  assert.equal(await spots(), 1);
});
test("transaction rolls back capacity on partner validation failure", async () => {
  await assert.rejects(
    createReservation({
      leagueSlug: "l-test",
      playerEmail: "p@example.com",
      partnerEmail: "missing@example.com",
    }),
  );
  assert.equal(await spots(), 1);
  assert.equal(await Reservation.countDocuments(), 0);
});
test("doubles rejects partner with mismatched rating or organizer", async () => {
  await League.create({
    slug: "l-doubles",
    seasonSlug: "s-test",
    name: "Test Doubles",
    format: "men-doubles",
    skillLevel: "3.5",
    feeCents: 5000,
    scheduleDay: "Tuesday",
    scheduleTime: "6 PM",
    venue: "Bitsy Grant",
    spotsRemaining: 2,
    playerLimit: 2,
    registrationOpen: true,
  });
  await Player.create({
    slug: "p-wrong-rating",
    firstName: "Wrong",
    lastName: "Rating",
    email: "wrong@example.com",
    ntrp: "4.0",
    city: "Atlanta",
    zipCode: "30309",
  });
  await assert.rejects(
    createReservation({
      leagueSlug: "l-doubles",
      playerEmail: "player@example.com",
      partnerEmail: "wrong@example.com",
    }),
    /Doubles partner must have a 3.5 rating/,
  );
  await Player.create({
    slug: "p-organizer",
    firstName: "Org",
    lastName: "Anizer",
    email: "organizer@baselineatl.com",
    ntrp: "3.5",
    city: "Atlanta",
    zipCode: "30309",
  });
  await assert.rejects(
    createReservation({
      leagueSlug: "l-doubles",
      playerEmail: "player@example.com",
      partnerEmail: "organizer@baselineatl.com",
    }),
    /Organizers cannot be selected as doubles partners/,
  );
});
test("creation timeout recovers original intent and held slot on retry", async () => {
  createFails = true;
  await assert.rejects(reserve());
  assert.equal(await spots(), 0);
  assert.equal(intents.size, 1);
  createFails = false;
  const { reservation: r } = await reserve();
  assert.equal(intents.size, 1);
  assert.equal(await Reservation.countDocuments(), 1);
  assert.equal((await resumeCheckout(r.id)).reservation.id, r.id);
  await cancelReservation(r.id);
  assert.equal(await spots(), 1);
});
test("amount mismatch cannot mark registration paid", async () => {
  const { reservation: r } = await reserve();
  intents.get(r.paymentIntentId).status = "paid";
  intents.get(r.paymentIntentId).amountCents = 1;
  await assert.rejects(confirmPayment(r.paymentIntentId, "paid"), /amount mismatch/);
  assert.equal((await Reservation.findById(r.id)).status, "payment_pending");
});
test("Stripe webhook rejects unsigned or invalid signatures", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const { StripeProvider } = require("../dist/payment/stripeProvider");
  await assert.rejects(
    new StripeProvider().parseWebhookEvent(Buffer.from("{}"), ""),
    /not configured/,
  );
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  await assert.rejects(new StripeProvider().parseWebhookEvent(Buffer.from("{}"), "invalid"));
});
test("authorization inside the 15-minute deadline is captured and registered", async () => {
  const { reservation: r } = await reserve();
  intents.get(r.paymentIntentId).status = "authorized";
  assert.equal((await reconcileReservation(r.id)).status, "registered");
  assert.equal(intents.get(r.paymentIntentId).status, "paid");
  assert.equal(await spots(), 0);
});
test("authorization after the deadline is cancelled, never charged, even without cron", async () => {
  const { reservation: r } = await reserve();
  await Reservation.updateOne({ _id: r.id }, { expiresAt: new Date(Date.now() - 1) });
  intents.get(r.paymentIntentId).status = "authorized";
  assert.equal((await reconcileReservation(r.id)).status, "expired");
  assert.equal(intents.get(r.paymentIntentId).status, "cancelled");
  assert.equal(await spots(), 1);
});
