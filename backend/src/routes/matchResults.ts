/**
 * Match Result API — Organizer Only
 *
 * POST   /api/match-results            Create a new finalized match result
 * GET    /api/match-results            List results (filter by season/league/player)
 * GET    /api/match-results/stats/:playerSlug  Per-player stats aggregation
 * PATCH  /api/match-results/:id        Edit a result (organizer only, logs original)
 * PATCH  /api/match-results/:id/cancel Cancel a result (excluded from stats)
 */
import mongoose from "mongoose";
import { Router } from "express";
import { z } from "zod";
import { MatchResult } from "../models/MatchResult";
import { Player } from "../models/Player";
import { League } from "../models/League";
import { wrap, ok, err } from "../lib/apiResponse";
import { requireAuth, requireOrganizer } from "../lib/auth";
import { randomBytes } from "node:crypto";
const nanoid = (n = 10) => randomBytes(Math.ceil(n * 3 / 4)).toString("base64url").slice(0, n);

const router = Router();
router.use(requireAuth);

// ─── Validation Schemas ───────────────────────────────────────────────────────

const SetScoreZ = z.object({
  playerA: z.number().int().min(0).max(99),
  playerB: z.number().int().min(0).max(99),
});

const DOUBLES_FORMATS = ["men-doubles", "women-doubles", "mixed-doubles", "junior-doubles"];

const CreateResultBody = z.object({
  seasonSlug:          z.string().min(1),
  cityDivisionSlug:    z.string().optional(),
  leagueSlug:          z.string().min(1),
  matchDate:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "matchDate must be YYYY-MM-DD"),
  playerASlug:         z.string().min(1),
  playerAPartnerSlug:  z.string().optional(),
  playerBSlug:         z.string().min(1),
  playerBPartnerSlug:  z.string().optional(),
  set1:                SetScoreZ,
  set2:                SetScoreZ,
  set3:                SetScoreZ.optional(),
  winnerSlug:          z.string().min(1),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSetWin(scorerA: number, scorerB: number): "A" | "B" | null {
  // Standard tennis set: first to 6 winning by 2, or 7-5, or 7-6
  const winnerA = scorerA >= 6 && scorerA - scorerB >= 2;
  const tieBreakA = scorerA === 7 && (scorerB === 5 || scorerB === 6);
  const winnerB = scorerB >= 6 && scorerB - scorerA >= 2;
  const tieBreakB = scorerB === 7 && (scorerA === 5 || scorerA === 6);
  if (winnerA || tieBreakA) return "A";
  if (winnerB || tieBreakB) return "B";
  return null;
}

function validateBestOf3(
  set1: { playerA: number; playerB: number },
  set2: { playerA: number; playerB: number },
  set3: { playerA: number; playerB: number } | undefined,
  winnerSlug: string,
  playerASlug: string,
  playerBSlug: string,
  playerAPartnerSlug?: string,
  playerBPartnerSlug?: string,
): { valid: boolean; error?: string; winningSide?: "A" | "B" } {
  const w1 = isSetWin(set1.playerA, set1.playerB);
  const w2 = isSetWin(set2.playerA, set2.playerB);

  if (!w1) return { valid: false, error: `Set 1 score (${set1.playerA}-${set1.playerB}) is not a valid completed tennis set.` };
  if (!w2) return { valid: false, error: `Set 2 score (${set2.playerA}-${set2.playerB}) is not a valid completed tennis set.` };

  let winningSide: "A" | "B";

  if (w1 === w2) {
    // Same side won both sets — 2-0, no set 3
    if (set3) return { valid: false, error: `Set 3 should not be entered when one side wins sets 1 and 2 (${w1} won both).` };
    winningSide = w1;
  } else {
    // Split sets — set 3 required
    if (!set3) return { valid: false, error: "Sets are split 1-1. A third set is required to determine the winner." };
    const w3 = isSetWin(set3.playerA, set3.playerB);
    if (!w3) return { valid: false, error: `Set 3 score (${set3.playerA}-${set3.playerB}) is not a valid completed tennis set.` };
    winningSide = w3;
  }

  // Validate winnerSlug matches the winning side
  const isASide =
    winnerSlug === playerASlug || (playerAPartnerSlug && winnerSlug === playerAPartnerSlug);
  const isBSide =
    winnerSlug === playerBSlug || (playerBPartnerSlug && winnerSlug === playerBPartnerSlug);

  if (!isASide && !isBSide) {
    return { valid: false, error: "winnerSlug must be one of the participating players." };
  }
  if (winningSide === "A" && !isASide) {
    return { valid: false, error: "Set scores indicate Side A won, but winnerSlug belongs to Side B." };
  }
  if (winningSide === "B" && !isBSide) {
    return { valid: false, error: "Set scores indicate Side B won, but winnerSlug belongs to Side A." };
  }

  return { valid: true, winningSide };
}

function buildFrontend(r: InstanceType<typeof MatchResult>) {
  return {
    id:                   r._id.toString(),
    slug:                 r.slug,
    seasonSlug:           r.seasonSlug,
    cityDivisionSlug:     r.cityDivisionSlug,
    leagueSlug:           r.leagueSlug,
    leagueFormat:         r.leagueFormat,
    matchDate:            r.matchDate,
    playerASlug:          r.playerASlug,
    playerAName:          r.playerAName,
    playerAPartnerSlug:   r.playerAPartnerSlug,
    playerAPartnerName:   r.playerAPartnerName,
    playerBSlug:          r.playerBSlug,
    playerBName:          r.playerBName,
    playerBPartnerSlug:   r.playerBPartnerSlug,
    playerBPartnerName:   r.playerBPartnerName,
    set1:                 r.set1,
    set2:                 r.set2,
    set3:                 r.set3,
    winnerSlug:           r.winnerSlug,
    winningSide:          r.winningSide,
    status:               r.status,
    enteredBySlug:        r.enteredBySlug,
    enteredByEmail:       r.enteredByEmail,
    editHistory:          r.editHistory,
    createdAt:            r.createdAt,
    updatedAt:            r.updatedAt,
  };
}

// ─── POST /api/match-results ──────────────────────────────────────────────────

router.post(
  "/",
  requireOrganizer,
  wrap(async (req, res) => {
    const parsed = CreateResultBody.safeParse(req.body);
    if (!parsed.success) return err(res, "Invalid request body", 400, parsed.error.flatten());
    const d = parsed.data;

    // Resolve player names from DB
    const slugsToLookup = [d.playerASlug, d.playerBSlug];
    if (d.playerAPartnerSlug) slugsToLookup.push(d.playerAPartnerSlug);
    if (d.playerBPartnerSlug) slugsToLookup.push(d.playerBPartnerSlug);

    const foundPlayers = await Player.find({ slug: { $in: slugsToLookup } }).lean();
    const playerMap: Record<string, string> = {};
    foundPlayers.forEach((p: any) => {
      playerMap[p.slug] = `${p.firstName} ${p.lastName}`.trim();
    });

    if (!playerMap[d.playerASlug]) return err(res, `Player A not found: ${d.playerASlug}`, 404);
    if (!playerMap[d.playerBSlug]) return err(res, `Player B not found: ${d.playerBSlug}`, 404);
    if (d.playerASlug === d.playerBSlug) return err(res, "Player A and Player B cannot be the same player.", 400);

    // Resolve league format
    const league = await League.findOne({ slug: d.leagueSlug }).lean();
    if (!league) return err(res, `League not found: ${d.leagueSlug}`, 404);
    const leagueFormat = (league as any).format as string;
    const isDoubles = DOUBLES_FORMATS.includes(leagueFormat);

    // Validate doubles partner requirements
    if (isDoubles) {
      if (!d.playerAPartnerSlug) return err(res, "Doubles league requires playerAPartnerSlug.", 400);
      if (!d.playerBPartnerSlug) return err(res, "Doubles league requires playerBPartnerSlug.", 400);
      if (!playerMap[d.playerAPartnerSlug]) return err(res, `Player A partner not found: ${d.playerAPartnerSlug}`, 404);
      if (!playerMap[d.playerBPartnerSlug]) return err(res, `Player B partner not found: ${d.playerBPartnerSlug}`, 404);
    }

    // Validate scores and determine winner
    const validation = validateBestOf3(
      d.set1, d.set2, d.set3,
      d.winnerSlug,
      d.playerASlug, d.playerBSlug,
      d.playerAPartnerSlug, d.playerBPartnerSlug,
    );
    if (!validation.valid) return err(res, validation.error!, 400);

    const slug = `mr-${nanoid(10)}`;

    try {
      const result = await MatchResult.create({
        slug,
        seasonSlug:        d.seasonSlug,
        cityDivisionSlug:  d.cityDivisionSlug,
        leagueSlug:        d.leagueSlug,
        leagueFormat,
        matchDate:         d.matchDate,
        playerASlug:       d.playerASlug,
        playerAName:       playerMap[d.playerASlug],
        playerAPartnerSlug: d.playerAPartnerSlug,
        playerAPartnerName: d.playerAPartnerSlug ? playerMap[d.playerAPartnerSlug] : undefined,
        playerBSlug:       d.playerBSlug,
        playerBName:       playerMap[d.playerBSlug],
        playerBPartnerSlug: d.playerBPartnerSlug,
        playerBPartnerName: d.playerBPartnerSlug ? playerMap[d.playerBPartnerSlug] : undefined,
        set1:              d.set1,
        set2:              d.set2,
        set3:              d.set3,
        winnerSlug:        d.winnerSlug,
        winningSide:       validation.winningSide,
        status:            "finalized",
        enteredBySlug:     req.identity!.playerSlug,
        enteredByEmail:    req.identity!.email,
        originalData:      { ...d },
        editHistory:       [],
      });

      ok(res, buildFrontend(result), 201);
    } catch (e: any) {
      if (e.code === 11000) {
        return err(res, "A match result for these players in this league on this date already exists. Duplicate prevented.", 409);
      }
      throw e;
    }
  }),
);

// ─── GET /api/match-results ───────────────────────────────────────────────────

router.get(
  "/",
  wrap(async (req, res) => {
    const { season, league, player, limit: limitStr } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};

    if (season) filter.seasonSlug = season;
    if (league) filter.leagueSlug = league;
    if (player) {
      filter.$or = [
        { playerASlug: player },
        { playerBSlug: player },
        { playerAPartnerSlug: player },
        { playerBPartnerSlug: player },
      ];
    }

    // Players can only see their own results; organizers see all
    if (req.identity?.role !== "organizer") {
      const mySlug = req.identity?.playerSlug;
      if (!mySlug) return err(res, "Not authenticated", 401);
      filter.$or = [
        { playerASlug: mySlug },
        { playerBSlug: mySlug },
        { playerAPartnerSlug: mySlug },
        { playerBPartnerSlug: mySlug },
      ];
    }

    const limit = Math.min(parseInt(limitStr ?? "100", 10), 500);
    const results = await MatchResult.find(filter).sort({ matchDate: -1 }).limit(limit).lean();
    ok(res, results.map((r: any) => buildFrontend(r as any)));
  }),
);

// ─── GET /api/match-results/stats/:playerSlug ─────────────────────────────────

router.get(
  "/stats/:playerSlug",
  wrap(async (req, res) => {
    const { playerSlug } = req.params;
    const { season, league } = req.query as Record<string, string>;

    // Authorisation: players can only see their own stats
    if (req.identity?.role !== "organizer" && req.identity?.playerSlug !== playerSlug) {
      return err(res, "Access denied", 403);
    }

    const filter: Record<string, unknown> = {
      status: "finalized",
      $or: [
        { playerASlug: playerSlug },
        { playerBSlug: playerSlug },
        { playerAPartnerSlug: playerSlug },
        { playerBPartnerSlug: playerSlug },
      ],
    };
    if (season) filter.seasonSlug = season;
    if (league) filter.leagueSlug = league;

    const results = await MatchResult.find(filter).lean();

    let matchesPlayed = 0;
    let wins = 0;
    let losses = 0;

    for (const r of results as any[]) {
      // Determine if this player is on the winning side
      const isASide =
        r.playerASlug === playerSlug || r.playerAPartnerSlug === playerSlug;
      const isBSide =
        r.playerBSlug === playerSlug || r.playerBPartnerSlug === playerSlug;

      if (!isASide && !isBSide) continue; // shouldn't happen with our filter

      matchesPlayed += 1;

      const playerWon =
        (isASide && r.winningSide === "A") ||
        (isBSide && r.winningSide === "B");

      if (playerWon) wins += 1;
      else losses += 1;
    }

    const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;

    ok(res, { matchesPlayed, wins, losses, winRate });
  }),
);

// ─── PATCH /api/match-results/:id ─────────────────────────────────────────────

router.patch(
  "/:id",
  requireOrganizer,
  wrap(async (req, res) => {
    const isId = mongoose.isValidObjectId(req.params.id);
    const existing = isId
      ? await MatchResult.findById(req.params.id)
      : await MatchResult.findOne({ slug: req.params.id });
    if (!existing) return err(res, "Match result not found", 404);
    if (existing.status === "cancelled") return err(res, "Cannot edit a cancelled result.", 400);

    const parsed = CreateResultBody.partial().safeParse(req.body);
    if (!parsed.success) return err(res, "Invalid request body", 400, parsed.error.flatten());
    const d = parsed.data;

    // Resolve new player slugs if changing them
    const slugsToLookup: string[] = [];
    if (d.playerASlug) slugsToLookup.push(d.playerASlug);
    if (d.playerBSlug) slugsToLookup.push(d.playerBSlug);
    if (d.playerAPartnerSlug) slugsToLookup.push(d.playerAPartnerSlug);
    if (d.playerBPartnerSlug) slugsToLookup.push(d.playerBPartnerSlug);

    const foundPlayers = slugsToLookup.length > 0
      ? await Player.find({ slug: { $in: slugsToLookup } }).lean()
      : [];
    const playerMap: Record<string, string> = {};
    (foundPlayers as any[]).forEach((p) => {
      playerMap[p.slug] = `${p.firstName} ${p.lastName}`.trim();
    });

    // Merge fields
    const newPlayerASlug = d.playerASlug ?? existing.playerASlug;
    const newPlayerBSlug = d.playerBSlug ?? existing.playerBSlug;
    const newPlayerAPartnerSlug = d.playerAPartnerSlug ?? existing.playerAPartnerSlug;
    const newPlayerBPartnerSlug = d.playerBPartnerSlug ?? existing.playerBPartnerSlug;
    const newSet1 = d.set1 ?? existing.set1;
    const newSet2 = d.set2 ?? existing.set2;
    const newSet3 = d.set3 ?? existing.set3;
    const newWinnerSlug = d.winnerSlug ?? existing.winnerSlug;

    const validation = validateBestOf3(
      newSet1, newSet2, newSet3,
      newWinnerSlug,
      newPlayerASlug, newPlayerBSlug,
      newPlayerAPartnerSlug, newPlayerBPartnerSlug,
    );
    if (!validation.valid) return err(res, validation.error!, 400);

    // Snapshot previous state for audit trail
    const previousSnapshot = {
      matchDate:         existing.matchDate,
      playerASlug:       existing.playerASlug,
      playerBSlug:       existing.playerBSlug,
      playerAPartnerSlug: existing.playerAPartnerSlug,
      playerBPartnerSlug: existing.playerBPartnerSlug,
      set1:              existing.set1,
      set2:              existing.set2,
      set3:              existing.set3,
      winnerSlug:        existing.winnerSlug,
      winningSide:       existing.winningSide,
    };

    existing.editHistory.push({
      editedAt:      new Date(),
      editedBySlug:  req.identity!.playerSlug,
      editedByEmail: req.identity!.email,
      previous:      previousSnapshot,
    });

    if (d.matchDate) existing.matchDate = d.matchDate;
    if (d.seasonSlug) existing.seasonSlug = d.seasonSlug;
    if (d.cityDivisionSlug !== undefined) existing.cityDivisionSlug = d.cityDivisionSlug;
    if (d.leagueSlug) existing.leagueSlug = d.leagueSlug;

    existing.playerASlug = newPlayerASlug;
    if (playerMap[newPlayerASlug]) existing.playerAName = playerMap[newPlayerASlug];
    existing.playerAPartnerSlug = newPlayerAPartnerSlug;
    if (newPlayerAPartnerSlug && playerMap[newPlayerAPartnerSlug]) existing.playerAPartnerName = playerMap[newPlayerAPartnerSlug];

    existing.playerBSlug = newPlayerBSlug;
    if (playerMap[newPlayerBSlug]) existing.playerBName = playerMap[newPlayerBSlug];
    existing.playerBPartnerSlug = newPlayerBPartnerSlug;
    if (newPlayerBPartnerSlug && playerMap[newPlayerBPartnerSlug]) existing.playerBPartnerName = playerMap[newPlayerBPartnerSlug];

    existing.set1 = newSet1 as any;
    existing.set2 = newSet2 as any;
    existing.set3 = newSet3 as any;
    existing.winnerSlug = newWinnerSlug;
    existing.winningSide = validation.winningSide!;

    await existing.save();
    ok(res, buildFrontend(existing));
  }),
);

// ─── PATCH /api/match-results/:id/cancel ─────────────────────────────────────

router.patch(
  "/:id/cancel",
  requireOrganizer,
  wrap(async (req, res) => {
    const isId = mongoose.isValidObjectId(req.params.id);
    const existing = isId
      ? await MatchResult.findById(req.params.id)
      : await MatchResult.findOne({ slug: req.params.id });
    if (!existing) return err(res, "Match result not found", 404);
    if (existing.status === "cancelled") return err(res, "Already cancelled.", 400);

    existing.editHistory.push({
      editedAt:      new Date(),
      editedBySlug:  req.identity!.playerSlug,
      editedByEmail: req.identity!.email,
      previous:      { status: "finalized" },
    });
    existing.status = "cancelled";
    await existing.save();

    ok(res, buildFrontend(existing));
  }),
);

export default router;
