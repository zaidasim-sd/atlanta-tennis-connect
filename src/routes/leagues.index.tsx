import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  RotateCw,
  SearchX,
  Search,
  SlidersHorizontal,
  Lock,
  LogIn,
  UserPlus,
  ShieldCheck,
  MapPin,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Reveal } from "@/components/reveal";
import { LeagueCard, LeagueCardSkeleton } from "@/components/league-card";
import { useStore } from "@/lib/store";
import { FORMAT_LABELS, SKILL_LEVELS, type LeagueFormat, type SkillLevel } from "@/lib/tennis";

export const Route = createFileRoute("/leagues/")({
  head: () => ({
    meta: [
      { title: "Browse Tennis Leagues in Atlanta — Baseline ATL" },
      {
        name: "description",
        content:
          "Filter Atlanta tennis leagues by format, NTRP skill level and season. See fees, venues and open spots, then register online.",
      },
      { property: "og:title", content: "Browse Tennis Leagues in Atlanta" },
      { property: "og:description", content: "Filter by format, skill level and season. Fees, venues and open spots." },
    ],
  }),
  component: BrowseLeagues,
});

type Status = "loading" | "error" | "ready";

const CITY_OPTIONS = [
  { value: "all", label: "All Metro Atlanta" },
  { value: "Midtown", label: "Midtown" },
  { value: "Buckhead", label: "Buckhead" },
  { value: "Cumming", label: "Cumming" },
  { value: "Sandy Springs", label: "Sandy Springs" },
  { value: "Alpharetta", label: "Alpharetta" },
  { value: "Marietta", label: "Marietta" },
];

function cleanSeasonTitle(name: string) {
  return name.replace(/\s*(Metro|Indoor|Premier)?\s*Season/i, "").trim();
}

function BrowseLeagues() {
  const { leagues, seasons, spotsLeft, hydrated, user, players } = useStore();
  const navigate = useNavigate();

  const [status, setStatus] = React.useState<Status>("loading");
  const [attempt, setAttempt] = React.useState(0);
  const [failNext, setFailNext] = React.useState(false);

  // Detect current player profile if authenticated
  const currentPlayer =
    user?.role === "player"
      ? players.find(
        (p) =>
          p.id === user.playerId ||
          p.email.toLowerCase() === user.email.toLowerCase(),
      )
      : null;

  // If player is logged in, their skill level is strictly fixed to their profile NTRP
  const playerSkill: SkillLevel | null =
    currentPlayer?.ntrp && SKILL_LEVELS.includes(currentPlayer.ntrp)
      ? currentPlayer.ntrp
      : user?.role === "player"
        ? "3.0"
        : null;

  // Modern dropdown filter states - skill level is locked to player profile when logged in
  const [format, setFormat] = React.useState<"all" | LeagueFormat>("all");
  const [skill, setSkill] = React.useState<"all" | SkillLevel>(playerSkill || "all");
  const [city, setCity] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");

  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(6);
  const [sort, setSort] = React.useState("soonest");
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  React.useEffect(() => { setVisibleCount(6); }, [format, skill, city, query, sort]);
  React.useEffect(() => { if (!isMobile) setFiltersOpen(false); }, [isMobile]);

  // Keep skill state strictly synced with player profile
  React.useEffect(() => {
    if (playerSkill) {
      setSkill(playerSkill);
    }
  }, [playerSkill]);

  // Update status immediately on hydrated / retry
  React.useEffect(() => {
    if (!hydrated) {
      setStatus("loading");
      return;
    }
    setStatus(failNext ? "error" : "ready");
    setFailNext(false);
  }, [attempt, hydrated, failNext]);

  React.useEffect(() => {
    if (hydrated && user?.role === "organizer") {
      navigate({ to: "/organizer", replace: true });
    }
  }, [hydrated, user, navigate]);

  const results = React.useMemo(() => {
    return leagues.filter((l) => {
      // 1. Format filter
      if (format !== "all" && l.format !== format) return false;
      // 2. Skill Level filter (matches exact or offeredSkillLevels)
      const effectiveSkill = playerSkill || skill;
      if (effectiveSkill !== "all") {
        const matchesSkill =
          l.skillLevel === effectiveSkill ||
          (l.offeredSkillLevels && l.offeredSkillLevels.includes(effectiveSkill as SkillLevel));
        if (!matchesSkill) return false;
      }
      // 3. City / Area filter
      if (city !== "all") {
        const cLower = city.toLowerCase();
        const leagueArea = (l.area || l.geographicGroup || "").toLowerCase();
        const matchesGroup = leagueArea === cLower || leagueArea.includes(cLower);
        const matchesVenue = l.venue?.toLowerCase().includes(cLower);
        const matchesName = l.name?.toLowerCase().includes(cLower);
        if (!matchesGroup && !matchesVenue && !matchesName) return false;
      }
      // 4. Text search query
      if (query.trim()) {
        const q = query.toLowerCase();
        const season = seasons.find((s) => s.id === l.seasonId);
        if (
          !l.name.toLowerCase().includes(q) &&
          !l.venue.toLowerCase().includes(q) &&
          !(season?.name.toLowerCase().includes(q) ?? false)
        )
          return false;
      }
      return true;
    });
  }, [leagues, seasons, format, skill, playerSkill, city, query]);

  const filterControls = (
    <>
{/* 3 Professional Dropdowns */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* League Type Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="size-3 text-primary" /> League Type
              </label>
              <Select value={format} onValueChange={(val) => setFormat(val as any)}>
                <SelectTrigger className="h-11 rounded-xl bg-background text-xs sm:text-sm font-semibold">
                  <SelectValue placeholder="All League Types" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs sm:text-sm font-semibold">
                    All League Types
                  </SelectItem>
                  {(Object.keys(FORMAT_LABELS) as LeagueFormat[]).map((f) => (
                    <SelectItem key={f} value={f} className="text-xs sm:text-sm font-medium">
                      {FORMAT_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Skill Level - Fixed for logged-in players, dropdown otherwise */}
            {playerSkill ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="size-3 text-primary" /> Skill Level
                  </span>
                  {/* <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    Fixed
                  </span> */}
                </label>
                <div
                  className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-muted/40 px-3.5 py-2 text-xs sm:text-sm font-semibold text-foreground cursor-default select-none shadow-xs"
                  title={`Skill level is fixed to your verified NTRP ${playerSkill} player profile.`}
                >
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary inline-block" />
                    NTRP {playerSkill}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Player Profile
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  Skill Level
                </label>
                <Select value={skill} onValueChange={(val) => setSkill(val as any)}>
                  <SelectTrigger className="h-11 rounded-xl bg-background text-xs sm:text-sm font-semibold">
                    <SelectValue placeholder="All Skill Levels" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-xs sm:text-sm font-semibold">
                      All Skill Levels
                    </SelectItem>
                    {SKILL_LEVELS.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs sm:text-sm font-medium">
                        NTRP {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* City / Area Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Metro Area
              </label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="h-11 rounded-xl bg-background text-xs sm:text-sm font-semibold">
                  <SelectValue placeholder="Select metro area" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {CITY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-xs sm:text-sm font-medium">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
    </>
  );

  const activeFilterCount = Number(format !== "all") + Number(city !== "all") + Number((playerSkill || skill) !== "all");
  const sortedResults = React.useMemo(() => {
    if (!isMobile) return results;
    return [...results].sort((a, b) => {
      if (sort === "price") return a.feeCents - b.feeCents;
      if (sort === "skill") return Number.parseFloat(a.skillLevel) - Number.parseFloat(b.skillLevel);
      const startTime = (league: typeof a) => {
        const date = league.startDate || seasons.find((season) => season.id === league.seasonId)?.startDate;
        const time = date ? Date.parse(date) : NaN;
        return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
      };
      return startTime(a) - startTime(b);
    });
  }, [results, isMobile, sort, seasons]);
  const visibleResults = isMobile ? sortedResults.slice(0, visibleCount) : sortedResults;

  if (hydrated && user?.role === "organizer") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground">Organizer Access Only</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            As an organizer, you are restricted from player league views. Manage all leagues, rosters, and scores in the Organizer Hub.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild>
              <Link to="/organizer">Go to Organizer Hub</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <section className="group relative overflow-hidden bg-black border-b border-border py-16 text-white sm:py-24">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1657534927924-a6fc6573a93e?q=80&w=1200&auto=format&fit=crop"
            alt="Tennis match"
            className="h-full w-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-1000 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="eyebrow text-accent drop-shadow-md">Metro Atlanta Leagues</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-5xl drop-shadow-lg">Browse Leagues</h1>
            <p className="mt-3 max-w-xl text-white/90 drop-shadow-md text-sm sm:text-base">
              Explore official leagues across Atlanta by league type, skill rating, season, and metro area.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Modern Dropdown Filters */}
        <Reveal className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by league name, venue, or keywords..."
              aria-label="Search leagues"
              className="h-11 rounded-full pl-10 bg-background text-sm"
            />
          </div>

          <div className="hidden sm:block">{filterControls}</div>
          <div className="flex items-center gap-3 sm:hidden">
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-11 shrink-0">
                  <SlidersHorizontal className="size-4" /> Filters
                  {activeFilterCount > 0 && <span className="rounded-full bg-secondary px-2 text-primary">{activeFilterCount}</span>}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <SheetHeader className="mb-6 text-left">
                  <SheetTitle>Filter leagues</SheetTitle>
                  <SheetDescription>Choose a league type, skill level and metro area.</SheetDescription>
                </SheetHeader>
                {filterControls}
                <div className="mt-6 flex gap-3">
                  <Button variant="outline" onClick={() => {
                    setFormat("all"); setCity("all"); setSkill(playerSkill || "all");
                  }}>Reset</Button>
                  <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                    Show {results.length} {results.length === 1 ? "league" : "leagues"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-foreground">
              Sort
              <select aria-label="Sort leagues" value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-2 text-sm">
                <option value="soonest">Soonest</option>
                <option value="price">Price: low to high</option>
                <option value="skill">Skill level</option>
              </select>
            </label>
          </div>

          {/* Player profile indicator */}
          {currentPlayer && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
              <div className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" />
                <span>
                  Showing leagues for your skill level: <strong>NTRP {playerSkill || currentPlayer.ntrp}</strong> (Fixed)
                </span>
              </div>
              {(city !== "all" || format !== "all" || (!playerSkill && skill !== "all")) && (
                <button
                  type="button"
                  onClick={() => {
                    setCity("all");
                    setFormat("all");
                    if (!playerSkill) setSkill("all");
                  }}
                  className="text-primary hover:underline font-semibold"
                >
                  View all Atlanta leagues
                </button>
              )}
            </div>
          )}
        </Reveal>


        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
            {status === "ready"
              ? format === "all" && skill === "all" && city === "all"
                ? `All ${results.length} leagues available across Atlanta`
                : `${results.length} league${results.length === 1 ? "" : "s"} found${format !== "all" ? ` for ${FORMAT_LABELS[format as LeagueFormat]}` : ""
                }${skill !== "all" ? ` (NTRP ${skill})` : ""}${city !== "all" ? ` in ${city}` : ""}`
              : "Loading leagues…"}
          </p>
        </div>

        {/* States */}
        {status === "loading" && (
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <LeagueCardSkeleton key={i} />
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
            <AlertTriangle className="mx-auto size-8 text-destructive" />
            <h2 className="mt-4 text-xl font-bold">We couldn't load the leagues</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              The connection dropped before we finished loading. Your filters are still saved — try again.
            </p>
            <Button className="mt-6" onClick={() => setAttempt((a) => a + 1)}>
              <RotateCw /> Retry
            </Button>
          </div>
        )}

        {status === "ready" && results.length === 0 && (
          <div className="mt-5 rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-6 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">
              No leagues found for this specific combination
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              There are currently no leagues matching this specific combination. Try broadening your filters to view more leagues.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setFormat("all");
                  setSkill("all");
                  setCity("all");
                }}
              >
                View all Atlanta leagues
              </Button>
            </div>
          </div>
        )}

        {status === "ready" && results.length > 0 && (
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleResults.map((league, i) => (
              <Reveal key={league.id} delay={Math.min(i, 5) * 50} className="h-full">
                <LeagueCard
                  league={league}
                  season={seasons.find((s) => s.id === league.seasonId)}
                  spotsLeft={spotsLeft(league.id)}
                />
              </Reveal>
            ))}
          </div>
        )}

        {status === "ready" && isMobile && results.length > 0 && (
          <div className="mt-6 flex flex-col items-center gap-3 sm:hidden">
            <p className="text-xs text-muted-foreground" aria-live="polite">Showing {visibleResults.length} of {results.length} leagues</p>
            {visibleResults.length < results.length && (
              <Button variant="outline" className="h-11 w-full" onClick={() => setVisibleCount((count) => count + 6)}>Load more</Button>
            )}
          </div>
        )}

        <p className="mt-10 text-sm text-muted-foreground">
          Organizing a league instead?{" "}
          <Link to="/organizer" className="font-semibold text-primary underline underline-offset-4">
            Open the organizer hub
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
