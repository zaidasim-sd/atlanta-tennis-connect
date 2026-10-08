import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useStore, getApiUrl } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDateRange,
  formatMoney,
  type LeagueFormat,
  type SkillLevel,
  SKILL_LEVELS,
  FORMAT_LABELS,
  ATLANTA_VENUES,
  type League,
} from "@/lib/tennis";
import {
  Lock,
  Unlock,
  Plus,
  Users,
  Search,
  SlidersHorizontal,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Calendar,
  MapPin,
  Trophy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BallLoader } from "@/components/tennis-ball";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PlayoffBracket } from "@/components/playoff-bracket";

function cleanLeagueName(name: string): string {
  if (!name) return "";
  return name
    .replace(/^(Midtown|Buckhead|Decatur|Cumming|Sandy Springs|Alpharetta|Dunwoody|Roswell|Brookhaven|Smyrna|Marietta|Atlanta|Intown|Downtown)\s+/i, "")
    .trim();
}

function cleanVenue(venue: string): string {
  if (!venue) return "";
  return venue
    .replace(/,\s*(Midtown|Buckhead|Decatur|Cumming|Sandy Springs|Alpharetta|Dunwoody|Roswell|Brookhaven|Smyrna|Marietta|Atlanta|Intown|Downtown)\b/gi, "")
    .trim();
}

export const Route = createFileRoute("/organizer")({
  component: OrganizerHub,
});

function OrganizerHub() {
  const {
    hydrated,
    user,
    leagues,
    seasons,
    registrations,
    toggleRegistration,
    createLeague,
    matches,
    results,
    confirmMatchResult,
    disputeMatchResult,
    submitMatchScore,
    players,
  } = useStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"leagues" | "scores" | "geography" | "bracket" | "create">("leagues");
  const [directScoreMatchId, setDirectScoreMatchId] = useState<string | null>(null);
  const [directScoreText, setDirectScoreText] = useState("6-4, 6-3");
  const [directWinnerId, setDirectWinnerId] = useState("");

  const [leagueFiltersOpen, setLeagueFiltersOpen] = useState(false);
  const [leagueQuery, setLeagueQuery] = useState("");
  const [leagueStatus, setLeagueStatus] = useState("active");
  const [leagueSeason, setLeagueSeason] = useState("all");
  const [leagueType, setLeagueType] = useState("all");
  const [leagueSort, setLeagueSort] = useState("status");

  // League Roster / Participant modal state
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [allRegistrations, setAllRegistrations] = useState<any[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "held">("all");
  const [copiedEmails, setCopiedEmails] = useState(false);

  // Create League form state
  const [name, setName] = useState("");
  const [seasonId, setSeasonId] = useState(seasons[0]?.id || "");
  const [format, setFormat] = useState<LeagueFormat>("men-singles");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("3.5");
  const [feeUsd, setFeeUsd] = useState(100);
  const [scheduleDay, setScheduleDay] = useState("Tuesday");
  const [scheduleTime, setScheduleTime] = useState("7:00 PM");
  const [venue, setVenue] = useState("");
  const [playerLimit, setPlayerLimit] = useState(24);
  const [description, setDescription] = useState("");
  const [totalPlayersCount, setTotalPlayersCount] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      navigate({ to: "/login", search: { leagueId: undefined } });
      return;
    }
    if (user.role !== "organizer") {
      toast.error("Access denied. You do not have organizer privileges.");
      navigate({ to: "/dashboard" });
      return;
    }
      // Fetch live registrations for all leagues and distinct player count
      const fetchLiveRegistrations = () => {
        fetch(getApiUrl("/api/registrations"), { credentials: "include" })
          .then(async (res) => {
            const json = await res.json();
            if (res.ok && json.ok && Array.isArray(json.data)) {
              setAllRegistrations(json.data);
            }
          })
          .catch((e) => console.warn("Failed to fetch organizer registrations:", e))
          .finally(() => setLoadingRegistrations(false));
      };

      const fetchPlayerCount = () => {
        fetch(getApiUrl("/api/players/count"), { credentials: "include" })
          .then(async (res) => {
            const json = await res.json();
            if (res.ok && json.ok && typeof json.data?.count === "number") {
              setTotalPlayersCount(json.data.count);
            }
          })
          .catch(() => {});
      };

      setLoadingRegistrations(true);
      fetchLiveRegistrations();
      fetchPlayerCount();

      const interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchLiveRegistrations();
          fetchPlayerCount();
        }
      }, 10000);

      return () => clearInterval(interval);
  }, [hydrated, user, navigate]);

  // Combine live registrations with local store (live API allRegistrations takes precedence)
  const effectiveRegistrations = useMemo(() => {
    const list: any[] = [...allRegistrations];
    const seen = new Set<string>();
    list.forEach((r) => {
      seen.add(`${r.leagueId}:${r.email?.toLowerCase() || r.playerId}`);
      if (r.id) seen.add(r.id);
    });

    registrations.forEach((r) => {
      const p = players.find((player) => player.id === r.playerId);
      const email = (p?.email || "").toLowerCase();
      const key = `${r.leagueId}:${email || r.playerId}`;
      if (!seen.has(key) && !seen.has(r.id)) {
        seen.add(key);
        seen.add(r.id);
        const isPaid = r.paymentStatus === "paid" || r.registrationStatus === "confirmed";
        list.push({
          id: r.id,
          leagueId: r.leagueId,
          playerId: r.playerId,
          name: p ? `${p.firstName} ${p.lastName}`.trim() : "Registered Player",
          email: p?.email || "player@example.com",
          phone: p?.phone || "(404) 555-0100",
          ntrp: p?.ntrp || r.skillLevelSnapshot || "3.5",
          city: p?.city || "Atlanta",
          status: isPaid ? "registered" : "held",
          paymentStatus: isPaid ? "paid" : "held",
          amountCents: r.amountCents || 3500,
          createdAt: r.createdAt || new Date().toISOString(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });
      }
    });

    return list;
  }, [allRegistrations, registrations, players]);

  const remainingSpots = (league: League) => league.spotsRemaining ?? Math.max(0, league.playerLimit - (league.registeredCount ?? 0));
  const registrationState = (league: League) => {
    if (league.registrationStatus === "waitlist") return "waitlist";
    if (remainingSpots(league) <= 0) return "full";
    return league.registrationOpen ? "open" : "closed";
  };
  const managedLeagues = leagues.filter((league) => {
    const state = registrationState(league);
    const season = seasons.find((item) => item.id === league.seasonId);
    if (leagueStatus === "active" && (state !== "open" || season?.status === "closed")) return false;
    if (leagueStatus !== "all" && leagueStatus !== "active" && state !== leagueStatus) return false;
    if (leagueSeason !== "all" && league.seasonId !== leagueSeason) return false;
    if (leagueType !== "all" && league.format !== leagueType) return false;
    const query = leagueQuery.trim().toLowerCase();
    return !query || [league.name, league.venue, season?.name, FORMAT_LABELS[league.format], league.area, league.geographicGroup].some((value) => value?.toLowerCase().includes(query));
  }).sort((a, b) => {
    if (leagueSort === "capacity") return remainingSpots(a) - remainingSpots(b);
    if (leagueSort === "date") {
      const date = (league: League) => {
        const raw = league.startDate || seasons.find((item) => item.id === league.seasonId)?.startDate;
        const time = raw ? Date.parse(raw) : NaN;
        return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
      };
      return date(a) - date(b);
    }
    const order = { open: 0, full: 1, waitlist: 2, closed: 3 };
    return order[registrationState(a)] - order[registrationState(b)] || a.name.localeCompare(b.name);
  });

  const leagueFilters = <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-1 text-xs font-semibold">Registration status
                <select aria-label="Filter league status" value={leagueStatus} onChange={(event) => setLeagueStatus(event.target.value)} className="block h-11 w-full rounded-lg border border-input bg-background px-2 text-sm">
                  <option value="active">Active / open</option><option value="all">All statuses</option><option value="open">Open</option><option value="closed">Closed</option><option value="full">Full</option><option value="waitlist">Waitlist</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold">Season
                <select aria-label="Filter league season" value={leagueSeason} onChange={(event) => setLeagueSeason(event.target.value)} className="block h-11 w-full rounded-lg border border-input bg-background px-2 text-sm">
                  <option value="all">All seasons</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold">League type
                <select aria-label="Filter league type" value={leagueType} onChange={(event) => setLeagueType(event.target.value)} className="block h-11 w-full rounded-lg border border-input bg-background px-2 text-sm">
                  <option value="all">All types</option>{Object.entries(FORMAT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
  </div>;

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <BallLoader label="Loading organizer hub..." />
      </div>
    );
  }

  if (user.role !== "organizer") return null;

  if (loadingRegistrations) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <BallLoader label="Loading organizer hub & live registrations..." />
        <p className="text-xs text-muted-foreground animate-pulse">Syncing leagues, rosters, and registration data…</p>
      </div>
    );
  }

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await createLeague({
        seasonId,
        name,
        format,
        skillLevel,
        feeCents: Math.round(feeUsd * 100),
        scheduleDay,
        scheduleTime,
        venue,
        playerLimit,
        registrationOpen: true,
        description,
      });
      toast.success("League created successfully!");
      setActiveTab("leagues");
      // reset form
      setName("");
      setVenue("");
      setDescription("");
      setFeeUsd(100);
    } catch (err) {
      toast.error("Failed to create league");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Organizer Hub
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage seasons, leagues, and player registrations.
        </p>
      </div>

      <div role="tablist" aria-label="Organizer navigation tabs" className="mb-6 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 sm:mb-8 sm:flex sm:gap-2">
        {[
          { id: "leagues", label: "Manage Leagues", icon: Users },
          { id: "geography", label: "Atlanta Geography", icon: MapPin },
          { id: "create", label: "Create League", icon: Plus },
        ].map((tab, index, tabs) => (
          <button key={tab.id} id={`organizer-tab-${tab.id}`} type="button" role="tab"
            aria-selected={activeTab === tab.id} aria-controls={`organizer-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-11 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm",
              activeTab === tab.id ? "bg-card text-primary shadow-sm" : "text-foreground hover:bg-card/60")}
            onClick={() => setActiveTab(tab.id as "leagues" | "geography" | "create")}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              const nextTab = tabs[next];
              if (!nextTab) return;
              setActiveTab(nextTab.id as "leagues" | "geography" | "create");
              document.getElementById(`organizer-tab-${nextTab.id}`)?.focus();
            }}>
            <tab.icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "leagues" && (
        <div id="organizer-panel-leagues" role="tabpanel" aria-labelledby="organizer-tab-leagues" className="space-y-6">
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <div className="rounded-xl border border-border bg-card px-3 py-4 shadow-sm md:p-6">
              <div className="text-[11px] leading-snug md:text-sm font-medium text-muted-foreground"><span className="md:hidden">Leagues</span><span className="hidden md:inline">Total Leagues</span></div>
              <div className="mt-1 text-2xl md:mt-2 md:text-3xl font-bold">{leagues.length}</div>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-4 shadow-sm md:p-6">
              <div className="text-[11px] leading-snug md:text-sm font-medium text-muted-foreground"><span className="md:hidden">Entries</span><span className="hidden md:inline">Total League Registrations</span></div>
              <div className="mt-1 text-2xl md:mt-2 md:text-3xl font-bold text-primary">
                {loadingRegistrations && allRegistrations.length === 0 ? (
                  <Skeleton className="h-9 w-20" />
                ) : (
                  effectiveRegistrations.filter((r) => r.paymentStatus === "paid" || r.paymentStatus === "held").length
                )}
              </div>
              <div className="mt-1 hidden text-xs text-muted-foreground md:block">
                {effectiveRegistrations.filter((r) => r.paymentStatus === "held").length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    ({effectiveRegistrations.filter((r) => r.paymentStatus === "held").length} currently on 15m hold)
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-4 shadow-sm md:p-6">
              <div className="text-[11px] leading-snug md:text-sm font-medium text-muted-foreground"><span className="md:hidden">Players</span><span className="hidden md:inline">Total Players</span></div>
              <div className="mt-1 text-2xl md:mt-2 md:text-3xl font-bold">
                {totalPlayersCount !== null ? totalPlayersCount : players.length}
              </div>
              <div className="mt-1 hidden text-xs text-muted-foreground md:block">
                Distinct registered players
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Manage Leagues</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Open a league to manage its participants and registration.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" aria-label="Search organizer leagues" placeholder="Search leagues, venues or seasons" value={leagueQuery} onChange={(event) => setLeagueQuery(event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm" />
            </label>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3 sm:grid-cols-4">
              <div className="sm:hidden">
                <Sheet open={leagueFiltersOpen} onOpenChange={setLeagueFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="h-11 rounded-lg">
                      <SlidersHorizontal className="size-4" /> Filters
                      {(leagueStatus !== "all" || leagueSeason !== "all" || leagueType !== "all") && <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[11px] text-primary">{Number(leagueStatus !== "all") + Number(leagueSeason !== "all") + Number(leagueType !== "all")}</span>}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                    <SheetHeader className="mb-5 text-left">
                      <SheetTitle>Filter leagues</SheetTitle>
                      <SheetDescription>Choose registration status, season and league type.</SheetDescription>
                    </SheetHeader>
                    {leagueFilters}
                    <div className="mt-6 flex gap-3">
                      <Button variant="outline" onClick={() => { setLeagueStatus("all"); setLeagueSeason("all"); setLeagueType("all"); }}>Reset</Button>
                      <Button className="flex-1" onClick={() => setLeagueFiltersOpen(false)}>Show {managedLeagues.length} {managedLeagues.length === 1 ? "league" : "leagues"}</Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <div className="hidden sm:col-span-3 sm:block">{leagueFilters}</div>
              <label className="space-y-1 text-xs font-semibold">Sort by
                <select aria-label="Sort organizer leagues" value={leagueSort} onChange={(event) => setLeagueSort(event.target.value)} className="block h-11 w-full rounded-lg border border-input bg-background px-2 text-sm">
                  <option value="status">Status</option><option value="date">Soonest start</option><option value="capacity">Fewest spots</option>
                </select>
              </label>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-2 text-xs">
              <p aria-live="polite" className="text-muted-foreground">{managedLeagues.length} of {leagues.length} leagues</p>
              <button type="button" className="min-h-11 font-semibold text-primary hover:underline" onClick={() => { setLeagueQuery(""); setLeagueStatus("all"); setLeagueSeason("all"); setLeagueType("all"); }}>Show all leagues</button>
            </div>
          </div>
          {managedLeagues.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No leagues match these filters. Try another status or show all leagues.</p>}

          {/* Mobile League Cards (<lg) */}
          <div className="space-y-3.5 lg:hidden">
            {managedLeagues.map((league) => {
              const season = seasons.find((s) => s.id === league.seasonId);
              const leagueRegs = effectiveRegistrations.filter((r) => r.leagueId === league.id);
              const heldCount = leagueRegs.filter((r) => r.paymentStatus === "held").length;
              const confirmedCount = typeof league.registeredCount === "number"
                ? league.registeredCount
                : Math.max(0, league.playerLimit - (league.spotsRemaining ?? league.playerLimit));
              const spotsRemaining = typeof league.spotsRemaining === "number"
                ? league.spotsRemaining
                : Math.max(0, league.playerLimit - confirmedCount);

              return (
                <div
                  key={league.id}
                  onClick={() => setSelectedLeague(league)}
                  className="relative rounded-2xl border border-border bg-card p-4 shadow-sm active:scale-[0.99] transition-all space-y-3"
                >
                  <button type="button" aria-label={`View participants for ${league.name}`} onClick={() => setSelectedLeague(league)} className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-foreground leading-tight">{cleanLeagueName(league.name)}</h3>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                          {FORMAT_LABELS[league.format] || league.format}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-foreground">
                          NTRP {league.skillLevel}
                        </span>
                      </div>
                    </div>
                    <span className={cn("inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize", registrationState(league) === "open" ? "bg-emerald-100 text-emerald-800" : "bg-muted text-foreground")}>
                      {registrationState(league)}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/50">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-primary shrink-0" />
                      <span>{season?.name || "Season"}{league.startDate && league.endDate ? ` (${formatDateRange(league.startDate, league.endDate)})` : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-primary shrink-0" />
                      <span className="truncate">{cleanVenue(league.venue)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-muted/50 p-2.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                      <Users className="size-3.5 text-primary" />
                      <span>{confirmedCount} / {league.playerLimit} confirmed</span>
                    </div>
                    {heldCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5">
                        <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                        {heldCount} on 15m hold
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        {spotsRemaining} spots left
                      </span>
                    )}
                  </div>

                  <div className="relative z-20 grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedLeague(league)}
                      className="h-11 min-h-11 w-full rounded-full text-xs font-semibold"
                    >
                      <Users className="size-3.5 mr-1.5 text-primary" /> View Participants ({Math.min(league.playerLimit, confirmedCount + heldCount)})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleRegistration(league.id)}
                      className="h-11 min-h-11 w-full rounded-full px-3 text-xs font-semibold"
                    >
                      {league.registrationOpen ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                      {league.registrationOpen ? "Close registration" : "Open registration"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (>=lg) */}
          <div className="hidden lg:block overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-secondary/50 text-xs uppercase text-foreground">
                  <tr>
                    <th className="px-6 py-4">League</th>
                    <th className="px-6 py-4">Season</th>
                    <th className="px-6 py-4">Participants</th>
                    <th className="px-6 py-4">Registration</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {managedLeagues.map((league) => {
                    const season = seasons.find((s) => s.id === league.seasonId);
                    const leagueRegs = effectiveRegistrations.filter((r) => r.leagueId === league.id);
                    const heldCount = leagueRegs.filter((r) => r.paymentStatus === "held").length;
                    const confirmedCount = typeof league.registeredCount === "number"
                      ? league.registeredCount
                      : Math.max(0, league.playerLimit - (league.spotsRemaining ?? league.playerLimit));

                    return (
                      <tr
                        key={league.id}
                        onClick={() => setSelectedLeague(league)}
                        className="hover:bg-muted/60 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {cleanLeagueName(league.name)}
                            </span>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              {FORMAT_LABELS[league.format] || league.format}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span>NTRP {league.skillLevel}</span>
                            <span>•</span>
                            <span>{cleanVenue(league.venue)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{season?.name}</div>
                          {league.startDate && league.endDate && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatDateRange(league.startDate, league.endDate)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <Users className="size-4 text-primary" />
                              <span>
                                {confirmedCount} / {league.playerLimit} confirmed
                              </span>
                            </div>
                            {heldCount > 0 && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-bold px-2.5 py-0.5 w-fit">
                                <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                                {heldCount} on 15m hold
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {league.registrationOpen ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                              Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-800 dark:text-slate-300">
                              Closed
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedLeague(league)}
                              className="rounded-full h-8 text-xs font-semibold"
                            >
                              <Users className="size-3.5 mr-1.5 text-primary" />
                              Roster
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleRegistration(league.id)}
                              className="rounded-full h-8 text-xs"
                            >
                              {league.registrationOpen ? (
                                <>
                                  <Lock className="mr-1.5 size-3" /> Close
                                </>
                              ) : (
                                <>
                                  <Unlock className="mr-1.5 size-3" /> Open
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Future Concept - Not Included in V1: Score Verification (hidden for V1) */}
      {false && activeTab === "scores" && (
        <div className="space-y-6">
          {/* Future Concept Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 text-amber-900 dark:text-amber-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  Future Concept - Not Included in V1
                </span>
                <span className="text-xs font-semibold opacity-90">Post-Launch Roadmap</span>
              </div>
              <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300/90">
                Official fixture generation, player match reporting, and score verification are planned for post-V1 release.
                V1 provides current registration availability and roster organization. Payments currently use a mock flow.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground">Pending Player Scores</div>
              <div className="mt-2 text-3xl font-bold text-amber-600">
                {results.filter((r) => r.status === "awaiting-confirmation").length}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground">Official Confirmed Results</div>
              <div className="mt-2 text-3xl font-bold text-emerald-600">
                {results.filter((r) => r.status === "accepted").length}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Total Active Fixtures</div>
                <span className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.5">
                  Future Concept
                </span>
              </div>
              <div className="mt-2 text-3xl font-bold">{matches.length}</div>
            </div>
          </div>

          {/* Section 1: Pending Approvals */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-2">Scores Awaiting Verification</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Player-reported match scores. Scores will not display in official player stats until you verify and confirm them here.
            </p>

            {results.filter((r) => r.status === "awaiting-confirmation").length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
                ✓ No pending match scores to review. All submitted results have been verified.
              </div>
            ) : (
              <div className="space-y-3">
                {results
                  .filter((r) => r.status === "awaiting-confirmation")
                  .map((res) => {
                    const match = matches.find((m) => m.id === res.matchId);
                    const submitter = players.find((p) => p.id === res.submittedBy);
                    const winner = players.find((p) => p.id === res.winnerId);

                    return (
                      <div
                        key={res.resultId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-sm"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                              Needs Verification
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Reported by: <strong>{submitter ? `${submitter.firstName} ${submitter.lastName}` : res.submittedBy}</strong>
                            </span>
                          </div>
                          <p className="font-bold text-base text-foreground">
                            {match?.court || "Piedmont Park"} · {match?.matchDate || "Scheduled Date"}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            Reported Score: <strong className="font-mono text-sm text-foreground">{res.scoreData}</strong> · Winner: <strong>{winner ? `${winner.firstName} ${winner.lastName}` : (res.winnerId === res.submittedBy ? "Reporter" : "Opponent")}</strong>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                            onClick={() => {
                              confirmMatchResult(res.resultId);
                              toast.success("Match result verified! Official stats updated for players.");
                            }}
                          >
                            ✓ Verify & Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                            onClick={() => {
                              const reason = window.prompt("Enter dispute reason:", "Score mismatch reported by opponent or incomplete fixture.");
                              if (reason && reason.trim()) {
                                disputeMatchResult(res.resultId, reason.trim());
                                toast.info("Result marked as disputed. It will not count toward official player stats.");
                              }
                            }}
                          >
                            Dispute Score
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Sub-section: Disputed Results */}
            {results.some((r) => r.status === "disputed") && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-bold text-destructive flex items-center gap-1.5">
                  <span>⚠️ Disputed Results Under Committee Review</span>
                </h3>
                {results
                  .filter((r) => r.status === "disputed")
                  .map((res) => {
                    const match = matches.find((m) => m.id === res.matchId);
                    return (
                      <div
                        key={res.resultId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs"
                      >
                        <div>
                          <span className="font-bold text-foreground">
                            {match?.court || "Atlanta Court"} · Score: {res.scoreData}
                          </span>
                          <p className="text-destructive mt-1">
                            <strong>Reason:</strong> {res.disputeReason || "Contested score"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs self-start sm:self-auto"
                          onClick={() => {
                            confirmMatchResult(res.resultId);
                            toast.success("Dispute resolved and result accepted.");
                          }}
                        >
                          Resolve & Confirm
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Section 2: Direct Score Entry for All Scheduled Fixtures */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-2">Direct Official Score Entry</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Future Concept Preview: Record official verified match scores (automated fixture generation and score verification are not included in V1).
            </p>

            {matches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
                <span className="font-semibold block text-foreground mb-1">0 Active Fixtures</span>
                No regular season fixtures have been generated yet. Fixture round-robin generation and official match score recording will be active in post-V1 release.
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((m) => {
                const res = results.find((r) => r.matchId === m.id);
                const player1 = players.find((p) => p.id === m.playerId);
                const isSelected = directScoreMatchId === m.id;

                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            {player1 ? `${player1.firstName} ${player1.lastName}` : "Player 1"} vs {m.opponentName || "Opponent"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({m.court || "Piedmont Park"})
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {m.matchDate} at {m.matchTime} · Status: <strong className="capitalize">{m.matchStatus}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {res?.status === "accepted" ? (
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-700">
                            ✓ {res.scoreData} (Verified)
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full text-xs"
                            onClick={() => {
                              setDirectScoreMatchId(isSelected ? null : m.id);
                              setDirectWinnerId(m.playerId);
                            }}
                          >
                            {isSelected ? "Cancel" : "Enter Official Score"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-4 border-t border-border pt-3 space-y-3 bg-muted/40 p-3 rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-foreground block mb-1">
                              Match Score (Sets)
                            </label>
                            <input
                              type="text"
                              value={directScoreText}
                              onChange={(e) => setDirectScoreText(e.target.value)}
                              placeholder="e.g. 6-4, 6-3 or 6-3, 4-6, 10-7"
                              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-foreground block mb-1">
                              Match Winner
                            </label>
                            <select
                              value={directWinnerId}
                              onChange={(e) => setDirectWinnerId(e.target.value)}
                              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                            >
                              <option value={m.playerId}>
                                {player1 ? `${player1.firstName} ${player1.lastName}` : "Home Player"}
                              </option>
                              <option value={m.opponentId || "opponent"}>
                                {m.opponentName || "Opponent"}
                              </option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            className="rounded-full"
                            onClick={() => {
                              submitMatchScore({
                                matchId: m.id,
                                submittedBy: "organizer",
                                scoreData: directScoreText,
                                winnerId: directWinnerId || m.playerId,
                                role: "organizer",
                              });
                              toast.success("Official score recorded and verified!");
                              setDirectScoreMatchId(null);
                            }}
                          >
                            Save & Confirm Official Score
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      )}

      {activeTab === "create" && (
        <div id="organizer-panel-create" role="tabpanel" aria-labelledby="organizer-tab-create" className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-bold mb-6">Create New League</h2>
          <form onSubmit={handleCreateLeague} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">League Name</label>
                <input required value={name} onChange={e => setName(e.target.value)} className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Season</label>
                <Select value={seasonId} onValueChange={setSeasonId}>
                  <SelectTrigger className="h-11 px-4 text-sm bg-background">
                    <SelectValue placeholder="Select a season" />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Format</label>
                <Select value={format} onValueChange={(val) => setFormat(val as LeagueFormat)}>
                  <SelectTrigger className="h-11 px-4 text-sm bg-background">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="men-singles">Men's Singles</SelectItem>
                    <SelectItem value="women-singles">Women's Singles</SelectItem>
                    <SelectItem value="men-doubles">Men's Doubles</SelectItem>
                    <SelectItem value="mixed-doubles">Mixed Doubles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Skill Level</label>
                <Select value={skillLevel} onValueChange={(val) => setSkillLevel(val as SkillLevel)}>
                  <SelectTrigger className="h-11 px-4 text-sm bg-background">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_LEVELS.map((lvl) => (
                      <SelectItem key={lvl} value={lvl}>
                        {lvl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Player Limit</label>
                <input type="number" required value={playerLimit} onChange={e => setPlayerLimit(Number(e.target.value))} className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Fee (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={feeUsd}
                  onChange={e => setFeeUsd(Number(e.target.value))}
                  className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50"
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Day</label>
                <input required value={scheduleDay} onChange={e => setScheduleDay(e.target.value)} placeholder="e.g. Tuesday" className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Time</label>
                <input required value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} placeholder="e.g. 7:00 PM" className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Venue</label>
                <Select value={venue} onValueChange={setVenue} required>
                  <SelectTrigger className="h-11 px-4 text-sm bg-background border border-input shadow-sm transition-colors focus:ring-1 focus:ring-primary focus:border-primary hover:border-primary/50">
                    <SelectValue placeholder="Select a venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {ATLANTA_VENUES.map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <textarea required value={description} onChange={e => setDescription(e.target.value)} rows={3} className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50" />
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" size="lg" className="rounded-full shadow-md">
                <Plus className="mr-2 size-4" /> Create League
              </Button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "geography" && (
        <div id="organizer-panel-geography" role="tabpanel" aria-labelledby="organizer-tab-geography" className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-2">Metro Atlanta Geographic Distribution</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Player geographic distribution and home court clustering across metro Atlanta neighborhoods.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { area: "Buckhead / North Atlanta", count: 142, zips: "30305, 30327, 30342", courts: "Bitsy Grant, Chastain Park" },
                { area: "Midtown / Intown", count: 168, zips: "30308, 30309, 30306", courts: "Sharon Lester at Piedmont Park" },
                { area: "Cumming / Forsyth", count: 96, zips: "30028, 30040, 30041", courts: "Sharon Springs, Fowler Park, Central Park" },
                { area: "Brookhaven & Sandy Springs", count: 94, zips: "30319, 30328", courts: "Blackburn, Sandy Springs TC" },
              ].map((loc) => (
                <div key={loc.area} className="rounded-xl border border-border/80 bg-muted/20 p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">{loc.area}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {loc.count} players
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong>ZIPs:</strong> {loc.zips}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Venues:</strong> {loc.courts}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-[11px] text-muted-foreground italic text-center">
              * Venue names are shown for illustration and do not indicate municipal partnership, commercial affiliation, or confirmed court reservation availability.
            </p>
          </div>
        </div>
      )}

      {/* Future Concept - Not Included in V1: Playoff Bracket (hidden for V1) */}
      {false && activeTab === "bracket" && <PlayoffBracket />}

      {/* ─── League Participants Dialog Modal ─────────────────────────────── */}
      <Dialog open={Boolean(selectedLeague)} onOpenChange={(open) => { if (!open) { setSelectedLeague(null); setSearchQuery(""); setStatusFilter("all"); } }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full sm:max-w-4xl max-h-[92dvh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl border-border [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:right-2 [&>button]:top-2 sm:[&>button]:size-8">
          {selectedLeague && (() => {
            const season = seasons.find((s) => s.id === selectedLeague.seasonId);
            const leagueParticipants = effectiveRegistrations.filter((r) => r.leagueId === selectedLeague.id || ((selectedLeague as any).slug && r.leagueId === (selectedLeague as any).slug));
            const paidParticipants = leagueParticipants.filter((r) => r.paymentStatus === "paid");
            const heldParticipants = leagueParticipants.filter((r) => r.paymentStatus === "held");
            const confirmedCount = typeof selectedLeague.registeredCount === "number"
              ? selectedLeague.registeredCount
              : Math.max(0, selectedLeague.playerLimit - (selectedLeague.spotsRemaining ?? selectedLeague.playerLimit));
            const spotsRemaining = typeof selectedLeague.spotsRemaining === "number"
              ? selectedLeague.spotsRemaining
              : Math.max(0, selectedLeague.playerLimit - confirmedCount - heldParticipants.length);

            const filteredParticipants = leagueParticipants.filter((p) => {
              if (statusFilter === "paid" && p.paymentStatus !== "paid") return false;
              if (statusFilter === "held" && p.paymentStatus !== "held") return false;
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = p.name?.toLowerCase().includes(q);
                const matchEmail = p.email?.toLowerCase().includes(q);
                const matchPhone = p.phone?.toLowerCase().includes(q);
                return matchName || matchEmail || matchPhone;
              }
              return true;
            });

            const copyAllEmails = () => {
              const emails = filteredParticipants.map((p) => p.email).filter(Boolean).join(", ");
              if (!emails) {
                toast.error("No participant emails to copy");
                return;
              }
              navigator.clipboard.writeText(emails);
              setCopiedEmails(true);
              toast.success(`Copied ${filteredParticipants.length} participant emails to clipboard`);
              setTimeout(() => setCopiedEmails(false), 2000);
            };

            const formatHoldTime = (expiresAt?: string) => {
              if (!expiresAt) return "Checkout in progress";
              const diffMs = new Date(expiresAt).getTime() - Date.now();
              if (diffMs <= 0) return "Hold expired";
              const mins = Math.ceil(diffMs / (60 * 1000));
              return `~${mins} min left on hold`;
            };

            return (
              <div className="flex flex-col overflow-y-auto overflow-x-hidden max-h-[92dvh]">
                {/* Modal Header */}
                <div className="border-b border-border/80 bg-muted/40 p-4 sm:p-7">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap pr-10 sm:pr-0">
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                          {FORMAT_LABELS[selectedLeague.format] || selectedLeague.format}
                        </span>
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
                          NTRP {selectedLeague.skillLevel}
                        </span>
                        <span className="rounded-full bg-muted border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {formatMoney(selectedLeague.feeCents)} per player
                        </span>
                      </div>
                      <DialogTitle className="pr-8 sm:pr-0 text-xl sm:text-2xl font-bold text-foreground break-words leading-tight">
                        {cleanLeagueName(selectedLeague.name)}
                      </DialogTitle>
                      <DialogDescription className="mt-1.5 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-wrap">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Calendar className="size-3.5 text-primary shrink-0" />
                          {season?.name || "Season"}{selectedLeague.startDate && selectedLeague.endDate ? ` (${formatDateRange(selectedLeague.startDate, selectedLeague.endDate)})` : ""}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3.5 text-primary shrink-0" />
                          <span className="truncate">{cleanVenue(selectedLeague.venue)}</span>
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5 text-primary shrink-0" />
                          <span>{selectedLeague.scheduleDay}s at {selectedLeague.scheduleTime}</span>
                        </span>
                      </DialogDescription>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyAllEmails}
                        className="rounded-xl text-sm font-semibold h-11 sm:h-9 w-full sm:w-auto"
                      >
                        {copiedEmails ? (
                          <>
                            <Check className="size-3.5 mr-1.5 text-emerald-600" /> Copied Emails
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5 mr-1.5 text-muted-foreground" /> Copy Emails
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* KPI Badges */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 sm:mt-6">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 sm:p-3 text-left">
                      <div className="text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider truncate">
                        <span className="sm:hidden">Confirmed</span><span className="hidden sm:inline">Paid (Confirmed)</span>
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5 flex items-baseline">
                        {confirmedCount}
                        <span className="hidden sm:inline text-xs font-normal text-muted-foreground ml-1">
                          / {selectedLeague.playerLimit}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-2.5 sm:p-3 text-left">
                      <div className="text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1 truncate">
                        <Clock className="size-3 shrink-0" />
                        <span className="truncate">Holds</span>
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-amber-800 dark:text-amber-300 mt-0.5 flex items-baseline gap-1">
                        {heldParticipants.length}
                        <span className="text-[10px] sm:text-[11px] font-normal text-amber-600 dark:text-amber-400 truncate hidden xs:inline">
                          in progress
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-2.5 sm:p-3 text-left">
                      <div className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                        <span className="sm:hidden">Available</span><span className="hidden sm:inline">Spots Remaining</span>
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-foreground mt-0.5 flex items-baseline">
                        {spotsRemaining}
                        <span className="hidden sm:inline text-xs font-normal text-muted-foreground ml-1.5">
                          open of {selectedLeague.playerLimit}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="sticky top-0 z-10 p-3 sm:p-5 border-b border-border bg-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      aria-label="Search participants"
                      placeholder="Search name, email, phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-full border border-border bg-background h-11 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      aria-pressed={statusFilter === "all"}
                      onClick={() => setStatusFilter("all")}
                      className={`min-h-11 px-2 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${statusFilter === "all"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground hover:bg-background"
                        }`}
                    >
                      All ({leagueParticipants.length})
                    </button>
                    <button
                      type="button"
                      aria-pressed={statusFilter === "paid"}
                      onClick={() => setStatusFilter("paid")}
                      className={`min-h-11 px-2 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${statusFilter === "paid"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-foreground hover:bg-background"
                        }`}
                    >
                      Paid ({paidParticipants.length})
                    </button>
                    <button
                      type="button"
                      aria-pressed={statusFilter === "held"}
                      onClick={() => setStatusFilter("held")}
                      className={`min-h-11 px-2 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${statusFilter === "held"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "text-foreground hover:bg-background"
                        }`}
                    >
                      On Hold ({heldParticipants.length})
                    </button>
                  </div>
                </div>

                {/* Participants Roster List / Table */}
                <div className="p-3 sm:p-6">
                  {filteredParticipants.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 sm:p-12 text-center">
                      <Users className="size-10 mx-auto text-muted-foreground/50 mb-3" />
                      <h4 className="font-bold text-sm text-foreground">No participants found</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        {searchQuery || statusFilter !== "all"
                          ? "No players match your active search or filter criteria."
                          : "No participants have registered for this league yet. Players will appear here once they reserve or complete checkout."}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile Participant Cards (<md) */}
                      <div className="divide-y divide-border md:hidden">
                        {filteredParticipants.map((p, idx) => {
                          const isPaid = p.paymentStatus === "paid";
                          const isHeld = p.paymentStatus === "held";
                          const initials = (p.name || "Player")
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();

                          return (
                            <div
                              key={p.id || idx}
                              className="py-4 first:pt-0 space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Avatar className="size-9 border border-primary/20 shrink-0">
                                    <AvatarFallback className="bg-primary font-bold text-primary-foreground text-xs">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <div className="font-bold text-sm text-foreground truncate">{p.name}</div>
                                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">
                                        NTRP {p.ntrp || "3.5"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Status Badge */}
                                <div className="shrink-0">
                                  {isPaid ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                                      <CheckCircle2 className="size-3" />
                                      Paid
                                    </span>
                                  ) : isHeld ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/70 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                                      <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                                      15m Hold
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                                      Expired
                                    </span>
                                  )}
                                </div>
                              </div>

                              <details className="group/contact">
                                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
                                  Contact & registration details
                                  <span className="text-lg transition-transform group-open/contact:rotate-45" aria-hidden="true">+</span>
                                </summary>
                              {/* Contact Information */}
                              <div className="text-xs space-y-1 pt-2 border-t border-border/60">
                                <a
                                  href={`mailto:${p.email}`}
                                  className="flex min-h-11 items-center gap-2 font-medium text-foreground hover:text-primary transition-colors truncate"
                                  title={p.email}
                                >
                                  <Mail className="size-3.5 text-muted-foreground shrink-0" />
                                  <span className="truncate">{p.email}</span>
                                </a>
                                {p.phone && p.phone !== "Not provided" && (
                                  <a
                                    href={`tel:${p.phone}`}
                                    className="flex min-h-11 items-center gap-2 text-foreground hover:text-primary transition-colors text-sm"
                                  >
                                    <Phone className="size-3 shrink-0" />
                                    <span>{p.phone}</span>
                                  </a>
                                )}
                                {p.preferredCourt && (
                                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                                    <MapPin className="size-3 shrink-0 text-primary" />
                                    <span className="truncate">{cleanVenue(p.preferredCourt)}</span>
                                  </div>
                                )}
                              </div>

                              </details>
                              {/* Footer note: timestamp & hold timer */}
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/40">
                                <span>
                                  {p.createdAt
                                    ? `Registered ${new Date(p.createdAt).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })}`
                                    : "Registered"}
                                </span>
                                {isHeld && (
                                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                                    {formatHoldTime(p.expiresAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table (>=md) */}
                      <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-muted-foreground">
                            <thead className="bg-secondary/60 text-[11px] uppercase tracking-wider text-foreground font-semibold">
                              <tr>
                                <th className="px-5 py-3.5">Participant</th>
                                <th className="px-5 py-3.5">Contact Information</th>
                                <th className="px-5 py-3.5">Rating</th>
                                <th className="px-5 py-3.5">Payment Status</th>
                                <th className="px-5 py-3.5 text-right">Registered</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {filteredParticipants.map((p, idx) => {
                                const isPaid = p.paymentStatus === "paid";
                                const isHeld = p.paymentStatus === "held";
                                const initials = (p.name || "Player")
                                  .split(" ")
                                  .map((n: string) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase();

                                return (
                                  <tr key={p.id || idx} className="hover:bg-muted/40 transition-colors">
                                    {/* Name */}
                                    <td className="px-5 py-4">
                                      <div className="flex items-center gap-3">
                                        <Avatar className="size-9 border border-primary/20 shrink-0">
                                          <AvatarFallback className="bg-primary font-bold text-primary-foreground text-xs">
                                            {initials}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <div className="font-bold text-sm text-foreground">{p.name}</div>
                                          {p.preferredCourt && (
                                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                              {cleanVenue(p.preferredCourt)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    {/* Contact */}
                                    <td className="px-5 py-4">
                                      <div className="flex flex-col gap-1">
                                        <a
                                          href={`mailto:${p.email}`}
                                          className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors truncate max-w-[200px]"
                                          title={p.email}
                                        >
                                          <Mail className="size-3.5 text-muted-foreground shrink-0" />
                                          <span className="truncate">{p.email}</span>
                                        </a>
                                        {p.phone && p.phone !== "Not provided" && (
                                          <a
                                            href={`tel:${p.phone}`}
                                            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-[11px]"
                                          >
                                            <Phone className="size-3 shrink-0" />
                                            <span>{p.phone}</span>
                                          </a>
                                        )}
                                      </div>
                                    </td>

                                    {/* NTRP */}
                                    <td className="px-5 py-4">
                                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-mono text-xs font-bold text-foreground">
                                        NTRP {p.ntrp || "3.5"}
                                      </span>
                                    </td>

                                    {/* Payment / Hold Status */}
                                    <td className="px-5 py-4">
                                      {isPaid ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                          <CheckCircle2 className="size-3.5" />
                                          Paid &amp; Confirmed
                                        </span>
                                      ) : isHeld ? (
                                        <div className="flex flex-col gap-0.5">
                                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/70 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 w-fit">
                                            <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                                            On Hold (15 min)
                                          </span>
                                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold pl-1">
                                            {formatHoldTime(p.expiresAt)}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                                          Hold Expired
                                        </span>
                                      )}
                                    </td>

                                    {/* Registered date */}
                                    <td className="px-5 py-4 text-right">
                                      <div className="text-foreground font-medium">
                                        {p.createdAt
                                          ? new Date(p.createdAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                          })
                                          : "—"}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {p.createdAt
                                          ? new Date(p.createdAt).toLocaleTimeString("en-US", {
                                            hour: "numeric",
                                            minute: "2-digit",
                                          })
                                          : ""}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
