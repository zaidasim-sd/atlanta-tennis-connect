import { useState, useEffect } from "react";
import {
  Trophy,
  MapPin,
  Check,
  Medal,
  LayoutGrid,
  ListTree,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Player {
  name: string;
  seed: string;
  division: string;
  score?: string;
  isWinner: boolean;
  isChampion?: boolean;
}

interface Match {
  id: string;
  title: string;
  divisionMatchup: string;
  p1: Player;
  p2: Player;
  advancesTo: string;
  winnerName: string;
}

// ─── TOURNAMENT DATA ─────────────────────────────────────────────────────────

const QF1_MATCH: Match = {
  id: "qf1",
  title: "Quarterfinal 1",
  divisionMatchup: "Midtown vs Buckhead",
  p1: { name: "Alex Mercer", seed: "1", division: "Midtown #1", score: "6-3, 6-4", isWinner: true },
  p2: { name: "Marcus Vance", seed: "2", division: "Buckhead #2", isWinner: false },
  advancesTo: "Semifinal 1",
  winnerName: "Alex Mercer",
};

const QF2_MATCH: Match = {
  id: "qf2",
  title: "Quarterfinal 2",
  divisionMatchup: "Decatur vs Brookhaven",
  p1: { name: "David Chen", seed: "1", division: "Decatur #1", score: "4-6, 6-2, [10-7]", isWinner: true },
  p2: { name: "Julian Brooks", seed: "2", division: "Brookhaven #2", isWinner: false },
  advancesTo: "Semifinal 1",
  winnerName: "David Chen",
};

const QF3_MATCH: Match = {
  id: "qf3",
  title: "Quarterfinal 3",
  divisionMatchup: "Midtown vs East Atlanta",
  p1: { name: "Elena Rostova", seed: "2", division: "Midtown #2", score: "6-2, 6-1", isWinner: true },
  p2: { name: "Nathaniel Price", seed: "1", division: "East #1", isWinner: false },
  advancesTo: "Semifinal 2",
  winnerName: "Elena Rostova",
};

const QF4_MATCH: Match = {
  id: "qf4",
  title: "Quarterfinal 4",
  divisionMatchup: "North Atlanta vs Westside",
  p1: { name: "Chloe Bennett", seed: "1", division: "North #1", score: "7-5, 6-3", isWinner: true },
  p2: { name: "Tariq Mitchell", seed: "2", division: "West #2", isWinner: false },
  advancesTo: "Semifinal 2",
  winnerName: "Chloe Bennett",
};

const QF_MATCHES: Match[] = [QF1_MATCH, QF2_MATCH, QF3_MATCH, QF4_MATCH];

const SF1_MATCH: Match = {
  id: "sf1",
  title: "Semifinal 1",
  divisionMatchup: "Left Bracket Championship",
  p1: { name: "Alex Mercer", seed: "1", division: "Midtown #1", score: "6-4, 7-6(5)", isWinner: true },
  p2: { name: "David Chen", seed: "1", division: "Decatur #1", isWinner: false },
  advancesTo: "Championship Final",
  winnerName: "Alex Mercer",
};

const SF2_MATCH: Match = {
  id: "sf2",
  title: "Semifinal 2",
  divisionMatchup: "Right Bracket Championship",
  p1: { name: "Elena Rostova", seed: "2", division: "Midtown #2", score: "6-3, 3-6, [10-8]", isWinner: true },
  p2: { name: "Chloe Bennett", seed: "1", division: "North #1", isWinner: false },
  advancesTo: "Championship Final",
  winnerName: "Elena Rostova",
};

const SF_MATCHES: Match[] = [SF1_MATCH, SF2_MATCH];

const FINAL_MATCH = {
  p1: { name: "Alex Mercer", seed: "1", division: "Midtown #1", score: "6-4, 4-6, [10-6]", isWinner: true, isChampion: true },
  p2: { name: "Elena Rostova", seed: "2", division: "Midtown #2", isWinner: false },
  venue: "Bitsy Grant Tennis Center (Center Court)",
};

const THIRD_PLACE_MATCH: Match = {
  id: "3rd",
  title: "Third Place Playoff",
  divisionMatchup: "Semifinal Runners-Up",
  p1: { name: "David Chen", seed: "1", division: "Decatur #1 · 3rd Place", score: "6-3, 6-4", isWinner: true },
  p2: { name: "Chloe Bennett", seed: "1", division: "North #1 · 4th Place", isWinner: false },
  advancesTo: "Bronze Finish",
  winnerName: "David Chen",
};

// ─── COMPONENT: TREE PLAYER CARD (FOR DESKTOP TREE CHART) ───────────────────

function TreeCard({ player }: { player: Player }) {
  const { name, seed, score, isWinner, isChampion } = player;
  return (
    <div
      className={cn(
        "flex h-[38px] w-full items-center justify-between rounded-lg px-2 text-[11px] transition-all",
        isChampion
          ? "border-2 border-primary bg-gradient-to-r from-primary/20 via-amber-500/15 to-primary/10 shadow-xs ring-1 ring-primary/30"
          : isWinner
            ? "border border-primary/60 bg-card font-semibold text-foreground shadow-xs ring-1 ring-primary/20"
            : "border border-border/70 bg-muted/20 text-muted-foreground opacity-75"
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold font-mono",
            isChampion
              ? "bg-amber-500 text-white"
              : isWinner
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground border border-border"
          )}
        >
          {seed}
        </span>
        <span className="truncate font-semibold">{name}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-1">
        {score && (
          <span
            className={cn(
              "font-mono text-[9px] px-1 rounded",
              isWinner ? "text-primary font-bold bg-primary/10" : "text-muted-foreground"
            )}
          >
            {score}
          </span>
        )}
        {isChampion ? (
          <span className="rounded bg-amber-500 text-white px-1 py-0.5 text-[8px] font-bold leading-none">
            🏆
          </span>
        ) : isWinner ? (
          <Check className="size-2.5 text-primary stroke-[3]" />
        ) : null}
      </div>
    </div>
  );
}

// ─── COMPONENT: MOBILE VERTICAL MATCH CARD ───────────────────────────────────

function MobileVerticalMatch({
  match,
  isFinal = false,
}: {
  match: Match;
  isFinal?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-all shadow-xs",
        isFinal
          ? "border-2 border-primary/60 bg-gradient-to-b from-primary/10 via-amber-500/5 to-card shadow-md"
          : "border-border bg-card"
      )}
    >
      {/* Match Header */}
      <div className="flex items-center justify-between text-xs pb-2.5 mb-2.5 border-b border-border/60">
        <span className="font-bold text-foreground flex items-center gap-1.5">
          {isFinal && <Trophy className="size-3.5 text-amber-500" />}
          {match.title}
        </span>
        <span className="text-[11px] text-muted-foreground">{match.divisionMatchup}</span>
      </div>

      {/* Player 1 Card */}
      <div className="space-y-2">
        <div
          className={cn(
            "flex items-center justify-between rounded-xl p-3 transition-all",
            match.p1.isChampion
              ? "border-2 border-primary bg-gradient-to-r from-primary/20 via-amber-500/15 to-primary/10 ring-2 ring-primary/30"
              : match.p1.isWinner
                ? "border border-primary/60 bg-primary/5 text-foreground ring-1 ring-primary/20"
                : "border border-border/70 bg-muted/20 text-muted-foreground opacity-75"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold font-mono",
                match.p1.isChampion
                  ? "bg-amber-500 text-white"
                  : match.p1.isWinner
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground border border-border"
              )}
            >
              {match.p1.seed}
            </span>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate flex items-center gap-1.5">
                <span>{match.p1.name}</span>
                {match.p1.isChampion && (
                  <span className="rounded bg-amber-500 text-white px-1.5 py-0.5 text-[9px] font-extrabold flex items-center gap-0.5">
                    <Trophy className="size-2.5" /> CHAMPION
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{match.p1.division}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {match.p1.score && (
              <span
                className={cn(
                  "font-mono text-xs font-bold px-2 py-0.5 rounded",
                  match.p1.isWinner
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {match.p1.score}
              </span>
            )}
            {match.p1.isWinner && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3 stroke-[3]" />
              </span>
            )}
          </div>
        </div>

        {/* Player 2 Card */}
        <div
          className={cn(
            "flex items-center justify-between rounded-xl p-3 transition-all",
            match.p2.isWinner
              ? "border border-primary/60 bg-primary/5 text-foreground ring-1 ring-primary/20"
              : "border border-border/70 bg-muted/20 text-muted-foreground opacity-75"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold font-mono",
                match.p2.isWinner
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground border border-border"
              )}
            >
              {match.p2.seed}
            </span>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{match.p2.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{match.p2.division}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {match.p2.score && (
              <span
                className={cn(
                  "font-mono text-xs font-bold px-2 py-0.5 rounded",
                  match.p2.isWinner
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {match.p2.score}
              </span>
            )}
            {match.p2.isWinner && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3 stroke-[3]" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Advancement Indicator Stem */}
      {!isFinal && (
        <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-border/50 text-muted-foreground">
          <div className="flex items-center gap-1.5 font-semibold text-primary">
            <Check className="size-3.5 stroke-[2.5]" />
            <span>{match.winnerName} advances to {match.advancesTo}</span>
          </div>
          <ChevronDown className="size-3.5 text-primary/60 animate-bounce" />
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export function PlayoffBracket() {
  // Mobile defaults to vertical flow, desktop defaults to tree chart
  const [viewMode, setViewMode] = useState<"tree" | "vertical">("tree");
  const [roundFilter, setRoundFilter] = useState<"all" | "qf" | "sf" | "final">("all");

  useEffect(() => {
    // Detect mobile viewport on initial mount
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("vertical");
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-8 shadow-sm">
        {/* Title, Badge & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Playoff Bracket Demonstration
              </h2>
              <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold">
                Future Concept - Not Included in V1
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Preview of future post-season playoff progression. Playoff automation and brackets are not included in V1.
            </p>
          </div>

          {/* Toggle between Tree Chart and Vertical View */}
          <div className="flex items-center gap-1 self-start sm:self-auto bg-muted/60 p-1 rounded-xl border border-border/80 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("vertical")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all",
                viewMode === "vertical"
                  ? "bg-background text-primary shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="size-3.5" />
              <span>Vertical Flow</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all",
                viewMode === "tree"
                  ? "bg-background text-primary shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListTree className="size-3.5" />
              <span>Tree Chart</span>
            </button>
          </div>
        </div>


        {/* ════════════════════════════════════════════════════════════════════
            VIEW 1: VERTICAL FLOW (TAILORED SPECIALLY FOR MOBILE & PHONES)
            ════════════════════════════════════════════════════════════════════ */}
        {viewMode === "vertical" ? (
          <div className="space-y-6">
            {/* Grand Trophy & Champion Hero Card */}
            <div className="rounded-2xl border-2 border-primary/50 bg-gradient-to-br from-primary/15 via-amber-500/10 to-primary/5 p-5 text-center shadow-sm">
              <div className="size-14 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 shadow-sm mb-2">
                <Trophy className="size-7 text-amber-500" />
              </div>
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                2026 Atlanta City Championship
              </div>
              <h3 className="text-lg font-extrabold text-foreground mt-0.5">
                Tournament Winner Crowned
              </h3>

              <div className="mt-4 max-w-sm mx-auto bg-card/80 backdrop-blur-xs rounded-xl border border-primary/30 p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">1</span>
                    <span className="font-extrabold text-sm text-foreground">Alex Mercer</span>
                  </div>
                  <span className="rounded bg-primary text-primary-foreground px-2 py-0.5 text-xs font-bold flex items-center gap-1 shadow-xs">
                    <Trophy className="size-3" /> CHAMPION
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Score: <strong className="font-mono text-foreground">6-4, 4-6, [10-6]</strong></span>
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3 text-primary" /> Bitsy Grant TC
                  </span>
                </div>
              </div>
            </div>

            {/* Round Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
              <button
                type="button"
                onClick={() => setRoundFilter("all")}
                className={cn(
                  "px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-colors",
                  roundFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                All Rounds (8)
              </button>
              <button
                type="button"
                onClick={() => setRoundFilter("qf")}
                className={cn(
                  "px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-colors",
                  roundFilter === "qf"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                Quarterfinals (4)
              </button>
              <button
                type="button"
                onClick={() => setRoundFilter("sf")}
                className={cn(
                  "px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-colors",
                  roundFilter === "sf"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                Semifinals (2)
              </button>
              <button
                type="button"
                onClick={() => setRoundFilter("final")}
                className={cn(
                  "px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-colors",
                  roundFilter === "final"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                Finals (2)
              </button>
            </div>

            {/* Quarterfinals Section */}
            {(roundFilter === "all" || roundFilter === "qf") && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Round 1 · Quarterfinals
                  </h4>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {QF_MATCHES.map((match) => (
                    <MobileVerticalMatch key={match.id} match={match} />
                  ))}
                </div>
              </div>
            )}

            {/* Semifinals Section */}
            {(roundFilter === "all" || roundFilter === "sf") && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Round 2 · Semifinals
                  </h4>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SF_MATCHES.map((match) => (
                    <MobileVerticalMatch key={match.id} match={match} />
                  ))}
                </div>
              </div>
            )}

            {/* Finals Section */}
            {(roundFilter === "all" || roundFilter === "final") && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Trophy className="size-3.5 text-amber-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    City Championship Final & Third Place
                  </h4>
                </div>
                <div className="space-y-3">
                  <MobileVerticalMatch
                    match={{
                      id: "final-match",
                      title: "City Championship Final",
                      divisionMatchup: "Bitsy Grant Center Court",
                      p1: FINAL_MATCH.p1,
                      p2: FINAL_MATCH.p2,
                      advancesTo: "Champion Crowned",
                      winnerName: "Alex Mercer",
                    }}
                    isFinal={true}
                  />

                  <MobileVerticalMatch match={THIRD_PLACE_MATCH} />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ════════════════════════════════════════════════════════════════════
             VIEW 2: TREE CHART (VERTICAL ON MOBILE, BILATERAL ON DESKTOP)
             ════════════════════════════════════════════════════════════════════ */
          <div>
            {/* ─── MOBILE VERTICAL TREE (< md) ─── */}
            <div className="block md:hidden space-y-4">
              {/* Legend Row */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/60">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary" />
                  <span className="font-semibold text-foreground text-[11px]">Advancing Winner Line</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-border" />
                  <span className="text-[11px]">Match Bracket</span>
                </div>
              </div>

              {/* ─── SECTION 1: LEFT CONFERENCE BRACKET ─── */}
              <div className="rounded-2xl border border-border bg-card/60 p-3 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/50">
                  <span>Left Bracket · Quarterfinals</span>
                  <span className="text-primary font-mono">Round 1</span>
                </div>

                {/* 2 QF Matches side-by-side */}
                <div className="grid grid-cols-2 gap-2">
                  {/* QF 1 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground px-0.5">
                      <span>QF 1</span>
                      <span className="text-primary font-mono">FINAL</span>
                    </div>
                    <TreeCard player={QF1_MATCH.p1} />
                    <TreeCard player={QF1_MATCH.p2} />
                  </div>

                  {/* QF 2 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground px-0.5">
                      <span>QF 2</span>
                      <span className="text-primary font-mono">FINAL</span>
                    </div>
                    <TreeCard player={QF2_MATCH.p1} />
                    <TreeCard player={QF2_MATCH.p2} />
                  </div>
                </div>

                {/* SVG Connector merging QF 1 & QF 2 down into SF 1 */}
                <svg className="w-full h-7" viewBox="0 0 100 28" preserveAspectRatio="none" fill="none">
                  {/* Left branch from QF 1 (Alex Mercer - Winner) */}
                  <path
                    d="M 25 0 V 14 H 50"
                    stroke="currentColor"
                    className="text-primary"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Right branch from QF 2 (David Chen - Winner) */}
                  <path
                    d="M 75 0 V 14 H 50"
                    stroke="currentColor"
                    className="text-primary"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Trunk entering SF 1 */}
                  <path
                    d="M 50 14 V 28"
                    stroke="currentColor"
                    className="text-primary"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Semifinal 1 Match Card */}
                <div className="max-w-[280px] mx-auto space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-primary px-0.5">
                    <span>SEMIFINAL 1</span>
                    <span className="font-mono text-[9px]">LEFT FINAL</span>
                  </div>
                  <TreeCard player={SF1_MATCH.p1} />
                  <TreeCard player={SF1_MATCH.p2} />
                  <div className="text-[10px] text-primary font-semibold flex items-center justify-center gap-1 pt-0.5">
                    <Check className="size-3 stroke-[3]" />
                    <span>Alex Mercer advances to City Championship</span>
                  </div>
                </div>
              </div>

              {/* Vertical connector stem */}
              <div className="flex justify-center">
                <div className="w-0.5 h-4 bg-primary" />
              </div>

              {/* ─── SECTION 2: RIGHT CONFERENCE BRACKET ─── */}
              <div className="rounded-2xl border border-border bg-card/60 p-3 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/50">
                  <span>Right Bracket · Quarterfinals</span>
                  <span className="text-primary font-mono">Round 1</span>
                </div>

                {/* 2 QF Matches side-by-side */}
                <div className="grid grid-cols-2 gap-2">
                  {/* QF 3 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground px-0.5">
                      <span>QF 3</span>
                      <span className="text-primary font-mono">FINAL</span>
                    </div>
                    <TreeCard player={QF3_MATCH.p1} />
                    <TreeCard player={QF3_MATCH.p2} />
                  </div>

                  {/* QF 4 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground px-0.5">
                      <span>QF 4</span>
                      <span className="text-primary font-mono">FINAL</span>
                    </div>
                    <TreeCard player={QF4_MATCH.p1} />
                    <TreeCard player={QF4_MATCH.p2} />
                  </div>
                </div>

                {/* SVG Connector merging QF 3 & QF 4 down into SF 2 */}
                <svg className="w-full h-7" viewBox="0 0 100 28" preserveAspectRatio="none" fill="none">
                  {/* Left branch from QF 3 (Elena Rostova - Winner) */}
                  <path
                    d="M 25 0 V 14 H 50"
                    stroke="currentColor"
                    className="text-primary"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Right branch from QF 4 (Chloe Bennett - Winner) */}
                  <path
                    d="M 75 0 V 14 H 50"
                    stroke="currentColor"
                    className="text-primary"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Trunk entering SF 2 */}
                  <path
                    d="M 50 14 V 28"
                    stroke="currentColor"
                    className="text-primary"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Semifinal 2 Match Card */}
                <div className="max-w-[280px] mx-auto space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-primary px-0.5">
                    <span>SEMIFINAL 2</span>
                    <span className="font-mono text-[9px]">RIGHT FINAL</span>
                  </div>
                  <TreeCard player={SF2_MATCH.p1} />
                  <TreeCard player={SF2_MATCH.p2} />
                  <div className="text-[10px] text-primary font-semibold flex items-center justify-center gap-1 pt-0.5">
                    <Check className="size-3 stroke-[3]" />
                    <span>Elena Rostova advances to City Championship</span>
                  </div>
                </div>
              </div>

              {/* Vertical connector stem */}
              <div className="flex justify-center">
                <div className="w-0.5 h-4 bg-primary" />
              </div>

              {/* ─── SECTION 3: CITY CHAMPIONSHIP FINAL & 3RD PLACE ─── */}
              <div className="rounded-2xl border-2 border-primary/50 bg-gradient-to-b from-primary/10 via-amber-500/5 to-card p-4 space-y-3.5 shadow-sm">
                {/* Finalists Header */}
                <div className="text-center">
                  <div className="size-10 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 shadow-sm mb-1.5">
                    <Trophy className="size-5 text-amber-500" />
                  </div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    City Championship Final
                  </div>
                  <div className="text-xs font-bold text-foreground mt-0.5">
                    Alex Mercer vs Elena Rostova
                  </div>
                </div>

                {/* Connector into Final Cards */}
                <svg className="w-full h-5" viewBox="0 0 100 20" preserveAspectRatio="none" fill="none">
                  <path
                    d="M 50 0 V 20"
                    stroke="currentColor"
                    className="text-primary"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Final Match Cards */}
                <div className="max-w-[280px] mx-auto space-y-1.5">
                  <TreeCard player={FINAL_MATCH.p1} />
                  <TreeCard player={FINAL_MATCH.p2} />
                  <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 pt-1">
                    <MapPin className="size-3 text-primary shrink-0" />
                    <span>Bitsy Grant TC (Center Court)</span>
                  </div>
                </div>

                {/* Divider stem to 3rd Place */}
                <div className="w-0.5 h-5 bg-border mx-auto" />

                {/* Third Place Match */}
                <div className="max-w-[280px] mx-auto space-y-1 pt-1 border-t border-border/50">
                  <div className="text-center mb-1">
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Medal className="size-3 text-amber-600" />
                      Third Place Playoff
                    </span>
                  </div>
                  <TreeCard player={THIRD_PLACE_MATCH.p1} />
                  <TreeCard player={THIRD_PLACE_MATCH.p2} />
                </div>
              </div>
            </div>

            {/* ─── DESKTOP BILATERAL TREE (≥ md, UNTOUCHED AND UNCHANGED) ─── */}
            <div className="hidden md:block overflow-x-auto no-scrollbar py-2">
              <div className="min-w-[980px] w-[980px] mx-auto">
                {/* Legend Row */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pb-3 mb-2 border-b border-border/60">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full bg-primary" />
                      <span className="font-semibold text-foreground">Advancing Winner Line</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full bg-border" />
                      <span>Eliminated Bracket</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Bilateral Tree: Left & Right brackets advance inwards to Center Final
                  </span>
                </div>

                {/* Column Headings */}
                <div className="grid grid-cols-[160px_40px_160px_45px_170px_45px_160px_40px_160px] text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  <div>Quarterfinals</div>
                  <div />
                  <div>Semifinals</div>
                  <div />
                  <div className="text-primary font-extrabold">Final & 3rd Place</div>
                  <div />
                  <div>Semifinals</div>
                  <div />
                  <div>Quarterfinals</div>
                </div>

                {/* Tree Canvas: Height 330px */}
                <div className="relative w-[980px] h-[330px]">
                  {/* ─── COLUMN 1: LEFT QUARTERFINALS (x=0, w=160) ─── */}
                  <div className="absolute left-0 top-[20px] w-[160px] space-y-[6px]">
                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground px-1">
                      <span>QF 1</span>
                      <span className="text-primary font-mono">FINAL</span>
                    </div>
                    <TreeCard player={QF1_MATCH.p1} />
                    <TreeCard player={QF1_MATCH.p2} />
                  </div>

                  <div className="absolute left-0 top-[170px] w-[160px] space-y-[6px]">
                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground px-1">
                      <span>QF 2</span>
                      <span className="text-primary font-mono">FINAL</span>
                    </div>
                    <TreeCard player={QF2_MATCH.p1} />
                    <TreeCard player={QF2_MATCH.p2} />
                  </div>

                  {/* ─── CONNECTOR 1: Left QF -> Left SF (x=160, w=40) ─── */}
                  <svg className="absolute left-[160px] top-0 w-[40px] h-[330px]" viewBox="0 0 40 330" fill="none">
                    {/* QF 1 connector */}
                    {/* Loser Marcus Vance at y=83 */}
                    <path d="M 0 83 H 16" stroke="currentColor" className="text-border dark:text-border/70" strokeWidth="1.5" />
                    {/* Winner Alex Mercer at y=39 down to midpoint 61, down to SF1 Card 1 at y=114 */}
                    <path
                      d="M 0 39 H 16 V 61 H 28 V 114 H 40"
                      stroke="currentColor"
                      className="text-primary"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* QF 2 connector */}
                    {/* Loser Julian Brooks at y=233 */}
                    <path d="M 0 233 H 16" stroke="currentColor" className="text-border dark:text-border/70" strokeWidth="1.5" />
                    {/* Winner David Chen at y=189 down to midpoint 211, up to SF1 Card 2 at y=158 */}
                    <path
                      d="M 0 189 H 16 V 211 H 28 V 158 H 40"
                      stroke="currentColor"
                      className="text-primary"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  {/* ─── COLUMN 2: LEFT SEMIFINALS (x=200, w=160) ─── */}
                  <div className="absolute left-[200px] top-[95px] w-[160px] space-y-[6px]">
                    <div className="flex justify-between text-[9px] font-bold text-primary px-1">
                      <span>SF 1</span>
                      <span className="font-mono">SEMIFINAL</span>
                    </div>
                    <TreeCard player={SF1_MATCH.p1} />
                    <TreeCard player={SF1_MATCH.p2} />
                  </div>

                  {/* ─── CONNECTOR 2: Left SF -> Center Final (x=360, w=45) ─── */}
                  <svg className="absolute left-[360px] top-0 w-[45px] h-[330px]" viewBox="0 0 45 330" fill="none">
                    {/* Loser David Chen at y=158 */}
                    <path d="M 0 158 H 20" stroke="currentColor" className="text-border dark:text-border/70" strokeWidth="1.5" />
                    {/* Winner Alex Mercer at y=114 to midpoint 136 into Final */}
                    <path
                      d="M 0 114 H 20 V 136 H 45"
                      stroke="currentColor"
                      className="text-primary"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  {/* ─── COLUMN 3: CENTER FINAL & 3RD PLACE (x=405, w=170) ─── */}
                  {/* Trophy & Badge at top */}
                  <div className="absolute left-[405px] top-[14px] w-[170px] text-center">
                    <div className="size-8 mx-auto rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-500 shadow-xs mb-1">
                      <Trophy className="size-4" />
                    </div>
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                      Championship Final
                    </span>
                  </div>

                  {/* Final Match Cards */}
                  <div className="absolute left-[405px] top-[88px] w-[170px] space-y-[6px]">
                    <TreeCard player={FINAL_MATCH.p1} />
                    <TreeCard player={FINAL_MATCH.p2} />
                    <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-1 pt-0.5">
                      <MapPin className="size-2.5 text-primary shrink-0" />
                      <span className="truncate">Bitsy Grant TC (Center Court)</span>
                    </div>
                  </div>

                  {/* Divider Line into 3rd Place */}
                  <div className="absolute left-[489px] top-[214px] w-[2px] h-[16px] bg-border" />

                  {/* Third Place Match */}
                  <div className="absolute left-[405px] top-[232px] w-[170px] space-y-[4px]">
                    <div className="text-center">
                      <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Medal className="size-2.5 text-amber-600" />
                        Third Place Playoff
                      </span>
                    </div>
                    <TreeCard player={THIRD_PLACE_MATCH.p1} />
                    <TreeCard player={THIRD_PLACE_MATCH.p2} />
                  </div>

                  {/* ─── CONNECTOR 3: Right SF -> Center Final (x=575, w=45) ─── */}
                  <svg className="absolute left-[575px] top-0 w-[45px] h-[330px]" viewBox="0 0 45 330" fill="none">
                    {/* Loser Chloe Bennett at y=158 */}
                    <path d="M 45 158 H 25" stroke="currentColor" className="text-border dark:text-border/70" strokeWidth="1.5" />
                    {/* Winner Elena Rostova at y=114 to midpoint 136 into Final */}
                    <path
                      d="M 45 114 H 25 V 136 H 0"
                      stroke="currentColor"
                      className="text-primary"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  {/* ─── COLUMN 4: RIGHT SEMIFINALS (x=620, w=160) ─── */}
                  <div className="absolute left-[620px] top-[95px] w-[160px] space-y-[6px]">
                    <div className="flex justify-between text-[9px] font-bold text-primary px-1">
                      <span className="font-mono">SEMIFINAL</span>
                      <span>SF 2</span>
                    </div>
                    <TreeCard player={SF2_MATCH.p1} />
                    <TreeCard player={SF2_MATCH.p2} />
                  </div>

                  {/* ─── CONNECTOR 4: Right QF -> Right SF (x=780, w=40) ─── */}
                  <svg className="absolute left-[780px] top-0 w-[40px] h-[330px]" viewBox="0 0 40 330" fill="none">
                    {/* QF 3 connector */}
                    {/* Loser Nathaniel Price at y=83 */}
                    <path d="M 40 83 H 24" stroke="currentColor" className="text-border dark:text-border/70" strokeWidth="1.5" />
                    {/* Winner Elena Rostova at y=39 down to midpoint 61, down to SF2 Card 1 at y=114 */}
                    <path
                      d="M 40 39 H 24 V 61 H 12 V 114 H 0"
                      stroke="currentColor"
                      className="text-primary"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* QF 4 connector */}
                    {/* Loser Tariq Mitchell at y=233 */}
                    <path d="M 40 233 H 24" stroke="currentColor" className="text-border dark:text-border/70" strokeWidth="1.5" />
                    {/* Winner Chloe Bennett at y=189 down to midpoint 211, up to SF2 Card 2 at y=158 */}
                    <path
                      d="M 40 189 H 24 V 211 H 12 V 158 H 0"
                      stroke="currentColor"
                      className="text-primary"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  {/* ─── COLUMN 5: RIGHT QUARTERFINALS (x=820, w=160) ─── */}
                  <div className="absolute left-[820px] top-[20px] w-[160px] space-y-[6px]">
                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground px-1">
                      <span className="text-primary font-mono">FINAL</span>
                      <span>QF 3</span>
                    </div>
                    <TreeCard player={QF3_MATCH.p1} />
                    <TreeCard player={QF3_MATCH.p2} />
                  </div>

                  <div className="absolute left-[820px] top-[170px] w-[160px] space-y-[6px]">
                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground px-1">
                      <span className="text-primary font-mono">FINAL</span>
                      <span>QF 4</span>
                    </div>
                    <TreeCard player={QF4_MATCH.p1} />
                    <TreeCard player={QF4_MATCH.p2} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
