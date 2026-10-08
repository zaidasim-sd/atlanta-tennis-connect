const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.NODE_ENV = "production";
process.env.CLIENT_URL = "https://staging.example.test";
process.env.ALLOWED_ORIGINS = "https://other.example.test";
process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_example";
process.env.ADMIN_KEY = "obsolete-key";
const { Account, AuthSession, AuthAttempt } = require("../dist/models/Auth");
const { Player } = require("../dist/models/Player");
const { Reservation } = require("../dist/models/Reservation");
const { League } = require("../dist/models/League");
const { AuditLog } = require("../dist/models/AuditLog");
const { hashPassword } = require("../dist/lib/auth");
const payments = require("../dist/payment");
let providerCalls = 0;
const intents = new Map();
payments.getPaymentProvider = () => ({
  name: "stripe",
  async createPayment(i) { providerCalls++; const id = `pi_${i.reservationId}`; if (!intents.has(id)) intents.set(id, { paymentIntentId: id, amountCents: i.amountCents, status: "payment_pending", clientSecret: "secret_not_public" }); return intents.get(id); },
  async retrievePayment(id) { providerCalls++; return intents.get(id); },
  async cancelPayment(id) { providerCalls++; intents.get(id).status = "cancelled"; },
  async parseWebhookEvent() { throw new Error("Invalid signature"); },
});
const { app } = require("../dist/server");
let db, server, base, encoded;
const password = "Long unique test passphrase 924!";
const cookies = {};
async function request(path, { method = "GET", who, body, origin = process.env.CLIENT_URL, headers = {}, cookie } = {}) {
  const res = await fetch(base + path, { method, headers: {
    ...(origin === null ? {} : { Origin: origin }),
    ...(who ? { Cookie: cookies[who] } : {}), ...(cookie ? { Cookie: cookie } : {}),
    ...(body ? { "Content-Type": "application/json" } : {}), ...headers,
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, headers: res.headers, body: await res.json() };
}
before(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri());
  await Promise.all([Account, AuthSession, AuthAttempt, Player, Reservation, League, AuditLog].map(m => m.init()));
  encoded = await hashPassword(password);
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  await Promise.all([Account, AuthSession, AuthAttempt, Player, Reservation, League, AuditLog].map(m => m.deleteMany({})));
  intents.clear(); providerCalls = 0;
  for (const name of ["a", "b", "org"]) {
    await Player.create({ slug: `p-${name}`, email: `${name}@example.test`, firstName: name, lastName: "Private", phone: "555-1234", ntrp: "3.5", city: "Atlanta" });
    const account = await Account.create({ email: `${name}@example.test`, playerSlug: `p-${name}`, passwordHash: encoded, role: name === "org" ? "organizer" : "player" });
    const token = crypto.randomBytes(32).toString("hex");
    await AuthSession.create({ accountId: account._id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60000) });
    cookies[name] = `__Host-atl-session=${token}`;
  }
  await League.create({ slug: "l-sec", seasonSlug: "s-sec", name: "Security test", format: "men-singles", skillLevel: "3.5", feeCents: 100, scheduleDay: "Tuesday", scheduleTime: "6 PM", venue: "Test", playerLimit: 3, spotsRemaining: 3 });
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (db) await db.stop(); });
const profile = email => ({ email, firstName: "Changed", lastName: "Name", phone: "changed", city: "Atlanta", ntrp: "3.5" });
async function reserve(who = "a") {
  const r = await request("/api/registrations", { method: "POST", who, body: { leagueId: "l-sec", playerEmail: `${who}@example.test` } });
  assert.equal(r.status, 201); return r.body.data.reservation.id;
}
test("anonymous profile reads/writes and reservation lookups require login", async () => {
  for (const path of ["/api/players/a@example.test", "/api/registrations?email=a@example.test"]) {
    const r = await request(path); assert.equal(r.status, 401); assert.equal(r.body.data, undefined);
  }
  assert.equal((await request("/api/players", { method: "POST", body: profile("a@example.test") })).status, 401);
});
test("player can read/update self but cannot read/upsert another profile", async () => {
  assert.equal((await request("/api/players/a@example.test", { who: "a" })).status, 200);
  const denied = await request("/api/players/b@example.test", { who: "a" });
  assert.equal(denied.status, 403); assert.equal(denied.body.data, undefined);
  assert.equal((await request("/api/players", { method: "POST", who: "a", body: profile("b@example.test") })).status, 403);
  assert.equal((await Player.findOne({ email: "b@example.test" })).firstName, "b");
  assert.equal((await request("/api/players", { method: "POST", who: "a", body: profile("a@example.test") })).status, 200);
});
test("registration identity comes from session; cross-player creation/list rejected", async () => {
  assert.equal((await request("/api/registrations", { method: "POST", who: "a", body: { leagueId: "l-sec", playerEmail: "b@example.test" } })).status, 403);
  await reserve();
  assert.equal((await request("/api/registrations?email=a@example.test", { who: "a" })).body.data.length, 1);
  assert.equal((await request("/api/registrations?email=a@example.test", { who: "b" })).status, 403);
});
test("all payment routes and aliases reject anonymous and cross-player requests without side effects", async () => {
  const id = await reserve(); const calls = providerCalls;
  for (const [path, method] of [[`/status/${id}`, "GET"], [`/${id}/checkout`, "POST"], [`/${id}/hosted-return`, "POST"], [`/${id}/reconcile`, "POST"], [`/reconcile/${id}`, "POST"], [`/${id}/cancel`, "POST"], [`/cancel/${id}`, "POST"]]) {
    assert.equal((await request(`/api/payments${path}`, { method })).status, 401);
    const denied = await request(`/api/payments${path}`, { method, who: "b" });
    assert.equal(denied.status, 404); assert.equal(denied.body.data, undefined);
  }
  assert.equal(providerCalls, calls);
  assert.equal((await Reservation.findById(id)).status, "payment_pending");
  assert.equal((await League.findOne({ slug: "l-sec" })).spotsRemaining, 2);
});
test("owner can resume, reconcile, poll and cancel; place is released only once", async () => {
  const id = await reserve();
  assert.equal((await request(`/api/payments/${id}/checkout`, { method: "POST", who: "a" })).status, 200);
  assert.equal((await request(`/api/payments/${id}/reconcile`, { method: "POST", who: "a" })).status, 200);
  assert.equal((await request(`/api/payments/status/${id}`, { who: "a" })).body.data.status, "payment_pending");
  for (let n = 0; n < 2; n++) assert.equal((await request(`/api/payments/${id}/cancel`, { method: "POST", who: "a" })).body.data.released, true);
  assert.equal((await League.findOne({ slug: "l-sec" })).spotsRemaining, 3);
});
test("shared admin key and forged role cannot grant organiser access", async () => {
  const body = { leagueId: "l-sec", playerEmail: "b@example.test", role: "organizer" };
  assert.equal((await request("/api/registrations/admin", { method: "POST", headers: { "x-admin-key": "obsolete-key" }, body })).status, 401);
  assert.equal((await request("/api/registrations/admin", { method: "POST", who: "a", headers: { "x-admin-key": "obsolete-key" }, body })).status, 403);
  assert.equal((await request("/api/registrations/admin", { method: "POST", who: "org", body })).status, 201);
});
test("organiser can inspect and cancel a reservation", async () => {
  const id = await reserve();
  assert.equal((await request(`/api/payments/status/${id}`, { who: "org" })).status, 200);
  assert.equal((await request(`/api/payments/${id}/cancel`, { method: "POST", who: "org" })).status, 200);
});
test("signup hashes passwords, uses secure opaque cookies, cannot claim seeded player or choose role", async () => {
  const body = { ...profile("new@example.test"), password };
  assert.equal((await request("/api/auth/signup", { method: "POST", body: { ...body, role: "organizer" } })).status, 400);
  assert.equal((await request("/api/auth/signup", { method: "POST", body: { ...body, email: "a@example.test" } })).status, 409);
  const r = await request("/api/auth/signup", { method: "POST", body });
  assert.equal(r.status, 201); assert.equal(r.body.data.role, "player");
  const cookie = r.headers.getSetCookie().find(v => v.includes("Max-Age"));
  for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) assert.ok(cookie.includes(attr));
  const account = await Account.findOne({ email: body.email }).select("+passwordHash");
  assert.match(account.passwordHash, /^scrypt\$/); assert.ok(!account.passwordHash.includes(password));
  assert.ok(!JSON.stringify(r.body).includes("passwordHash"));
  const token = cookie.split(";")[0].split("=")[1];
  assert.equal(await AuthSession.countDocuments({ tokenHash: token }), 0);
});
test("login validates password; logout revokes cookie; expired sessions fail before TTL cleanup", async () => {
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: "a@example.test", password: "wrong" } })).status, 401);
  const r = await request("/api/auth/login", { method: "POST", body: { email: "a@example.test", password } });
  assert.equal(r.status, 200);
  const cookie = r.headers.getSetCookie().find(v => v.includes("Max-Age")).split(";")[0];
  assert.equal((await request("/api/auth/me", { cookie })).status, 200);
  assert.equal((await request("/api/auth/logout", { method: "POST", cookie })).status, 200);
  assert.equal((await request("/api/auth/me", { cookie })).status, 401);
  await AuthSession.updateMany({}, { expiresAt: new Date(Date.now() - 1) });
  assert.equal((await request("/api/auth/me", { who: "a" })).status, 401);
});

test("public demo credentials cannot create an organizer account", async () => {
  const email = "organizer@baselineatl.com";
  const result = await request("/api/auth/login", {
    method: "POST", body: { email, password: "organizer123" },
  });
  assert.equal(result.status, 401);
  assert.equal(await Account.countDocuments({ email }), 0);
});
test("tampered sessions, disabled accounts and role revocation take effect immediately", async () => {
  assert.equal((await request("/api/auth/me", { cookie: "__Host-atl-session=forged" })).status, 401);
  await Account.updateOne({ email: "org@example.test" }, { role: "player" });
  assert.equal((await request("/api/registrations/admin", { method: "POST", who: "org", body: {} })).status, 403);
  await Account.updateOne({ email: "a@example.test" }, { disabled: true });
  assert.equal((await request("/api/auth/me", { who: "a" })).status, 401);
});
test("CORS rejects arbitrary origins including unrelated Vercel apps; CSRF mutations require Origin", async () => {
  for (const origin of ["https://evil.example", "https://evil.vercel.app", "null", "http://localhost:5173"]) {
    const r = await request("/api/players/a@example.test", { origin, who: "a" });
    assert.equal(r.status, 403); assert.equal(r.headers.get("access-control-allow-origin"), null);
  }
  assert.equal((await request("/api/auth/logout", { method: "POST", who: "a", origin: null })).status, 403);
  assert.equal((await request("/api/auth/me", { who: "a" })).headers.get("access-control-allow-origin"), process.env.CLIENT_URL);
  assert.equal((await request("/api/auth/me", { who: "a", origin: "https://other.example.test" })).status, 200);
});
test("webhook remains independent of user sessions and rejects unsigned events", async () => {
  assert.equal((await request("/api/payments/webhook", { method: "POST", body: {}, origin: null })).status, 400);
});
test("private responses are not cacheable and login rate limiting persists in MongoDB", async () => {
  assert.equal((await request("/api/auth/me", { who: "a" })).headers.get("cache-control"), "no-store");
  for (let i = 0; i < 10; i++) assert.equal((await request("/api/auth/login", { method: "POST", body: { email: "a@example.test", password: "wrong" } })).status, 401);
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: "a@example.test", password } })).status, 429);
});
