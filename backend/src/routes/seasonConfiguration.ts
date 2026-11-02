/**
 * Season One configuration APIs. These persist category, city division, and
 * manual playoff preference data. They deliberately do not produce standings
 * or playoff brackets.
 */
import { Router } from "express";
import { z } from "zod";
import { Season } from "../models/Season";
import { SeasonCategory } from "../models/SeasonCategory";
import { CityDivision } from "../models/CityDivision";
import { PlayoffOptIn } from "../models/PlayoffOptIn";
import { OrganizationProfile } from "../models/OrganizationProfile";
import { requireAuth, requireOrganizer } from "../lib/auth";
import { err, ok, wrap } from "../lib/apiResponse";

const router = Router();
const operatingState = z.enum(["active-season", "off-season", "standby"]);
const categoryBody = z.object({
  code: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(100),
  format: z.string().trim().min(2).max(60),
  audience: z.enum(["adult", "junior"]),
  partnerRequired: z.boolean().default(false),
  enabled: z.boolean().default(true),
}).strict();
const divisionBody = z.object({
  slug: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(120),
  categoryCode: z.string().trim().min(2).max(60),
  skillLevel: z.string().trim().max(10).optional(),
  status: z.enum(["open", "standby", "closed"]).default("standby"),
  leagueSlugs: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
}).strict();
const optInBody = z.object({
  seasonSlug: z.string().trim().min(2).max(100),
  divisionSlug: z.string().trim().min(2).max(100),
  optedIn: z.boolean(),
  note: z.string().trim().max(1000).optional(),
}).strict();

const seasonOneCategories = [
  { code: "men-singles", name: "Men's Singles", audience: "adult", partnerRequired: false },
  { code: "women-singles", name: "Women's Singles", audience: "adult", partnerRequired: false },
  { code: "men-doubles", name: "Men's Doubles", audience: "adult", partnerRequired: true },
  { code: "women-doubles", name: "Women's Doubles", audience: "adult", partnerRequired: true },
  { code: "mixed-doubles", name: "Mixed Doubles", audience: "adult", partnerRequired: true },
  { code: "junior-singles", name: "Junior Singles", audience: "junior", partnerRequired: false },
  { code: "junior-doubles", name: "Junior Doubles", audience: "junior", partnerRequired: true },
  { code: "senior-singles", name: "Senior Singles", audience: "adult", partnerRequired: false },
  { code: "senior-doubles", name: "Senior Doubles", audience: "adult", partnerRequired: true },
];

// Read-only app page data. This makes the Season One implementation visible
// without exposing organizer-only configuration mutations.
router.get("/season-one", wrap(async (_req, res) => {
  const organization = await OrganizationProfile.findOneAndUpdate(
    { key: "baseline-atl" },
    { $setOnInsert: { legalEntityName: "Hyper Nexus Group LLC", operatorName: "Mr Saad Moudood" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  ok(res, {
    organization,
    operatingStates: ["active-season", "off-season", "standby"],
    categories: seasonOneCategories,
    cityDivisionFields: ["season", "city", "category", "skill level", "linked leagues", "manual placement"],
    playoffOptInFields: ["player", "season", "city division", "opt in or opt out", "captured by", "date", "note"],
    automation: { standings: "manual", playoffBrackets: "manual" },
  });
}));

router.get("/organization", wrap(async (_req, res) => {
  const organization = await OrganizationProfile.findOneAndUpdate(
    { key: "baseline-atl" },
    { $setOnInsert: { legalEntityName: "Hyper Nexus Group LLC", operatorName: "Mr Saad Moudood" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  ok(res, organization);
}));

router.get("/seasons", wrap(async (_req, res) => {
  const seasons = await Season.find({}).sort({ startDate: 1 }).lean();
  ok(res, seasons.map(s => ({
    id: s.slug,
    name: s.name,
    startDate: s.startDate,
    endDate: s.endDate,
    status: s.status,
    operatingState: s.operatingState || (s.status === "active" ? "active-season" : "standby"),
  })));
}));

router.get("/city-divisions", wrap(async (req, res) => {
  const seasonSlug = (req.query.seasonSlug as string) || "s-fall-26";
  const divisions = await CityDivision.find({ seasonSlug }).sort({ city: 1, name: 1 }).lean();
  ok(res, divisions);
}));

router.get("/seasons/:seasonSlug/configuration", requireAuth, wrap(async (req, res) => {
  const seasonSlug = req.params.seasonSlug;
  const [season, categories, divisions] = await Promise.all([
    Season.findOne({ slug: seasonSlug }).lean(),
    SeasonCategory.find({ seasonSlug }).sort({ name: 1 }).lean(),
    CityDivision.find({ seasonSlug }).sort({ city: 1, name: 1 }).lean(),
  ]);
  if (!season) return err(res, "Season not found", 404);
  ok(res, { season, categories, divisions, standingsAutomation: "manual", playoffBracketAutomation: "manual" });
}));

router.patch("/seasons/:seasonSlug/operating-state", requireAuth, requireOrganizer, wrap(async (req, res) => {
  const parsed = z.object({ operatingState }).strict().safeParse(req.body);
  if (!parsed.success) return err(res, "Invalid season operating state", 400);
  const season = await Season.findOneAndUpdate(
    { slug: req.params.seasonSlug },
    { $set: { operatingState: parsed.data.operatingState } },
    { new: true, runValidators: true },
  );
  if (!season) return err(res, "Season not found", 404);
  ok(res, season);
}));

router.put("/seasons/:seasonSlug/categories/:code", requireAuth, requireOrganizer, wrap(async (req, res) => {
  const parsed = categoryBody.safeParse({ ...req.body, code: req.params.code });
  if (!parsed.success) return err(res, "Invalid category", 400);
  const category = await SeasonCategory.findOneAndUpdate(
    { seasonSlug: req.params.seasonSlug, code: parsed.data.code },
    { $set: { ...parsed.data, seasonSlug: req.params.seasonSlug } },
    { upsert: true, new: true, runValidators: true },
  );
  ok(res, category);
}));

router.put("/seasons/:seasonSlug/city-divisions/:divisionSlug", requireAuth, requireOrganizer, wrap(async (req, res) => {
  const parsed = divisionBody.safeParse({ ...req.body, slug: req.params.divisionSlug });
  if (!parsed.success) return err(res, "Invalid city division", 400);
  const division = await CityDivision.findOneAndUpdate(
    { slug: parsed.data.slug },
    { $set: { ...parsed.data, seasonSlug: req.params.seasonSlug, manualPlacementOnly: true } },
    { upsert: true, new: true, runValidators: true },
  );
  ok(res, division);
}));

router.put("/playoff-opt-ins", requireAuth, wrap(async (req, res) => {
  const parsed = optInBody.safeParse(req.body);
  if (!parsed.success) return err(res, "Invalid playoff preference", 400);
  const division = await CityDivision.findOne({ slug: parsed.data.divisionSlug, seasonSlug: parsed.data.seasonSlug }).lean();
  if (!division) return err(res, "City division not found", 404);
  const isOrganizer = req.identity!.role === "organizer";
  const optIn = await PlayoffOptIn.findOneAndUpdate(
    { seasonSlug: parsed.data.seasonSlug, divisionSlug: parsed.data.divisionSlug, playerSlug: req.identity!.playerSlug },
    {
      $set: {
        ...parsed.data,
        playerSlug: req.identity!.playerSlug,
        playerEmail: req.identity!.email,
        capturedBy: isOrganizer ? "organizer" : "player",
        declaredAt: new Date(),
      },
    },
    { upsert: true, new: true, runValidators: true },
  );
  ok(res, optIn);
}));

router.get("/playoff-opt-ins/:seasonSlug", requireAuth, wrap(async (req, res) => {
  const filter = req.identity!.role === "organizer"
    ? { seasonSlug: req.params.seasonSlug }
    : { seasonSlug: req.params.seasonSlug, playerSlug: req.identity!.playerSlug };
  ok(res, await PlayoffOptIn.find(filter).sort({ declaredAt: -1 }).lean());
}));

export default router;
