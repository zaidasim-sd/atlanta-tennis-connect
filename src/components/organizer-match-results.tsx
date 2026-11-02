/**
 * OrganizerMatchResults — Match result entry and history for organizers.
 * Self-contained component used inside the Organizer Hub tab.
 */
import * as React from "react";
import { getApiUrl } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Trophy,
  Plus,
  CheckCircle2,
  AlertCircle,
  Search,
  Pencil,
  XCircle,
  ChevronDown,
  Users,
  User,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/tennis";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchResultRecord {
  id: string;
  slug: string;
  seasonSlug: string;
  cityDivisionSlug?: string;
  leagueSlug: string;
  leagueFormat: string;
  matchDate: string;
  playerASlug: string;
  playerAName: string;
  playerAPartnerSlug?: string;
  playerAPartnerName?: string;
  playerBSlug: string;
  playerBName: string;
  playerBPartnerSlug?: string;
  playerBPartnerName?: string;
  set1: { playerA: number; playerB: number };
  set2: { playerA: number; playerB: number };
  set3?: { playerA: number; playerB: number };
  winnerSlug: string;
  winningSide: "A" | "B";
  status: "finalized" | "cancelled";
  enteredByEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface PlayerOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  ntrp: string;
}

interface LeagueOption {
  id: string;
  slug: string;
  name: string;
  format: string;
  seasonId: string;
}

interface SeasonOption {
  id: string;
  name: string;
}

const DOUBLES_FORMATS = ["men-doubles", "women-doubles", "mixed-doubles", "junior-doubles"];

// ─── Score Input Group ─────────────────────────────────────────────────────────

function SetInput({
  label,
  labelA,
  labelB,
  valueA,
  valueB,
  onChangeA,
  onChangeB,
}: {
  label: string;
  labelA: string;
  labelB: string;
  valueA: string;
  valueB: string;
  onChangeA: (v: string) => void;
  onChangeB: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground truncate block">{labelA}</Label>
          <Input
            type="number"
            min="0"
            max="99"
            required
            value={valueA}
            onChange={(e) => onChangeA(e.target.value)}
            className="h-9 text-center font-bold font-mono text-sm"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground truncate block">{labelB}</Label>
          <Input
            type="number"
            min="0"
            max="99"
            required
            value={valueB}
            onChange={(e) => onChangeB(e.target.value)}
            className="h-9 text-center font-bold font-mono text-sm"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Player Search Input ───────────────────────────────────────────────────────

function PlayerSearchInput({
  label,
  value,
  onSelect,
  exclude,
  required,
}: {
  label: string;
  value: PlayerOption | null;
  onSelect: (p: PlayerOption | null) => void;
  exclude?: string[];
  required?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PlayerOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    setLoading(true);
    const controller = new AbortController();
    fetch(
      getApiUrl(`/api/players/search?q=${encodeURIComponent(query)}`),
      { credentials: "include", signal: controller.signal },
    )
      .then(async (r) => {
        const json = await r.json();
        if (r.ok && json.ok && Array.isArray(json.data)) {
          setResults(
            json.data
              .filter((p: PlayerOption) => !(exclude || []).includes(p.id))
              .slice(0, 8),
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (value) {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">
            {value.firstName} {value.lastName}
          </p>
          <p className="text-[10px] text-muted-foreground">NTRP {value.ntrp} · {value.email}</p>
        </div>
        <button
          type="button"
          onClick={() => { onSelect(null); setQuery(""); }}
          className="shrink-0 rounded-full p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <XCircle className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Label className="text-[11px] font-semibold text-muted-foreground">{label}</Label>
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          value={query}
          required={required}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="pl-8 h-9 text-sm"
        />
      </div>
      {open && (results.length > 0 || loading) && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {loading && (
            <div className="px-3 py-2.5 text-xs text-muted-foreground animate-pulse">Searching…</div>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onSelect(p); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors border-b last:border-b-0 border-border/40"
            >
              <p className="text-sm font-semibold text-foreground">{p.firstName} {p.lastName}</p>
              <p className="text-[10px] text-muted-foreground">NTRP {p.ntrp} · {p.email}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Score Summary Badge ───────────────────────────────────────────────────────

function ScoreSummary({ r }: { r: MatchResultRecord }) {
  const sets = [r.set1, r.set2, ...(r.set3 ? [r.set3] : [])];
  const scoreStr = sets.map((s) => `${s.playerA}–${s.playerB}`).join("  ");
  return (
    <span className="font-mono text-sm font-bold text-foreground">{scoreStr}</span>
  );
}

function sideLabel(r: MatchResultRecord, side: "A" | "B") {
  const main = side === "A" ? r.playerAName : r.playerBName;
  const partner = side === "A" ? r.playerAPartnerName : r.playerBPartnerName;
  if (partner) return `${main} / ${partner}`;
  return main;
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface Props {
  leagues: LeagueOption[];
  seasons: SeasonOption[];
}

export function OrganizerMatchResults({ leagues, seasons }: Props) {
  const [results, setResults] = React.useState<MatchResultRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filterLeague, setFilterLeague] = React.useState("all");
  const [filterStatus, setFilterStatus] = React.useState<"all" | "finalized" | "cancelled">("finalized");
  const [entryOpen, setEntryOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<MatchResultRecord | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [cancelConfirm, setCancelConfirm] = React.useState<MatchResultRecord | null>(null);

  // ── Entry form state ──
  const [formLeagueId, setFormLeagueId] = React.useState("");
  const [formDate, setFormDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [playerA, setPlayerA] = React.useState<PlayerOption | null>(null);
  const [playerAPartner, setPlayerAPartner] = React.useState<PlayerOption | null>(null);
  const [playerB, setPlayerB] = React.useState<PlayerOption | null>(null);
  const [playerBPartner, setPlayerBPartner] = React.useState<PlayerOption | null>(null);
  const [s1A, setS1A] = React.useState("6"); const [s1B, setS1B] = React.useState("3");
  const [s2A, setS2A] = React.useState("6"); const [s2B, setS2B] = React.useState("4");
  const [hasSet3, setHasSet3] = React.useState(false);
  const [s3A, setS3A] = React.useState("6"); const [s3B, setS3B] = React.useState("3");
  const [winnerSide, setWinnerSide] = React.useState<"A" | "B">("A");
  const [formError, setFormError] = React.useState("");

  const selectedLeague = leagues.find((l) => l.id === formLeagueId || l.slug === formLeagueId);
  const isDoubles = selectedLeague ? DOUBLES_FORMATS.includes(selectedLeague.format) : false;

  // ── Fetch results ──────────────────────────────────────────────────────────
  const fetchResults = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLeague !== "all") params.set("league", filterLeague);
      const res = await fetch(getApiUrl(`/api/match-results?${params.toString()}`), { credentials: "include" });
      const json = await res.json();
      if (res.ok && json.ok && Array.isArray(json.data)) {
        setResults(json.data);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [filterLeague]);

  React.useEffect(() => { void fetchResults(); }, [fetchResults]);

  // ── Reset form ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormLeagueId("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setPlayerA(null); setPlayerAPartner(null);
    setPlayerB(null); setPlayerBPartner(null);
    setS1A("6"); setS1B("3");
    setS2A("6"); setS2B("4");
    setHasSet3(false);
    setS3A("6"); setS3B("3");
    setWinnerSide("A");
    setFormError("");
    setEditTarget(null);
  };

  const openEntry = () => { resetForm(); setEntryOpen(true); };

  const openEdit = (r: MatchResultRecord) => {
    setEditTarget(r);
    const lg = leagues.find((l) => l.slug === r.leagueSlug || l.id === r.leagueSlug);
    setFormLeagueId(lg?.id || r.leagueSlug);
    setFormDate(r.matchDate);
    // Players are known by slug — set as synthetic PlayerOption
    setPlayerA({ id: r.playerASlug, firstName: r.playerAName.split(" ")[0] ?? "", lastName: r.playerAName.split(" ").slice(1).join(" "), email: "", ntrp: "" });
    setPlayerB({ id: r.playerBSlug, firstName: r.playerBName.split(" ")[0] ?? "", lastName: r.playerBName.split(" ").slice(1).join(" "), email: "", ntrp: "" });
    if (r.playerAPartnerSlug) setPlayerAPartner({ id: r.playerAPartnerSlug, firstName: (r.playerAPartnerName || "").split(" ")[0] ?? "", lastName: (r.playerAPartnerName || "").split(" ").slice(1).join(" "), email: "", ntrp: "" });
    if (r.playerBPartnerSlug) setPlayerBPartner({ id: r.playerBPartnerSlug, firstName: (r.playerBPartnerName || "").split(" ")[0] ?? "", lastName: (r.playerBPartnerName || "").split(" ").slice(1).join(" "), email: "", ntrp: "" });
    setS1A(String(r.set1.playerA)); setS1B(String(r.set1.playerB));
    setS2A(String(r.set2.playerA)); setS2B(String(r.set2.playerB));
    if (r.set3) { setHasSet3(true); setS3A(String(r.set3.playerA)); setS3B(String(r.set3.playerB)); }
    else { setHasSet3(false); }
    setWinnerSide(r.winningSide);
    setFormError("");
    setEntryOpen(true);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerA || !playerB) { setFormError("Please select both players."); return; }
    if (playerA.id === playerB.id) { setFormError("Player A and Player B cannot be the same person."); return; }
    if (!formLeagueId) { setFormError("Please select a league."); return; }
    if (isDoubles && (!playerAPartner || !playerBPartner)) {
      setFormError("This is a doubles league. Please select partners for both sides."); return;
    }

    const winnerSlug = winnerSide === "A" ? playerA.id : playerB.id;
    const league = leagues.find((l) => l.id === formLeagueId || l.slug === formLeagueId);
    const body: Record<string, unknown> = {
      seasonSlug: league?.seasonId || seasons[0]?.id || "s-fall-26",
      leagueSlug: league?.slug || formLeagueId,
      matchDate: formDate,
      playerASlug: playerA.id,
      playerBSlug: playerB.id,
      ...(playerAPartner ? { playerAPartnerSlug: playerAPartner.id } : {}),
      ...(playerBPartner ? { playerBPartnerSlug: playerBPartner.id } : {}),
      set1: { playerA: parseInt(s1A), playerB: parseInt(s1B) },
      set2: { playerA: parseInt(s2A), playerB: parseInt(s2B) },
      ...(hasSet3 ? { set3: { playerA: parseInt(s3A), playerB: parseInt(s3B) } } : {}),
      winnerSlug,
    };

    setSaving(true);
    setFormError("");
    try {
      const url = editTarget
        ? getApiUrl(`/api/match-results/${editTarget.id}`)
        : getApiUrl("/api/match-results");
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFormError(json.error || "Failed to save result. Check the scores and try again.");
        return;
      }
      toast.success(editTarget ? "Match result updated." : "Match result recorded.");
      setEntryOpen(false);
      resetForm();
      void fetchResults();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (r: MatchResultRecord) => {
    try {
      const res = await fetch(getApiUrl(`/api/match-results/${r.id}/cancel`), {
        method: "PATCH",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { toast.error(json.error || "Failed to cancel."); return; }
      toast.success("Result cancelled and excluded from stats.");
      setCancelConfirm(null);
      void fetchResults();
    } catch {
      toast.error("Network error.");
    }
  };

  // ── Filtered display ───────────────────────────────────────────────────────
  const displayed = results.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    return true;
  });

  const leagueNameFor = (slug: string) => {
    const l = leagues.find((lg) => lg.slug === slug || lg.id === slug);
    return l?.name || slug;
  };

  const labelA = playerA ? `${playerA.firstName}${playerAPartner ? ` / ${playerAPartner.firstName}` : ""}` : "Side A";
  const labelB = playerB ? `${playerB.firstName}${playerBPartner ? ` / ${playerBPartner.firstName}` : ""}` : "Side B";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Match Results</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record verified match results. Finalized results update player stats automatically.
          </p>
        </div>
        <Button onClick={openEntry} className="rounded-full shrink-0 gap-2">
          <Plus className="size-4" />
          Record Result
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterLeague} onValueChange={setFilterLeague}>
          <SelectTrigger className="w-[200px] h-9 text-sm rounded-full">
            <SelectValue placeholder="All Leagues" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Leagues</SelectItem>
            {leagues.map((l) => (
              <SelectItem key={l.id} value={l.slug || l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex rounded-full border border-border overflow-hidden">
          {(["finalized", "all", "cancelled"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                filterStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All" : s === "finalized" ? "Finalized" : "Cancelled"}
            </button>
          ))}
        </div>
      </div>

      {/* Results list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Trophy className="size-6" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-foreground">No results recorded yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Click "Record Result" to enter the first match result for this season.
          </p>
          <Button onClick={openEntry} size="sm" className="mt-4 rounded-full">
            <Plus className="size-3.5 mr-1.5" /> Record first result
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((r) => {
            const isFinalized = r.status === "finalized";
            const winnerLabel = r.winningSide === "A" ? sideLabel(r, "A") : sideLabel(r, "B");
            const loserLabel = r.winningSide === "A" ? sideLabel(r, "B") : sideLabel(r, "A");
            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-2xl border bg-card p-4 shadow-sm transition-all",
                  isFinalized ? "border-border" : "border-dashed border-muted-foreground/40 opacity-60",
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    {/* League + date */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                        {leagueNameFor(r.leagueSlug)}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarDays className="size-3" /> {r.matchDate}
                      </span>
                      {!isFinalized && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                          Cancelled
                        </span>
                      )}
                    </div>

                    {/* Match-up */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-emerald-600 truncate">{winnerLabel}</span>
                      <span className="text-muted-foreground text-xs shrink-0">def.</span>
                      <span className="font-semibold text-foreground truncate">{loserLabel}</span>
                    </div>

                    {/* Score */}
                    <ScoreSummary r={r} />
                  </div>

                  {/* Actions */}
                  {isFinalized && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(r)}
                        className="rounded-full text-xs gap-1.5"
                      >
                        <Pencil className="size-3" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCancelConfirm(r)}
                        className="rounded-full text-xs gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <XCircle className="size-3" /> Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Entry / Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={entryOpen} onOpenChange={(o) => { if (!o) { resetForm(); setEntryOpen(false); } }}>
        <DialogContent className="max-w-lg rounded-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Trophy className="size-5 text-primary" />
              {editTarget ? "Edit Match Result" : "Record Match Result"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Best-of-3 format. Scores are validated automatically. Only finalized results count toward player stats.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* League selector */}
            <div>
              <Label className="text-xs font-semibold text-foreground">League</Label>
              <Select value={formLeagueId} onValueChange={setFormLeagueId} required>
                <SelectTrigger className="mt-1 h-9 text-sm rounded-xl">
                  <SelectValue placeholder="Select league…" />
                </SelectTrigger>
                <SelectContent>
                  {leagues.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                      <span className="ml-1.5 text-[10px] text-muted-foreground capitalize">
                        ({FORMAT_LABELS[l.format as keyof typeof FORMAT_LABELS] || l.format})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Match date */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Match Date</Label>
              <Input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-1 h-9 text-sm rounded-xl"
              />
            </div>

            {/* Players */}
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                {isDoubles ? <Users className="size-3.5" /> : <User className="size-3.5" />}
                {isDoubles ? "Doubles Teams" : "Players"}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Side A</p>
                <PlayerSearchInput
                  label="Player A"
                  value={playerA}
                  onSelect={setPlayerA}
                  exclude={[playerB?.id, playerAPartner?.id, playerBPartner?.id].filter(Boolean) as string[]}
                  required
                />
                {isDoubles && (
                  <PlayerSearchInput
                    label="Player A — Doubles Partner"
                    value={playerAPartner}
                    onSelect={setPlayerAPartner}
                    exclude={[playerA?.id, playerB?.id, playerBPartner?.id].filter(Boolean) as string[]}
                    required
                  />
                )}
              </div>

              <div className="my-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <div className="flex-1 border-t border-border/40" />
                <span className="font-bold">vs</span>
                <div className="flex-1 border-t border-border/40" />
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Side B</p>
                <PlayerSearchInput
                  label="Player B"
                  value={playerB}
                  onSelect={setPlayerB}
                  exclude={[playerA?.id, playerAPartner?.id, playerBPartner?.id].filter(Boolean) as string[]}
                  required
                />
                {isDoubles && (
                  <PlayerSearchInput
                    label="Player B — Doubles Partner"
                    value={playerBPartner}
                    onSelect={setPlayerBPartner}
                    exclude={[playerA?.id, playerB?.id, playerAPartner?.id].filter(Boolean) as string[]}
                    required
                  />
                )}
              </div>
            </div>

            {/* Set scores */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground">Set Scores (Side A — Side B)</p>
              <SetInput label="Set 1" labelA={labelA} labelB={labelB}
                valueA={s1A} valueB={s1B} onChangeA={setS1A} onChangeB={setS1B} />
              <SetInput label="Set 2" labelA={labelA} labelB={labelB}
                valueA={s2A} valueB={s2B} onChangeA={setS2A} onChangeB={setS2B} />

              {hasSet3 ? (
                <>
                  <SetInput label="Set 3 (Deciding)" labelA={labelA} labelB={labelB}
                    valueA={s3A} valueB={s3B} onChangeA={setS3A} onChangeB={setS3B} />
                  <button
                    type="button"
                    onClick={() => setHasSet3(false)}
                    className="text-xs text-muted-foreground underline"
                  >
                    Remove Set 3
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setHasSet3(true)}
                  className="text-xs font-semibold text-primary underline"
                >
                  + Add Set 3 (split sets)
                </button>
              )}
            </div>

            {/* Winner */}
            <div>
              <Label className="text-xs font-bold text-foreground">Winner</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(["A", "B"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setWinnerSide(side)}
                    className={cn(
                      "rounded-xl border p-2.5 text-xs font-bold transition-all text-left",
                      winnerSide === side
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-foreground hover:border-primary/50",
                    )}
                  >
                    <span className="block text-[9px] uppercase tracking-wider opacity-70 mb-0.5">
                      Side {side} wins
                    </span>
                    {side === "A"
                      ? `${playerA?.firstName || "Player A"}${playerAPartner ? ` / ${playerAPartner.firstName}` : ""}`
                      : `${playerB?.firstName || "Player B"}${playerBPartner ? ` / ${playerBPartner.firstName}` : ""}`
                    }
                  </button>
                ))}
              </div>
            </div>

            {/* Validation error */}
            {formError && (
              <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <DialogFooter className="mt-2 gap-2 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { resetForm(); setEntryOpen(false); }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="rounded-full min-w-[140px]" disabled={saving}>
                {saving ? "Saving…" : editTarget ? "Update Result" : "Save Result"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Confirm Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!cancelConfirm} onOpenChange={(o) => !o && setCancelConfirm(null)}>
        <DialogContent className="max-w-sm rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Cancel this result?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Cancelled results are excluded from all player statistics immediately. This action is logged for the audit trail.
            </DialogDescription>
          </DialogHeader>
          {cancelConfirm && (
            <div className="mt-3 rounded-xl bg-muted/40 border border-border p-3 text-sm space-y-1">
              <p className="font-bold">{sideLabel(cancelConfirm, cancelConfirm.winningSide === "A" ? "A" : "B")} def. {sideLabel(cancelConfirm, cancelConfirm.winningSide === "A" ? "B" : "A")}</p>
              <p className="text-xs text-muted-foreground">{cancelConfirm.matchDate} · {leagueNameFor(cancelConfirm.leagueSlug)}</p>
            </div>
          )}
          <DialogFooter className="mt-4 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCancelConfirm(null)}>Keep it</Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-full"
              onClick={() => cancelConfirm && handleCancel(cancelConfirm)}
            >
              Yes, cancel result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
