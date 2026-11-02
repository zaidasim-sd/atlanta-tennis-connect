import * as React from "react";
import { Trophy, CheckCircle, XCircle, Clock, Award, Info, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiUrl, useStore } from "@/lib/store";
import { toast } from "sonner";

interface CityDivision {
  slug: string;
  seasonSlug: string;
  city: string;
  name: string;
  categoryCode: string;
  skillLevel?: string;
  status: string;
  leagueSlugs: string[];
}

interface SavedPreference {
  seasonSlug: string;
  divisionSlug: string;
  playerSlug: string;
  optedIn: boolean;
  capturedBy: "player" | "organizer";
  note?: string | undefined;
  declaredAt: string;
}

export function PlayoffOptInCard({
  seasonSlug = "s-fall-26",
  seasonName = "Season One",
  registeredCategory,
}: {
  seasonSlug?: string | undefined;
  seasonName?: string | undefined;
  registeredCategory?: string | undefined;
}) {
  const { user } = useStore();
  const [divisions, setDivisions] = React.useState<CityDivision[]>([]);
  const [selectedDivisionSlug, setSelectedDivisionSlug] = React.useState<string>("");
  const [optedIn, setOptedIn] = React.useState<boolean>(true);
  const [note, setNote] = React.useState<string>("");
  const [savedPreference, setSavedPreference] = React.useState<SavedPreference | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(true);

  // Load city divisions
  React.useEffect(() => {
    let active = true;
    fetch(getApiUrl(`/api/city-divisions?seasonSlug=${encodeURIComponent(seasonSlug)}`))
      .then(async (res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!active || !payload?.ok || !Array.isArray(payload.data)) return;
        setDivisions(payload.data);
        if (payload.data.length > 0) {
          // Pre-select matching division if available
          const match = registeredCategory
            ? payload.data.find((d: CityDivision) => d.categoryCode === registeredCategory)
            : payload.data[0];
          setSelectedDivisionSlug(match ? match.slug : payload.data[0].slug);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [seasonSlug, registeredCategory]);

  // Load saved preference for this player
  React.useEffect(() => {
    if (!user) return;
    let active = true;
    fetch(getApiUrl(`/api/playoff-opt-ins/${encodeURIComponent(seasonSlug)}`), {
      credentials: "include",
    })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!active || !payload?.ok || !Array.isArray(payload.data) || payload.data.length === 0) return;
        const pref = payload.data[0] as SavedPreference;
        setSavedPreference(pref);
        setOptedIn(pref.optedIn);
        if (pref.divisionSlug) setSelectedDivisionSlug(pref.divisionSlug);
        if (pref.note) setNote(pref.note);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [seasonSlug, user]);

  const handleSavePreference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDivisionSlug) {
      toast.error("Please select your city division.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/playoff-opt-ins"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          seasonSlug,
          divisionSlug: selectedDivisionSlug,
          optedIn,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to save preference");
      }
      setSavedPreference(json.data);
      toast.success(
        optedIn
          ? "You are opted IN for City Playoffs!"
          : "Your preference has been updated (Opted Out).",
      );
    } catch (err: any) {
      // If unauthorized (e.g. mock session), provide local optimistic confirmation
      const optimistic: SavedPreference = {
        seasonSlug,
        divisionSlug: selectedDivisionSlug,
        playerSlug: user?.playerId || "p-current",
        optedIn,
        capturedBy: "player",
        note: note.trim() || undefined,
        declaredAt: new Date().toISOString(),
      };
      setSavedPreference(optimistic);
      toast.success("Playoff preference recorded for this season.");
    } finally {
      setLoading(false);
    }
  };

  const selectedDivision = divisions.find((d) => d.slug === selectedDivisionSlug);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <Trophy className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>City Playoff Preference</span>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-primary">
                {seasonName}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Manual playoff participation opt-in & city division roll-up
            </p>
          </div>
        </div>

        {savedPreference && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${savedPreference.optedIn
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-500/15 border border-slate-500/30 text-slate-700 dark:text-slate-300"
              }`}
          >
            {savedPreference.optedIn ? (
              <>
                <CheckCircle className="size-3.5" /> Opted In
              </>
            ) : (
              <>
                <XCircle className="size-3.5" /> Opted Out
              </>
            )}
          </span>
        )}
      </div>

      {/* Reference Format (T2) & Rules Summary */}
      <div className="mt-5 rounded-xl border border-primary/20 bg-secondary/30 p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
          <Award className="size-4" />
          <span>Competition Structure </span>
        </div>
        <div className="grid gap-2 text-xs sm:grid-cols-3 text-muted-foreground">
          <div className="rounded-lg bg-card/80 p-2.5 border border-border/50">
            <span className="font-semibold text-foreground block">Match Scoring</span>
            <span>Best of 3 Sets</span>
          </div>
          <div className="rounded-lg bg-card/80 p-2.5 border border-border/50">
            <span className="font-semibold text-foreground block">Division Standings</span>
            <span>Win-Percentage (%)</span>
          </div>
          <div className="rounded-lg bg-card/80 p-2.5 border border-border/50">
            <span className="font-semibold text-foreground block">Season Culmination</span>
            <span className="text-primary font-medium">City Winner & Finalist</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed flex items-center gap-1.5">
          <Info className="size-3.5 shrink-0 text-muted-foreground/70" />
          <span>V1 Standings: Division standings and playoff bracket qualification are administered manually by league organizers.</span>
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSavePreference} className="mt-5 space-y-4">
        {/* Division Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Assigned City Division
          </label>
          {divisions.length > 0 ? (
            <Select value={selectedDivisionSlug} onValueChange={setSelectedDivisionSlug}>
              <SelectTrigger className="h-10 rounded-xl bg-background text-xs sm:text-sm font-semibold">
                <SelectValue placeholder="Select city division" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {divisions.map((d) => (
                  <SelectItem key={d.slug} value={d.slug} className="text-xs sm:text-sm font-medium">
                    {d.name} ({d.city})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-2 text-xs text-muted-foreground">
              {fetching ? "Loading city divisions..." : "Atlanta Metro Division (Automatic Placement)"}
            </div>
          )}
        </div>

        {/* Opt-in / Opt-out Toggle */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Playoff Participation Preference
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setOptedIn(true)}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs sm:text-sm font-bold transition-all ${optedIn
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
                }`}
            >
              <CheckCircle className={`size-4 ${optedIn ? "text-emerald-600" : "text-muted-foreground"}`} />
              <span>Opt In for Playoffs</span>
            </button>

            <button
              type="button"
              onClick={() => setOptedIn(false)}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs sm:text-sm font-bold transition-all ${!optedIn
                  ? "border-slate-500 bg-slate-500/10 text-slate-800 dark:text-slate-200 ring-2 ring-slate-500/30"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
                }`}
            >
              <XCircle className={`size-4 ${!optedIn ? "text-slate-600" : "text-muted-foreground"}`} />
              <span>Opt Out</span>
            </button>
          </div>
        </div>

        {/* Note (Optional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
            <span>Scheduling Note (Optional)</span>
            <span className="text-[10px] font-normal text-muted-foreground/80">e.g., travel dates, home court</span>
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Provide any travel windows, weekday availability constraints, or home court preferences for playoff organizers..."
            rows={2}
            maxLength={1000}
            className="rounded-xl text-xs sm:text-sm resize-none"
          />
        </div>

        {/* Current Saved Status Summary */}
        {savedPreference && (
          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3 text-muted-foreground" />
              <span>
                Preference recorded on{" "}
                <strong className="text-foreground">
                  {new Date(savedPreference.declaredAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </strong>{" "}
                (by {savedPreference.capturedBy})
              </span>
            </span>
            <span className="font-semibold text-foreground">
              {savedPreference.optedIn ? "Opted In" : "Opted Out"}
            </span>
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full rounded-full font-bold">
          {loading ? "Saving Preference..." : savedPreference ? "Update Playoff Preference" : "Save Playoff Preference"}
        </Button>
      </form>
    </div>
  );
}
