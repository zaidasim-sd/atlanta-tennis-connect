/**
 * Seed script – safe to run repeatedly.
 * Each run wipes atlanta-tennis collections and rebuilds from scratch.
 *
 * Usage:
 *   npm run seed           # normal seed
 *   npm run seed:reset     # same thing (alias)
 *
 * Produces:
 *   - 3 seasons
 *   - 5 leagues (one deliberately seeded with only 3 spots remaining)
 *   - Exactly 500 player records (populated with real Atlanta ZIPs, NTRP rating, bios)
 *   - Exactly 120 tournament-history records:
 *       • 50 Champions
 *       • 50 Finalists
 *       • 20 Semifinalists
 *   - Pre-existing registrations filling most leagues to ~60-80% capacity
 */

import "dotenv/config";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"]);

import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { Season } from "../src/models/Season";
import { League } from "../src/models/League";
import { Player } from "../src/models/Player";
import { Reservation } from "../src/models/Reservation";
import { AuditLog } from "../src/models/AuditLog";
import { TournamentHistory } from "../src/models/TournamentHistory";

// ─── Static seed data (matches frontend SEED_LEAGUES / SEED_SEASONS) ─────────

export const SEASONS = [
  {
    slug: "s-fall-26",
    name: "Fall 2026",
    startDate: "2026-10-06",
    endDate: "2026-12-19",
    status: "active" as const,
  },
  {
    slug: "s-winter-27",
    name: "Winter 2027",
    startDate: "2026-11-16",
    endDate: "2027-02-12",
    status: "upcoming" as const,
  },
  {
    slug: "s-spring-27",
    name: "Spring 2027",
    startDate: "2027-01-12",
    endDate: "2027-03-23",
    status: "upcoming" as const,
  },
];

export const LEAGUES = [
  {
    slug: "l-s1-buckhead-wd35", seasonSlug: "s-fall-26", name: "Buckhead Women Doubles", format: "women-doubles" as const, skillLevel: "3.5" as const, feeCents: 4000,
    scheduleDay: "Tuesday", scheduleTime: "6:30 PM", venue: "Bitsy Grant Tennis Center", playerLimit: 24, spotsRemaining: 24, registrationOpen: true,
    description: "Season One women doubles division in Buckhead.", startDate: "2026-11-10", endDate: "2026-12-19",
  },
  {
    slug: "l-s1-decatur-js30", seasonSlug: "s-fall-26", name: "Decatur Junior Singles", format: "junior-singles" as const, skillLevel: "3.0" as const, feeCents: 2500,
    scheduleDay: "Saturday", scheduleTime: "10:00 AM", venue: "McKoy Park Courts", playerLimit: 20, spotsRemaining: 20, registrationOpen: true,
    description: "Season One junior singles division in Decatur.", startDate: "2026-11-14", endDate: "2026-12-19",
  },
  {
    slug: "l-s1-alpharetta-jd30", seasonSlug: "s-fall-26", name: "Alpharetta Junior Doubles", format: "junior-doubles" as const, skillLevel: "3.0" as const, feeCents: 3000,
    scheduleDay: "Sunday", scheduleTime: "2:00 PM", venue: "Webb Bridge Park Courts", playerLimit: 20, spotsRemaining: 20, registrationOpen: true,
    description: "Season One junior doubles division in Alpharetta.", startDate: "2026-11-15", endDate: "2026-12-20",
  },
  {
    slug: "l-2",
    seasonSlug: "s-fall-26",
    name: "Thursday Mixed Doubles",
    format: "mixed-doubles" as const,
    skillLevel: "4.0" as const,
    feeCents: 4500,
    scheduleDay: "Thursday",
    scheduleTime: "7:00 PM",
    venue: "Bitsy Grant Tennis Center",
    playerLimit: 32,
    spotsRemaining: 32,
    registrationOpen: true,
    description:
      "Fast, social and genuinely competitive mixed doubles. Bring a partner or get matched by the organizers during week one.",
    startDate: "2026-10-15",
    endDate: "2026-12-17",
  },
  {
    slug: "l-3",
    seasonSlug: "s-fall-26",
    name: "Saturday Singles",
    format: "women-singles" as const,
    skillLevel: "3.0" as const,
    feeCents: 2500,
    scheduleDay: "Saturday",
    scheduleTime: "9:00 AM",
    venue: "McKoy Park Courts",
    playerLimit: 20,
    spotsRemaining: 20,
    registrationOpen: true,
    description:
      "A supportive Saturday-morning ladder for players building match experience with coach-supervised play.",
    startDate: "2026-10-24",
    endDate: "2026-12-19",
  },
  {
    slug: "l-4",
    seasonSlug: "s-winter-27",
    name: "Monday Singles",
    format: "men-singles" as const,
    skillLevel: "5.0" as const,
    feeCents: 5000,
    scheduleDay: "Monday",
    scheduleTime: "8:00 PM",
    venue: "Sandy Springs Tennis Center",
    playerLimit: 16,
    spotsRemaining: 16,
    registrationOpen: true,
    description:
      "Our most competitive flight. Sixteen players, guaranteed indoor courts all winter, and a single-elimination championship night.",
    startDate: "2026-11-16",
    endDate: "2027-01-25",
  },
  {
    // *** THE RACE-CONDITION LEAGUE ***
    // Seeded with only 3 spots left – load test hammers this one
    slug: "l-hot",
    seasonSlug: "s-fall-26",
    name: "Peachtree Last-Spots Singles",
    format: "men-singles" as const,
    skillLevel: "4.0" as const,
    feeCents: 4000,
    scheduleDay: "Wednesday",
    scheduleTime: "7:00 PM",
    venue: "Chastain Park Tennis Center",
    playerLimit: 30,
    spotsRemaining: 3, // ← deliberately scarce – race condition target
    registrationOpen: true,
    description:
      "Championship-level 4.0 singles. Only a handful of spots remain – register before they're gone.",
    startDate: "2026-10-20",
    endDate: "2027-01-07",
  },
];

// ─── Player generation ────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Jordan","Maya","Chris","Tasha","Andre","Riley","Morgan","Alex","Casey","Jamie",
  "Taylor","Sam","Quinn","Avery","Blake","Drew","Emery","Finley","Hayden","Jesse",
  "Kendall","Logan","Micah","Noel","Parker","Reese","Sage","Skyler","Toby","Val",
  "Wren","Xander","Yara","Zane","Aria","Brynn","Cole","Dana","Ellis","Faye",
  "Glen","Hana","Ivan","June","Kira","Luca","Mika","Nash","Ora","Pax",
];

const LAST_NAMES = [
  "Ellis","Robinson","Nguyen","Bell","Cole","Mitchell","Harris","Clark","Lewis","Walker",
  "Hall","Allen","Young","King","Wright","Scott","Green","Baker","Adams","Nelson",
  "Carter","Perez","Turner","Phillips","Campbell","Parker","Evans","Edwards","Collins","Stewart",
  "Sanchez","Morris","Rogers","Reed","Cook","Morgan","Bell","Murphy","Bailey","Rivera",
  "Cooper","Richardson","Cox","Howard","Ward","Torres","Peterson","Gray","Ramirez","James",
];

const NTRP_LEVELS = ["2.5","3.0","3.5","4.0","4.5","5.0"] as const;
import { APPROVED_ATLANTA_ZIPS } from "../src/lib/constants";
const ATLANTA_ZIPS = APPROVED_ATLANTA_ZIPS;
const CITIES = ["Atlanta","Decatur","Smyrna","Marietta","Sandy Springs","Buckhead","Alpharetta","Dunwoody","Roswell","Tucker"];
const PREFERRED_SIDES = ["deuce", "ad", "both"] as const;

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generatePlayers(count: number) {
  const players = [];

  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last  = LAST_NAMES[i % LAST_NAMES.length];
    const ntrp  = NTRP_LEVELS[i % NTRP_LEVELS.length];
    const baseRating = parseFloat(ntrp);
    const rating = Math.round((baseRating + (Math.random() * 0.4 - 0.2)) * 100) / 100;

    // Deterministic email: player0000@loadtest.atl … player0499@loadtest.atl
    const email = `player${String(i).padStart(4, "0")}@loadtest.atl`;
    const zipCode = ATLANTA_ZIPS[i % ATLANTA_ZIPS.length];

    players.push({
      slug:          `p-seed-${i.toString().padStart(4, "0")}`,
      firstName:     first,
      lastName:      last,
      email,
      phone:         `(404) 555-${String(1000 + (i % 9000))}`,
      ntrp,
      city:          CITIES[i % CITIES.length],
      zipCode,
      rating,
      profileBio:    `${ntrp} rated competitor playing out of ${CITIES[i % CITIES.length]}, GA. Active in Atlanta metro leagues since 2024.`,
      preferredSide: PREFERRED_SIDES[i % PREFERRED_SIDES.length],
    });
  }
  return players;
}

// ─── Tournament History generation ──────────────────────────────────────────

const TOURNAMENTS = [
  { name: "Atlanta Metro Spring Championship", season: "s-spring-25" },
  { name: "Piedmont Park Summer Open", season: "s-summer-25" },
  { name: "Chastain Park Fall Classic", season: "s-fall-25" },
  { name: "Bitsy Grant Clay Invitational", season: "s-spring-26" },
  { name: "Georgia State Indoor Cup", season: "s-winter-26" },
  { name: "Atlanta City Tennis Masters", season: "s-fall-24" },
];

export function generateTournamentHistory(players: ReturnType<typeof generatePlayers>) {
  const history: {
    playerSlug: string;
    playerEmail: string;
    playerName: string;
    tournamentName: string;
    seasonSlug: string;
    division: string;
    skillLevel: string;
    year: number;
    finish: "champion" | "finalist" | "semifinalist" | "quarterfinalist";
    trophyAwarded: boolean;
    notes?: string;
  }[] = [];

  // Generate 50 Champions (distributed among players 0 to 49)
  for (let i = 0; i < 50; i++) {
    const p = players[i];
    const t = TOURNAMENTS[i % TOURNAMENTS.length];
    const year = 2024 + (i % 3); // 2024, 2025, 2026
    history.push({
      playerSlug: p.slug,
      playerEmail: p.email,
      playerName: `${p.firstName} ${p.lastName}`,
      tournamentName: t.name,
      seasonSlug: t.season,
      division: `${p.ntrp} Singles`,
      skillLevel: p.ntrp,
      year,
      finish: "champion",
      trophyAwarded: true,
      notes: `Won final match in 3 sets at ${t.name} (${year})`,
    });
  }

  // Generate 50 Finalists (distributed among players 50 to 99)
  for (let i = 0; i < 50; i++) {
    const p = players[50 + i];
    const t = TOURNAMENTS[(i + 2) % TOURNAMENTS.length];
    const year = 2024 + (i % 3);
    history.push({
      playerSlug: p.slug,
      playerEmail: p.email,
      playerName: `${p.firstName} ${p.lastName}`,
      tournamentName: t.name,
      seasonSlug: t.season,
      division: `${p.ntrp} Singles`,
      skillLevel: p.ntrp,
      year,
      finish: "finalist",
      trophyAwarded: true,
      notes: `Runner-up finalist in ${t.name} (${year})`,
    });
  }

  // Generate 20 Semifinalists (players 100 to 119) -> Total = 120 history records
  for (let i = 0; i < 20; i++) {
    const p = players[100 + i];
    const t = TOURNAMENTS[(i + 4) % TOURNAMENTS.length];
    const year = 2025;
    history.push({
      playerSlug: p.slug,
      playerEmail: p.email,
      playerName: `${p.firstName} ${p.lastName}`,
      tournamentName: t.name,
      seasonSlug: t.season,
      division: `${p.ntrp} Singles`,
      skillLevel: p.ntrp,
      year,
      finish: "semifinalist",
      trophyAwarded: false,
      notes: `Reached semifinals at ${t.name} (2025)`,
    });
  }

  return history;
}

// ─── Pre-seed registrations (fills leagues to ~70 % capacity) ─────────────────

function buildRegistrations(
  players: ReturnType<typeof generatePlayers>,
  leagues: typeof LEAGUES,
) {
  const registrations: {
    leagueSlug: string;
    playerSlug: string;
    playerEmail: string;
    status: "registered";
    amountCents: number;
    paymentProvider: "mock";
    idempotencyKey: string;
    heldAt: Date;
    expiresAt: Date;
    paidAt: Date;
  }[] = [];

  const used = new Map<string, Set<string>>(); // leagueSlug → Set<playerSlug>

  for (const league of leagues) {
    // l-hot stays at exactly 3 – don't pre-fill it
    if (league.slug === "l-hot") continue;

    const target = Math.floor(league.playerLimit * 0.70);
    used.set(league.slug, new Set());

    let filled = 0;
    // Use players from index 200..450 to leave 0..199 and 460..499 free
    const candidatePool = players.slice(200, 450);

    for (const player of candidatePool) {
      if (filled >= target) break;
      if (used.get(league.slug)!.has(player.slug)) continue;

      used.get(league.slug)!.add(player.slug);
      const now = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);

      registrations.push({
        leagueSlug:      league.slug,
        playerSlug:      player.slug,
        playerEmail:     player.email,
        status:          "registered",
        amountCents:     league.feeCents,
        paymentProvider: "mock",
        idempotencyKey:  `seed_${league.slug}_${player.slug}`,
        heldAt:          now,
        expiresAt:       new Date(now.getTime() + 15 * 60 * 1000),
        paidAt:          now,
      });
      filled++;
    }

    // Update spotsRemaining to reflect pre-seeded registrations
    league.spotsRemaining = league.playerLimit - filled;
  }

  return registrations;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runSeed(): Promise<{
  playersCount: number;
  seasonsCount: number;
  leaguesCount: number;
  tournamentHistoryCount: number;
  championsCount: number;
  finalistsCount: number;
  registrationsCount: number;
}> {
  console.log("🎾 Atlanta Tennis seed starting…");
  await connectDB();

  // Wipe only atlanta-tennis collections – never touches other databases
  console.log("  Dropping existing data…");
  await Promise.all([
    Season.deleteMany({}),
    League.deleteMany({}),
    Player.deleteMany({}),
    Reservation.deleteMany({}),
    AuditLog.deleteMany({}),
    TournamentHistory.deleteMany({}),
  ]);

  // Seasons
  console.log("  Seeding seasons…");
  await Season.insertMany(SEASONS);

  // Players (500)
  console.log("  Generating 500 players…");
  const players = generatePlayers(500);
  await Player.insertMany(players);

  // Tournament History (120 records: 50 Champions, 50 Finalists, 20 Semifinalists)
  console.log("  Generating tournament history records…");
  const history = generateTournamentHistory(players);
  await TournamentHistory.insertMany(history);

  // Pre-existing registrations
  const registrations = buildRegistrations(players, LEAGUES);

  // Apply spotsRemaining back to league objects before inserting
  await League.insertMany(LEAGUES);

  // Update spotsRemaining in DB for pre-filled leagues
  await Promise.all(
    LEAGUES.map((l) =>
      League.updateOne({ slug: l.slug }, { $set: { spotsRemaining: l.spotsRemaining } }),
    ),
  );

  // Insert reservation docs for pre-existing registrations
  if (registrations.length > 0) {
    await Reservation.insertMany(registrations);
  }

  const pCount = await Player.countDocuments();
  const sCount = await Season.countDocuments();
  const lCount = await League.countDocuments();
  const thCount = await TournamentHistory.countDocuments();
  const champCount = await TournamentHistory.countDocuments({ finish: "champion" });
  const finCount = await TournamentHistory.countDocuments({ finish: "finalist" });
  const regCount = await Reservation.countDocuments();

  // Summary
  const leagueSummary = LEAGUES.map(
    (l) => `    ${l.slug.padEnd(8)} "${l.name}" → ${l.spotsRemaining}/${l.playerLimit} spots remaining`,
  ).join("\n");

  console.log(`\n✅ Seed complete & verified:`);
  console.log(`   Players:            ${pCount} (required: 500)`);
  console.log(`   Seasons:            ${sCount}`);
  console.log(`   Leagues:            ${lCount}`);
  console.log(`   Tournament History: ${thCount} (required: >= 110)`);
  console.log(`   Champions:          ${champCount} (required: 50)`);
  console.log(`   Finalists:          ${finCount} (required: 50)`);
  console.log(`   Registrations:      ${regCount} (pre-seeded)`);
  console.log(`\n   League capacity:\n${leagueSummary}`);
  console.log(`\n   ⚠️  l-hot has 3 spots remaining – use this for race-condition tests`);

  return {
    playersCount: pCount,
    seasonsCount: sCount,
    leaguesCount: lCount,
    tournamentHistoryCount: thCount,
    championsCount: champCount,
    finalistsCount: finCount,
    registrationsCount: regCount,
  };
}

if (require.main === module) {
  runSeed()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((e) => {
      console.error("Seed failed:", e);
      process.exit(1);
    });
}
