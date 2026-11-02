const test = require("node:test");
const assert = require("node:assert/strict");

const { Season } = require("../dist/models/Season");
const { SeasonCategory } = require("../dist/models/SeasonCategory");
const { CityDivision } = require("../dist/models/CityDivision");
const { PlayoffOptIn } = require("../dist/models/PlayoffOptIn");
const { Reservation } = require("../dist/models/Reservation");

test("Season configuration models retain manual V1 boundaries", () => {
  const season = new Season({
    slug: "s-season-one", name: "Season One", startDate: "2026-01-01", endDate: "2026-03-31", status: "active",
  });
  assert.equal(season.operatingState, "standby");
  season.operatingState = "active-season";
  assert.equal(season.validateSync(), undefined);

  const category = new SeasonCategory({
    seasonSlug: season.slug, code: "women-doubles", name: "Women's Doubles", format: "women-doubles", audience: "adult", partnerRequired: true,
  });
  assert.equal(category.validateSync(), undefined);

  const division = new CityDivision({
    slug: "d-atlanta-wd35", seasonSlug: season.slug, city: "Atlanta", name: "Atlanta Women's Doubles 3.5", categoryCode: category.code,
  });
  assert.equal(division.manualPlacementOnly, true);
  assert.equal(division.validateSync(), undefined);

  const preference = new PlayoffOptIn({
    seasonSlug: season.slug, divisionSlug: division.slug, playerSlug: "p-player", playerEmail: "player@example.test", optedIn: true, capturedBy: "player",
  });
  assert.equal(preference.validateSync(), undefined);
});

test("new reservations snapshot the approved merchant identity", () => {
  const reservation = new Reservation({
    leagueSlug: "l-one", playerSlug: "p-one", playerEmail: "player@example.test", amountCents: 4000,
    paymentProvider: "mock", idempotencyKey: "test-key", expiresAt: new Date(Date.now() + 60_000),
  });
  assert.equal(reservation.legalEntityName, "Hyper Nexus Group LLC");
  assert.equal(reservation.merchantOperatorName, "Mr Saad Moudood");
  assert.equal(reservation.validateSync(), undefined);
});
