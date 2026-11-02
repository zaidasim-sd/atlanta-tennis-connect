import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  RotateCw,
  SearchX,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  CalendarDays,
  Clock,
  Trophy,
  MapPin,
  Sparkles,
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
  { value: "Decatur", label: "Decatur" },
  { value: "Johns Creek", label: "Johns Creek" },
  { value: "Smyrna", label: "Smyrna" },
  { value: "Roswell", label: "Roswell" },
];

function BrowseLeagues() {
  const { leagues, seasons, spotsLeft, hydrated, user, players } = useStore();
  const navigate = useNavigate();

  const [status, setStatus] = React.useState<Status>("loading");
  const [attempt, setAttempt] = React.useState(0);
  const [failNext, setFailNext] = React.useState(false);

  // Available seasons retrieved dynamically from backend
  const availableSeasons = React.useMemo(() => {
    const list = seasons.filter(
      (s) => s.status === "active" || s.id === "s-fall-26" || s.name === "Season One",
    );
    if (list.length > 0) return list;
    return [
      {
        id: "s-fall-26",
        name: "Season One",
        status: "active" as const,
        startDate: "2026-10-10",
        endDate: "2026-12-19",
        operatingState: "active-season" as const,
      },
    ];
  }, [seasons]);

  // Selected season state - Season One is the only currently available season and selected by default
  const [selectedSeason, setSelectedSeason] = React.useState<string>("s-fall-26");

  // Keep selectedSeason aligned if available seasons update, but preserve "all" and "other"
  React.useEffect(() => {
    if (selectedSeason === "all" || selectedSeason === "other") return;
    const firstSeason = availableSeasons[0];
    if (firstSeason && !availableSeasons.some((s) => s.id === selectedSeason)) {
      setSelectedSeason(firstSeason.id);
    }
  }, [availableSeasons, selectedSeason]);

  // Active selected season object
  const currentSeason =
    availableSeasons.find((s) => s.id === selectedSeason) ||
    seasons.find((s) => s.id === selectedSeason) ||
    availableSeasons[0] || {
      id: "s-fall-26",
      name: "Season One",
      status: "active" as const,
      startDate: "2026-10-10",
      endDate: "2026-12-19",
      operatingState: "active-season" as const,
    };

  // Detect current player profile if authenticated
  const currentPlayer =
    user?.role === "player"
      ? players.find(
        (p) =>
          p.id === user.playerId ||
          p.email.toLowerCase() === user.email.toLowerCase(),
      )
      : null;

  const playerRating = currentPlayer?.ntrp || null;

  // Filter states - All Skill Levels by default so all Season One leagues are displayed
  const [format, setFormat] = React.useState<"all" | LeagueFormat>("all");
  const [skill, setSkill] = React.useState<"all" | SkillLevel>("all");
  const [city, setCity] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");

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

  // Filtered league results
  const results = React.useMemo(() => {
    return leagues.filter((l) => {
      // 1. Season filter
      if (selectedSeason === "all") {
        // Show all leagues across all seasons
      } else if (selectedSeason === "other") {
        // Show all leagues other than Season One
        if (l.seasonId === "s-fall-26" || l.seasonId === "Season One") {
          return false;
        }
      } else {
        // Exact season match (defaults to Season One)
        if (l.seasonId !== selectedSeason) {
          return false;
        }
      }
      // 2. Format filter
      if (format !== "all" && l.format !== format) {
        return false;
      }
      // 3. Skill Level filter
      if (skill !== "all") {
        const matchesSkill =
          l.skillLevel === skill ||
          (l.offeredSkillLevels && l.offeredSkillLevels.includes(skill));
        if (!matchesSkill) return false;
      }
      // 4. City / Area filter
      if (city !== "all") {
        const cLower = city.toLowerCase();
        const leagueArea = (l.area || l.geographicGroup || "").toLowerCase();
        const matchesGroup = leagueArea === cLower || leagueArea.includes(cLower);
        const matchesVenue = l.venue?.toLowerCase().includes(cLower);
        const matchesName = l.name?.toLowerCase().includes(cLower);
        if (!matchesGroup && !matchesVenue && !matchesName) return false;
      }
      // 5. Text search query
      if (query.trim()) {
        const q = query.toLowerCase();
        const season = seasons.find((s) => s.id === l.seasonId);
        const formatLabel = FORMAT_LABELS[l.format]?.toLowerCase() || "";
        const matchesSearch =
          l.name.toLowerCase().includes(q) ||
          l.venue.toLowerCase().includes(q) ||
          (l.geographicGroup || "").toLowerCase().includes(q) ||
          (l.area || "").toLowerCase().includes(q) ||
          formatLabel.includes(q) ||
          (season?.name.toLowerCase().includes(q) ?? false);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [leagues, seasons, selectedSeason, format, skill, city, query]);

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
      {/* 1. Existing Browse Leagues heading and hero section */}
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
              Explore official leagues across Atlanta by season, league type, skill rating, and city division.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 space-y-6">
        {/* 2. Prominent Season Selection Dropdown & Controls */}
        <Reveal className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <label
                htmlFor="season-select"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
              >
                <Trophy className="size-4 text-primary" /> Select Season
              </label>
              <p className="text-sm text-foreground font-medium">
                Choose a competition season to view eligible divisions and register.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                size="sm"
                variant={selectedSeason === "other" ? "default" : "outline"}
                onClick={() => setSelectedSeason("other")}
                className={`rounded-xl h-11 text-xs font-bold px-3.5 transition-all ${selectedSeason === "other"
                    ? "shadow-sm"
                    : "border-border text-foreground hover:bg-muted"
                  }`}
              >
                All other than Season One
              </Button>
              <div className="w-full sm:w-64">
                <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                  <SelectTrigger
                    id="season-select"
                    aria-label="Select Season"
                    className="h-11 rounded-xl bg-background text-sm font-bold border-primary/30 shadow-xs focus:ring-primary"
                  >
                    <SelectValue placeholder="Select Season" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem
                      value="s-fall-26"
                      className="text-sm font-semibold py-2.5 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-primary inline-block" />
                        Season One
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider ml-1">
                          Current
                        </span>
                      </span>
                    </SelectItem>
                    <SelectItem
                      value="all"
                      className="text-sm font-semibold py-2.5 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-accent inline-block" />
                        All Seasons (All Leagues)
                      </span>
                    </SelectItem>
                    <SelectItem
                      value="other"
                      className="text-sm font-semibold py-2.5 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-sky-500 inline-block" />
                        All Other than Season One
                      </span>
                    </SelectItem>
                    {availableSeasons
                      .filter((s) => s.id !== "s-fall-26")
                      .map((s) => (
                        <SelectItem
                          key={s.id}
                          value={s.id}
                          className="text-sm font-semibold py-2.5 cursor-pointer"
                        >
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Quick toggle chips */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Quick Select:</span>
            <button
              type="button"
              onClick={() => setSelectedSeason("s-fall-26")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${selectedSeason === "s-fall-26"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
            >
              ● Season One (Default)
            </button>
            <button
              type="button"
              onClick={() => setSelectedSeason("all")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${selectedSeason === "all"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
            >
              All Leagues
            </button>
            <button
              type="button"
              onClick={() => setSelectedSeason("other")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${selectedSeason === "other"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
            >
              All Other than Season One
            </button>
          </div>
        </Reveal>

        {/* 3. Season Status and Registration Availability Banner */}
        {(() => {
          if (selectedSeason === "all") {
            return (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                    <Trophy className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-foreground">
                        All Atlanta Seasons · Full Catalog
                      </h2>
                      <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                        All Seasons
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Displaying all 25 active, upcoming, and standby leagues across Atlanta.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          if (selectedSeason === "other") {
            return (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-700 dark:text-sky-300">
                    <Clock className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-foreground">
                        Other Seasons · Non-Season One Leagues
                      </h2>
                      <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-200 uppercase tracking-wider">
                        Other Seasons
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Displaying leagues outside of Season One (e.g. Winter 2027 and future seasons).
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          const operatingState = currentSeason?.operatingState || "active-season";
          const isStandby = operatingState === "standby";
          const isOffSeason = operatingState === "off-season";

          if (isStandby) {
            return (
              <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-4 sm:p-5">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    <Clock className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-foreground">
                        {currentSeason?.name || "Season One"} · Season Standby
                      </h2>
                      <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                        Standby Mode
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      League schedules and city division rosters are currently being organized. Browse upcoming leagues below; registration opens shortly.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          if (isOffSeason) {
            return (
              <div className="rounded-2xl border border-slate-400/40 bg-slate-500/10 p-4 sm:p-5">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-500/20 text-slate-700 dark:text-slate-300">
                    <Clock className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-foreground">
                        {currentSeason?.name || "Season One"} · Off-Season
                      </h2>
                      <span className="rounded-full bg-slate-500/20 px-2.5 py-0.5 text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Off-Season
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Matches and city playoffs are underway. New registration holds are locked until the upcoming season opens.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  <CalendarDays className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-foreground">
                      {currentSeason?.name || "Season One"} · Registration Open
                    </h2>
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                      Active Season
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Live registrations active across all Atlanta city divisions and skill levels. Roster spots held in real-time.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 4. Search and Dropdown Filters */}
        <Reveal className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by league name, venue, city, or keywords..."
              aria-label="Search leagues"
              className="h-11 rounded-full pl-10 bg-background text-sm"
            />
          </div>

          {/* 3 Dropdown Filters: Category, City, Skill */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Category / League Type Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="size-3 text-primary" /> League Type / Category
              </label>
              <Select value={format} onValueChange={(val) => setFormat(val as any)}>
                <SelectTrigger className="h-11 rounded-xl bg-background text-xs sm:text-sm font-semibold">
                  <SelectValue placeholder="All League Types" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs sm:text-sm font-semibold">
                    All Categories
                  </SelectItem>
                  {(Object.keys(FORMAT_LABELS) as LeagueFormat[]).map((f) => (
                    <SelectItem key={f} value={f} className="text-xs sm:text-sm font-medium">
                      {FORMAT_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Metro Area / City Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="size-3 text-primary" /> Metro Area / City
              </label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="h-11 rounded-xl bg-background text-xs sm:text-sm font-semibold">
                  <SelectValue placeholder="All Metro Atlanta" />
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

            {/* Skill Level Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Skill Level</span>
                {playerRating && (
                  <span className="text-[10px] font-normal text-muted-foreground">
                    Your Rating: NTRP {playerRating}
                  </span>
                )}
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
                      NTRP {s} {playerRating === s ? "· (Your Rating)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick filter shortcut for authenticated players */}
          {playerRating && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
              <div className="inline-flex items-center gap-1.5">
                <span>
                  Logged in as player with verified rating: <strong>NTRP {playerRating}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {skill !== playerRating ? (
                  <button
                    type="button"
                    onClick={() => setSkill(playerRating as SkillLevel)}
                    className="text-primary hover:underline font-semibold"
                  >
                    Filter to my NTRP {playerRating} leagues
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSkill("all")}
                    className="text-primary hover:underline font-semibold"
                  >
                    Show all skill levels
                  </button>
                )}
                {(city !== "all" || format !== "all" || skill !== "all" || query.trim() !== "") && (
                  <>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCity("all");
                        setFormat("all");
                        setSkill("all");
                        setQuery("");
                      }}
                      className="text-muted-foreground hover:text-foreground font-medium"
                    >
                      Reset all filters
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </Reveal>

        {/* Results Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
            {status === "ready"
              ? format === "all" && skill === "all" && city === "all" && !query.trim()
                ? `All ${results.length} ${currentSeason?.name || "Season One"} leagues available across Atlanta`
                : `${results.length} league${results.length === 1 ? "" : "s"} found${format !== "all" ? ` for ${FORMAT_LABELS[format as LeagueFormat]}` : ""
                }${skill !== "all" ? ` (NTRP ${skill})` : ""}${city !== "all" ? ` in ${city}` : ""}${query.trim() ? ` matching "${query.trim()}"` : ""
                }`
              : "Loading leagues…"}
          </p>
        </div>

        {/* 8. Actual League Cards returned by the backend */}
        {status === "loading" && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <LeagueCardSkeleton key={i} />
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
            <AlertTriangle className="mx-auto size-8 text-destructive" />
            <h2 className="mt-4 text-xl font-bold">We couldn't load the leagues</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              The connection dropped before we finished loading. Your filters are still saved — try again.
            </p>
            <Button className="mt-6" onClick={() => setAttempt((a) => a + 1)}>
              <RotateCw className="mr-2 size-4" /> Retry
            </Button>
          </div>
        )}

        {status === "ready" && results.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-6 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">
              No leagues found for this combination
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
                  setQuery("");
                }}
              >
                View all Atlanta leagues
              </Button>
            </div>
          </div>
        )}

        {status === "ready" && results.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((league, i) => (
              <Reveal key={league.id} delay={Math.min(i, 5) * 40} className="h-full">
                <LeagueCard
                  league={league}
                  season={seasons.find((s) => s.id === league.seasonId) || currentSeason}
                  spotsLeft={spotsLeft(league.id)}
                />
              </Reveal>
            ))}
          </div>
        )}

        <p className="pt-4 text-sm text-muted-foreground">
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
