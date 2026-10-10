/**
 * GET /api/leagues
 *   Returns all leagues with spotsRemaining.
 *   Query params (all optional):
 *     format      – LeagueFormat
 *     skillLevel  – SkillLevel
 *     open        – "true" | "false"  (filter by registrationOpen)
 *     season      – season slug
 *
 * GET /api/leagues/:leagueId
 *   Returns a single league with its season.
 */
import { Router } from "express";
import { League } from "../models/League";
import { Season } from "../models/Season";
import { broadcastCapacityChange } from "../lib/events";
import { wrap, ok, err } from "../lib/apiResponse";
import { requireAuth, requireOrganizer } from "../lib/auth";

const router = Router();

// ─── Shape that matches what the frontend League type expects ───────────────

function leagueToFrontend(l: InstanceType<typeof League>) {
  const spotsRemaining = l.spotsRemaining;
  const playerLimit = l.playerLimit;
  const registeredCount = Math.max(0, playerLimit - spotsRemaining);

  return {
    id: l.slug,
    seasonId: l.seasonSlug,
    name: l.name,
    format: l.format,
    skillLevel: l.skillLevel,
    offeredSkillLevels: (l as any).offeredSkillLevels || [l.skillLevel],
    area: (l as any).area || "Midtown",
    geographicGroup: (l as any).area || (l as any).geographicGroup || "Midtown",
    feeCents: l.feeCents,
    scheduleDay: l.scheduleDay,
    scheduleTime: l.scheduleTime,
    venue: l.venue,
    playerLimit,
    spotsRemaining,
    registeredCount,
    registrationOpen: l.registrationDeadline ? l.spotsRemaining > 0 && new Date(l.registrationDeadline).getTime() > Date.now() : l.registrationOpen && l.spotsRemaining > 0,
    registrationDeadline: l.registrationDeadline,
    description: l.description,
    startDate: l.startDate,
    endDate: l.endDate,
  };
}

// POST /api/leagues
router.post(
  "/",
  requireAuth,
  requireOrganizer,
  wrap(async (req, res) => {
    const slug = req.body.id || `l-${Math.random().toString(36).slice(2, 9)}`;
    
    // Map seasonId to seasonSlug as that is what the model expects
    const seasonSlug = req.body.seasonId || req.body.seasonSlug || "s-fall-26";

    const newLeague = new League({
      slug,
      seasonSlug,
      name: req.body.name,
      format: req.body.format,
      skillLevel: req.body.skillLevel,
      feeCents: req.body.feeCents,
      scheduleDay: req.body.scheduleDay,
      scheduleTime: req.body.scheduleTime,
      venue: req.body.venue,
      playerLimit: req.body.playerLimit,
      spotsRemaining: req.body.playerLimit,
      registrationOpen: req.body.registrationOpen !== undefined ? req.body.registrationOpen : true,
      description: req.body.description || "",
      startDate: req.body.startDate,
      endDate: req.body.endDate,
    });

    await newLeague.save();
    
    ok(res, leagueToFrontend(newLeague), 201);
  })
);

// GET /api/leagues
router.get(
  "/",
  wrap(async (req, res) => {
    const { format, skillLevel, open, season } = req.query as Record<string, string>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (format)     filter.format = format;
    if (skillLevel) filter.skillLevel = skillLevel;
    if (season)     filter.seasonSlug = season;

    const leagues = await League.find(filter).sort({ createdAt: 1 }).lean();

    // Enrich with season name
    const seasonSlugs = [...new Set(leagues.map((l) => l.seasonSlug))];
    const seasons = await Season.find({ slug: { $in: seasonSlugs } }).lean();
    const seasonMap = Object.fromEntries(seasons.map((s) => [s.slug, s]));

    const payload = leagues.map((l) => ({
      ...leagueToFrontend(l as unknown as InstanceType<typeof League>),
      season: seasonMap[l.seasonSlug]
        ? {
            id: seasonMap[l.seasonSlug].slug,
            name: seasonMap[l.seasonSlug].name,
            startDate: seasonMap[l.seasonSlug].startDate,
            endDate: seasonMap[l.seasonSlug].endDate,
            status: seasonMap[l.seasonSlug].status,
          }
        : null,
    }));

    ok(res, open === undefined ? payload : payload.filter(l => l.registrationOpen === (open === "true")));
  }),
);

// GET /api/leagues/:leagueId
router.get(
  "/:leagueId",
  wrap(async (req, res) => {
    const league = await League.findOne({ slug: req.params.leagueId }).lean();
    if (!league) return err(res, "League not found", 404);

    const season = await Season.findOne({ slug: league.seasonSlug }).lean();

    ok(res, {
      ...leagueToFrontend(league as unknown as InstanceType<typeof League>),
      season: season
        ? {
            id: season.slug,
            name: season.name,
            startDate: season.startDate,
            endDate: season.endDate,
            status: season.status,
          }
        : null,
    });
  }),
);

// PATCH /api/leagues/:leagueId
router.patch(
  "/:leagueId",
  wrap(async (req, res) => {
    const { registrationOpen, spotsRemaining } = req.body;
    const update: Record<string, unknown> = {};
    if (typeof registrationOpen === "boolean") update.registrationOpen = registrationOpen;
    if (typeof spotsRemaining === "number") update.spotsRemaining = spotsRemaining;

    const league = await League.findOneAndUpdate(
      { slug: req.params.leagueId },
      { $set: update },
      { new: true },
    );
    if (!league) return err(res, "League not found", 404);

    broadcastCapacityChange({
      type: "league.updated",
      leagueSlug: league.slug,
      spotsRemaining: league.spotsRemaining,
    });

    ok(res, leagueToFrontend(league));
  }),
);

export default router;
