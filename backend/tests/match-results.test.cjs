const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.NODE_ENV = "production";
process.env.CLIENT_URL = "https://staging.example.test";
process.env.ALLOWED_ORIGINS = "https://other.example.test";
process.env.ADMIN_KEY = "obsolete-key";

const { Account, AuthSession } = require("../dist/models/Auth");
const { Player } = require("../dist/models/Player");
const { League } = require("../dist/models/League");
const { Season } = require("../dist/models/Season");
const { MatchResult } = require("../dist/models/MatchResult");
const { hashPassword } = require("../dist/lib/auth");
const { app } = require("../dist/server");

let db, server, base, encoded;
const password = "Long test password 1234!";
const cookies = {};

async function request(path, { method = "GET", who, body, origin = process.env.CLIENT_URL } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(who ? { Cookie: cookies[who] } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, headers: res.headers, body: await res.json() };
}

before(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri());
  await Promise.all([Account, AuthSession, Player, League, Season, MatchResult].map(m => m.init()));
  encoded = await hashPassword(password);
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(res => server.close(res));
  await mongoose.disconnect();
  if (db) await db.stop();
});

beforeEach(async () => {
  await Promise.all([Account, AuthSession, Player, League, Season, MatchResult].map(m => m.deleteMany({})));

  // Setup players: p1, p2, p3, p4, organizer org
  for (const name of ["p1", "p2", "p3", "p4", "org"]) {
    await Player.create({
      slug: name,
      email: `${name}@test.com`,
      firstName: name.toUpperCase(),
      lastName: "User",
      phone: "555-0100",
      ntrp: "3.5",
      city: "Atlanta",
    });
    const account = await Account.create({
      email: `${name}@test.com`,
      playerSlug: name,
      passwordHash: encoded,
      role: name === "org" ? "organizer" : "player",
    });
    const token = crypto.randomBytes(32).toString("hex");
    await AuthSession.create({
      accountId: account._id,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60000),
    });
    cookies[name] = `__Host-atl-session=${token}`;
  }

  // Setup Season One & Season Two
  await Season.create({
    slug: "season-one",
    name: "Season One",
    startDate: "2026-03-01",
    endDate: "2026-06-30",
    status: "active",
    operatingState: "active-season",
  });
  await Season.create({
    slug: "season-two",
    name: "Season Two",
    startDate: "2026-07-01",
    endDate: "2026-10-31",
    status: "active",
    operatingState: "active-season",
  });

  // Setup Singles & Doubles leagues
  await League.create({
    slug: "s1-men-singles-35",
    seasonSlug: "season-one",
    name: "Men's Singles 3.5",
    format: "men-singles",
    skillLevel: "3.5",
    feeCents: 5000,
    scheduleDay: "Saturday",
    scheduleTime: "9:00 AM",
    venue: "Bitsy Grant",
    playerLimit: 16,
    spotsRemaining: 16,
  });

  await League.create({
    slug: "s1-men-doubles-35",
    seasonSlug: "season-one",
    name: "Men's Doubles 3.5",
    format: "men-doubles",
    skillLevel: "3.5",
    feeCents: 5000,
    scheduleDay: "Sunday",
    scheduleTime: "10:00 AM",
    venue: "Bitsy Grant",
    playerLimit: 16,
    spotsRemaining: 16,
  });
});

test("Phase 10 Organizer: Unauthorized player cannot record or edit match results", async () => {
  const payload = {
    seasonSlug: "season-one",
    leagueSlug: "s1-men-singles-35",
    matchDate: "2026-04-10",
    playerASlug: "p1",
    playerBSlug: "p2",
    set1: { playerA: 6, playerB: 3 },
    set2: { playerA: 6, playerB: 4 },
    winnerSlug: "p1",
  };

  // Player p1 attempts to create
  const res = await request("/api/match-results", { method: "POST", who: "p1", body: payload });
  assert.equal(res.status, 403);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /Organizer access required/i);
});

test("Phase 10 Organizer: Authorized organizer can enter a singles result", async () => {
  const payload = {
    seasonSlug: "season-one",
    cityDivisionSlug: "buckhead-midtown",
    leagueSlug: "s1-men-singles-35",
    matchDate: "2026-04-10",
    playerASlug: "p1",
    playerBSlug: "p2",
    set1: { playerA: 6, playerB: 4 },
    set2: { playerA: 3, playerB: 6 },
    set3: { playerA: 7, playerB: 5 },
    winnerSlug: "p1",
  };

  const res = await request("/api/match-results", { method: "POST", who: "org", body: payload });
  assert.equal(res.status, 201);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.winnerSlug, "p1");
  assert.equal(res.body.data.status, "finalized");
  assert.equal(res.body.data.enteredByEmail, "org@test.com");
});

test("Phase 10 Scoring Validation: Best of 3 sets scoring rules strictly enforced", async () => {
  // Test 1: Incomplete score (only 1 set played)
  let res = await request("/api/match-results", {
    method: "POST",
    who: "org",
    body: {
      seasonSlug: "season-one",
      leagueSlug: "s1-men-singles-35",
      matchDate: "2026-04-10",
      playerASlug: "p1",
      playerBSlug: "p2",
      set1: { playerA: 6, playerB: 4 },
      set2: { playerA: 2, playerB: 4 }, // incomplete set
      winnerSlug: "p1",
    },
  });
  assert.equal(res.status, 400);

  // Test 2: Sets split 1-1, but no set 3 provided
  res = await request("/api/match-results", {
    method: "POST",
    who: "org",
    body: {
      seasonSlug: "season-one",
      leagueSlug: "s1-men-singles-35",
      matchDate: "2026-04-10",
      playerASlug: "p1",
      playerBSlug: "p2",
      set1: { playerA: 6, playerB: 2 },
      set2: { playerA: 3, playerB: 6 },
      winnerSlug: "p1",
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /third set is required/i);

  // Test 3: Straight sets (2-0) but unneeded set 3 provided
  res = await request("/api/match-results", {
    method: "POST",
    who: "org",
    body: {
      seasonSlug: "season-one",
      leagueSlug: "s1-men-singles-35",
      matchDate: "2026-04-10",
      playerASlug: "p1",
      playerBSlug: "p2",
      set1: { playerA: 6, playerB: 2 },
      set2: { playerA: 6, playerB: 3 },
      set3: { playerA: 6, playerB: 4 },
      winnerSlug: "p1",
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Set 3 should not be entered/i);

  // Test 4: Winner slug does not match set scores winner
  res = await request("/api/match-results", {
    method: "POST",
    who: "org",
    body: {
      seasonSlug: "season-one",
      leagueSlug: "s1-men-singles-35",
      matchDate: "2026-04-10",
      playerASlug: "p1",
      playerBSlug: "p2",
      set1: { playerA: 6, playerB: 2 },
      set2: { playerA: 6, playerB: 3 },
      winnerSlug: "p2", // Scores indicate p1 won
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Set scores indicate Side A won/i);
});

test("Phase 10 Integrity: Prevent duplicate match entry on same date between same players", async () => {
  const payload = {
    seasonSlug: "season-one",
    leagueSlug: "s1-men-singles-35",
    matchDate: "2026-04-15",
    playerASlug: "p1",
    playerBSlug: "p2",
    set1: { playerA: 6, playerB: 3 },
    set2: { playerA: 6, playerB: 4 },
    winnerSlug: "p1",
  };

  const res1 = await request("/api/match-results", { method: "POST", who: "org", body: payload });
  assert.equal(res1.status, 201);

  // Attempt duplicate entry
  const res2 = await request("/api/match-results", { method: "POST", who: "org", body: payload });
  assert.equal(res2.status, 409);
  assert.match(res2.body.error, /Duplicate prevented/i);
});

test("Phase 10 Player Statistics: Singles win/loss calculation and win-rate formula", async () => {
  // Check baseline 0 matches
  let statsP1 = await request("/api/match-results/stats/p1", { who: "p1" });
  assert.equal(statsP1.status, 200);
  assert.equal(statsP1.body.data.matchesPlayed, 0);
  assert.equal(statsP1.body.data.wins, 0);
  assert.equal(statsP1.body.data.losses, 0);
  assert.equal(statsP1.body.data.winRate, 0);

  // Match 1: p1 beats p2
  await request("/api/match-results", {
    method: "POST",
    who: "org",
    body: {
      seasonSlug: "season-one",
      leagueSlug: "s1-men-singles-35",
      matchDate: "2026-04-10",
      playerASlug: "p1",
      playerBSlug: "p2",
      set1: { playerA: 6, playerB: 2 },
      set2: { playerA: 6, playerB: 1 },
      winnerSlug: "p1",
    },
  });

  // Match 2: p3 beats p1
  await request("/api/match-results", {
    method: "POST",
    who: "org",
    body: {
      seasonSlug: "season-one",
      leagueSlug: "s1-men-singles-35",
      matchDate: "2026-04-12",
      playerASlug: "p1",
      playerBSlug: "p3",
      set1: { playerA: 4, playerB: 6 },
      set2: { playerA: 2, playerB: 6 },
      winnerSlug: "p3",
    },
  });

  statsP1 = await request("/api/match-results/stats/p1", { who: "p1" });
  assert.equal(statsP1.status, 200);
  assert.equal(statsP1.body.data.matchesPlayed, 2);
  assert.equal(statsP1.body.data.wins, 1);
  assert.equal(statsP1.body.data.losses, 1);
  // Win rate: (1 / 2) * 100 = 50%
  assert.equal(statsP1.body.data.winRate, 50);

  // Check p2 stats: 1 match, 0 wins, 1 loss, 0%
  const statsP2 = await request("/api/match-results/stats/p2", { who: "p2" });
  assert.equal(statsP2.body.data.matchesPlayed, 1);
  assert.equal(statsP2.body.data.wins, 0);
  assert.equal(statsP2.body.data.losses, 1);
  assert.equal(statsP2.body.data.winRate, 0);
});

test("Phase 10 Doubles: Both partners correctly receive win or loss without duplicate match count", async () => {
  // Doubles match: Team A (p1 & p2) vs Team B (p3 & p4) -> Team A wins
  const res = await request("/api/match-results", {
    method: "POST",
    who: "org",
    body: {
      seasonSlug: "season-one",
      leagueSlug: "s1-men-doubles-35",
      matchDate: "2026-04-20",
      playerASlug: "p1",
      playerAPartnerSlug: "p2",
      playerBSlug: "p3",
      playerBPartnerSlug: "p4",
      set1: { playerA: 6, playerB: 4 },
      set2: { playerA: 6, playerB: 3 },
      winnerSlug: "p1", // side A
    },
  });
  assert.equal(res.status, 201);

  // Both p1 and p2 should have 1 match played, 1 win, 0 losses, 100% winRate
  const sP1 = await request("/api/match-results/stats/p1", { who: "p1" });
  const sP2 = await request("/api/match-results/stats/p2", { who: "p2" });
  assert.equal(sP1.body.data.matchesPlayed, 1);
  assert.equal(sP1.body.data.wins, 1);
  assert.equal(sP1.body.data.losses, 0);
  assert.equal(sP1.body.data.winRate, 100);

  assert.equal(sP2.body.data.matchesPlayed, 1);
  assert.equal(sP2.body.data.wins, 1);
  assert.equal(sP2.body.data.losses, 0);
  assert.equal(sP2.body.data.winRate, 100);

  // Both p3 and p4 should have 1 match played, 0 wins, 1 loss, 0% winRate
  const sP3 = await request("/api/match-results/stats/p3", { who: "p3" });
  const sP4 = await request("/api/match-results/stats/p4", { who: "p4" });
  assert.equal(sP3.body.data.matchesPlayed, 1);
  assert.equal(sP3.body.data.wins, 0);
  assert.equal(sP3.body.data.losses, 1);
  assert.equal(sP3.body.data.winRate, 0);

  assert.equal(sP4.body.data.matchesPlayed, 1);
  assert.equal(sP4.body.data.wins, 0);
  assert.equal(sP4.body.data.losses, 1);
  assert.equal(sP4.body.data.winRate, 0);
});

test("Phase 10 Integrity & Audit: Editing a result updates stats without duplicate counting", async () => {
  // Organizer enters match: p1 beats p2
  const created = await request("/api/match-results", {
    method: "POST",
    who: "org",
    body: {
      seasonSlug: "season-one",
      leagueSlug: "s1-men-singles-35",
      matchDate: "2026-04-18",
      playerASlug: "p1",
      playerBSlug: "p2",
      set1: { playerA: 6, playerB: 3 },
      set2: { playerA: 6, playerB: 4 },
      winnerSlug: "p1",
    },
  });
  assert.equal(created.status, 201);
  const matchId = created.body.data.id || created.body.data.slug;

  // Verify initial stats: p1 has 1 win
  let sP1 = await request("/api/match-results/stats/p1", { who: "p1" });
  assert.equal(sP1.body.data.wins, 1);

  // Correction: Score was actually p2 winning (e.g. 3-6, 4-6)
  const updated = await request(`/api/match-results/${matchId}`, {
    method: "PATCH",
    who: "org",
    body: {
      set1: { playerA: 3, playerB: 6 },
      set2: { playerA: 4, playerB: 6 },
      winnerSlug: "p2",
      notes: "Corrected score entry error",
    },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.winnerSlug, "p2");
  assert.ok(updated.body.data.editHistory.length > 0);

  // Now p1 has 1 match played, 0 wins, 1 loss
  sP1 = await request("/api/match-results/stats/p1", { who: "p1" });
  assert.equal(sP1.body.data.matchesPlayed, 1);
  assert.equal(sP1.body.data.wins, 0);
  assert.equal(sP1.body.data.losses, 1);
  assert.equal(sP1.body.data.winRate, 0);

  // p2 now has 1 match played, 1 win, 0 losses
  const sP2 = await request("/api/match-results/stats/p2", { who: "p2" });
  assert.equal(sP2.body.data.matchesPlayed, 1);
  assert.equal(sP2.body.data.wins, 1);
  assert.equal(sP2.body.data.losses, 0);
  assert.equal(sP2.body.data.winRate, 100);
});

test("Phase 10 Integrity: Cancelled matches are excluded from stats", async () => {
  const created = await request("/api/match-results", {
    method: "POST",
    who: "org",
    body: {
      seasonSlug: "season-one",
      leagueSlug: "s1-men-singles-35",
      matchDate: "2026-04-22",
      playerASlug: "p1",
      playerBSlug: "p2",
      set1: { playerA: 6, playerB: 0 },
      set2: { playerA: 6, playerB: 0 },
      winnerSlug: "p1",
    },
  });
  const matchId = created.body.data.id || created.body.data.slug;

  // Cancel the match result
  const cancelled = await request(`/api/match-results/${matchId}/cancel`, {
    method: "PATCH",
    who: "org",
    body: { reason: "Weather cancellation — incomplete game" },
  });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.status, "cancelled");

  // Stats should be 0 matches played
  const sP1 = await request("/api/match-results/stats/p1", { who: "p1" });
  assert.equal(sP1.body.data.matchesPlayed, 0);
  assert.equal(sP1.body.data.wins, 0);
});

test("Phase 10 Player Statistics: Season filter returns only selected season results", async () => {
  // Add match in Season One
  await request("/api/match-results", {
    method: "POST",
    who: "org",
    body: {
      seasonSlug: "season-one",
      leagueSlug: "s1-men-singles-35",
      matchDate: "2026-04-25",
      playerASlug: "p1",
      playerBSlug: "p2",
      set1: { playerA: 6, playerB: 1 },
      set2: { playerA: 6, playerB: 2 },
      winnerSlug: "p1",
    },
  });

  // Query stats for Season One
  const s1Stats = await request("/api/match-results/stats/p1?season=season-one", { who: "p1" });
  assert.equal(s1Stats.status, 200);
  assert.equal(s1Stats.body.data.matchesPlayed, 1);
  assert.equal(s1Stats.body.data.wins, 1);

  // Query stats for Season Two (should be 0)
  const s2Stats = await request("/api/match-results/stats/p1?season=season-two", { who: "p1" });
  assert.equal(s2Stats.status, 200);
  assert.equal(s2Stats.body.data.matchesPlayed, 0);
  assert.equal(s2Stats.body.data.wins, 0);
});
