import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Settings,
  LogOut,
  CheckCircle,
  Clock,
  CalendarDays,
  MapPin,
  Trophy,
  Activity,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  User,
  PlusCircle,
  Eye,
  Check,
  FileText,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { BallLoader } from "@/components/tennis-ball";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateRange, formatMoney, FORMAT_LABELS, type League, type Match, type MatchResult } from "@/lib/tennis";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const {
    hydrated,
    user,
    players,
    registrations,
    leagues,
    seasons,
    matches,
    results,
    logout,
    matchesForPlayer,
    statsForPlayer,
    resultsForPlayer,
    submitMatchScore,
  } = useStore();

  const [reportModalMatch, setReportModalMatch] = React.useState<Match | null>(null);
  const [fullStatsOpen, setFullStatsOpen] = React.useState(false);

  // Score form state
  const [set1Player, setSet1Player] = React.useState("6");
  const [set1Opponent, setSet1Opponent] = React.useState("4");
  const [set2Player, setSet2Player] = React.useState("6");
  const [set2Opponent, setSet2Opponent] = React.useState("3");
  const [hasSet3, setHasSet3] = React.useState(false);
  const [set3Player, setSet3Player] = React.useState("10");
  const [set3Opponent, setSet3Opponent] = React.useState("7");
  const [winnerChoice, setWinnerChoice] = React.useState<"player" | "opponent">("player");

  const navigate = useNavigate();

  React.useEffect(() => {
    if (hydrated && user?.role === "organizer") {
      navigate({ to: "/organizer" });
    }
  }, [hydrated, user, navigate]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <BallLoader label="Loading player dashboard..." />
      </div>
    );
  }

  if (user?.role === "organizer") {
    return null;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl font-bold">Please sign in to view your dashboard</h1>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/login" search={{ leagueId: undefined }}>Sign In</Link>
        </Button>
      </div>
    );
  }

  const currentPlayer = players.find(
    (p) => p.id === user.playerId || p.email.toLowerCase() === user.email.toLowerCase(),
  ) || {
    id: user.playerId || "p-demo-player",
    firstName: user.name.split(" ")[0] || "Player",
    lastName: user.name.split(" ")[1] || "",
    email: user.email,
    phone: "(404) 555-0100",
    ntrp: "3.5" as const,
    city: "Atlanta",
    preferredCourt: "Piedmont Park Courts",
  };

  const myRegistrations = registrations.filter(
    (r) => r.playerId === user.playerId || (currentPlayer && r.playerId === currentPlayer.id),
  );

  const myMatches = currentPlayer ? matchesForPlayer(currentPlayer.id) : [];
  const stats = currentPlayer ? statsForPlayer(currentPlayer.id) : { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0 };
  const myResults = currentPlayer ? resultsForPlayer(currentPlayer.id) : [];

  const getLeagueDetails = (leagueId: string) => {
    const league = leagues.find((l) => l.id === leagueId);
    const season = seasons.find((s) => s.id === league?.seasonId);
    return { league, season };
  };

  const handleOpenScoreModal = (m: Match) => {
    setReportModalMatch(m);
    setSet1Player("6");
    setSet1Opponent("4");
    setSet2Player("6");
    setSet2Opponent("3");
    setHasSet3(false);
    setSet3Player("10");
    setSet3Opponent("7");
    setWinnerChoice("player");
  };

  const handleSubmitScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportModalMatch) return;

    let scoreStr = `${set1Player}-${set1Opponent}, ${set2Player}-${set2Opponent}`;
    if (hasSet3) {
      scoreStr += `, ${set3Player}-${set3Opponent}`;
    }

    const winnerId = winnerChoice === "player" ? currentPlayer.id : (reportModalMatch.opponentId || "opponent");

    submitMatchScore({
      matchId: reportModalMatch.id,
      submittedBy: currentPlayer.id,
      scoreData: scoreStr,
      winnerId,
      role: "player",
    });

    toast.success("Match score submitted! It is now awaiting league organizer verification.");
    setReportModalMatch(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header with Player ID and Name */}
      <div className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome back, {currentPlayer.firstName}!
            </h1>
            <span className="inline-flex items-center gap-1 rounded font-mono text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 border border-border/40">
              <User className="size-3 text-muted-foreground/70" />
              <span>ID: {currentPlayer.id}</span>
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage your registered leagues, confirmed entries, and player profile.
          </p>
        </div>

      </div>

      {/* Main Grid */}
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* Left Column: Registered Leagues & Match Schedule */}
        <div className="space-y-8 lg:col-span-2">
          {/* Registered Leagues */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">My Leagues</h2>
                <p className="text-xs text-muted-foreground">Competitions you are registered in</p>
              </div>
              <Button asChild variant="link" size="sm" className="text-primary font-semibold">
                <Link to="/leagues">Browse more leagues</Link>
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              {myRegistrations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
                    <Activity className="size-6" />
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-foreground">No active registrations</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Discover open leagues across metro Atlanta and begin your registration today.
                  </p>
                  <Button asChild className="mt-5 rounded-full" size="sm">
                    <Link to="/leagues">Find a league</Link>
                  </Button>
                </div>
              ) : (
                myRegistrations.map((reg) => {
                  const { league, season } = getLeagueDetails(reg.leagueId);
                  if (!league) return null;

                  const status = reg.registrationStatus || "confirmed";
                  const isPaid = reg.paymentStatus === "paid" || reg.paymentStatus === "succeeded";

                  return (
                    <div
                      key={reg.id}
                      className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                            {season?.name || "Fall 2026"}
                          </span>
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary uppercase">
                            {FORMAT_LABELS[league.format]}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            NTRP {reg.skillLevelSnapshot || league.skillLevel}
                          </span>
                          {isPaid ? (
                            <span className="inline-flex items-center text-xs font-semibold text-emerald-600">
                              <CheckCircle className="mr-1 size-3.5" />
                              {status === "confirmed" ? "Confirmed" : "Awaiting Placement"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs font-semibold text-amber-600">
                              <Clock className="mr-1 size-3.5" /> Payment Pending
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                          <Link to="/leagues/$leagueId" params={{ leagueId: league.id }}>
                            {league.name}
                          </Link>
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="size-3.5 text-primary" />
                            {league.scheduleDay}s at {league.scheduleTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3.5 text-primary" />
                            {league.venue}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                        <Button asChild variant="outline" size="sm" className="rounded-full text-xs">
                          <Link to="/leagues/$leagueId" params={{ leagueId: league.id }}>
                            View league <ChevronRight className="ml-1 size-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Match Fixture Section (Future Concept outside V1) */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">Season Match Play</h2>
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    Future Concept - Not Included in V1
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Preview of post-registration match fixtures and scoring (scheduled for V2)</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {myMatches.length > 0 ? (
                myMatches.map((m) => {
                  const matchResult = results.find((r) => r.matchId === m.id);
                  const isCompleted = m.matchStatus === "completed" || matchResult?.status === "accepted";
                  const isFullyScheduled =
                    m.matchStatus === "scheduled" &&
                    !!m.opponentName &&
                    !!m.matchDate &&
                    !!m.matchTime &&
                    !!m.court &&
                    !!m.homeAway;
                  const isSchedulingRequired =
                    m.matchStatus === "scheduling-required" ||
                    (m.matchStatus !== "opponent-assigned" && !isCompleted && !isFullyScheduled && !!m.opponentName);
                  const isOpponentAssignedOnly = m.matchStatus === "opponent-assigned" && !isFullyScheduled;

                  return (
                    <div
                      key={m.id}
                      className="overflow-hidden rounded-2xl border border-primary/30 bg-card p-6 shadow-sm transition-all hover:border-primary/50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                        <div className="flex items-center gap-2">
                          {/* STATE 6: Completed */}
                          {isCompleted && (
                            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                              Completed Match
                            </span>
                          )}

                          {/* STATE 5: Scheduled */}
                          {!isCompleted && isFullyScheduled && (
                            <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
                              Scheduled
                            </span>
                          )}

                          {/* STATE 4: Scheduling Required */}
                          {!isCompleted && !isFullyScheduled && isSchedulingRequired && (
                            <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                              Scheduling Required
                            </span>
                          )}

                          {/* STATE 3: Opponent Assigned */}
                          {!isCompleted && !isFullyScheduled && isOpponentAssignedOnly && (
                            <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                              Opponent Assigned
                            </span>
                          )}

                          {m.homeAway && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold capitalize text-secondary-foreground">
                              {m.homeAway === "home" ? "Home Player" : "Away Player"}
                            </span>
                          )}
                        </div>

                        {/* Status badge */}
                        {matchResult ? (
                          matchResult.status === "awaiting-confirmation" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700">
                              <Clock className="size-3.5" />
                              Awaiting Organizer Verification
                            </span>
                          ) : matchResult.status === "accepted" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700">
                              <CheckCircle className="size-3.5" />
                              Official Result Confirmed
                            </span>
                          ) : matchResult.status === "disputed" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-bold text-destructive">
                              ⚠️ Result Disputed
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground">
                              Status: <strong className="capitalize text-foreground">{m.matchStatus}</strong>
                            </span>
                          )
                        ) : isFullyScheduled ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                            <Clock className="size-3.5" /> Ready for Play
                          </span>
                        ) : isSchedulingRequired ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                            Action Required
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground">
                            Schedule Pending
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {/* Opponent Block */}
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Opponent
                          </span>
                          <p className="text-base font-bold text-foreground">
                            {m.opponentName || "Opponent Pending"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            NTRP Rating: {m.opponentLevel || "3.5"}
                          </p>
                        </div>

                        {/* Date & Time Block */}
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Date & Time
                          </span>
                          {m.matchDate && m.matchTime ? (
                            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                              <CalendarDays className="size-3.5 text-primary" />
                              {m.matchDate} at {m.matchTime}
                            </p>
                          ) : (
                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                              <CalendarDays className="size-3.5 text-muted-foreground" />
                              Scheduling in progress (Date TBD)
                            </p>
                          )}
                        </div>

                        {/* Court / Location Block */}
                        <div className="sm:col-span-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Match Location & Court
                          </span>
                          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <MapPin className="size-3.5 text-primary" />
                            {m.court || "Court to be confirmed by Home Player"}
                          </p>
                          <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                            <span>
                              <strong>Court arrangement:</strong> Home participant ({m.courtBookingOwner || (m.homeAway === "home" ? `${currentPlayer.firstName} ${currentPlayer.lastName} (Home)` : "Home Player")}) is responsible for arranging court time. Target ~15–20 min travel radius.
                            </span>
                          </div>
                        </div>

                        {/* Action Box for State 4: Scheduling Required */}
                        {!isCompleted && isSchedulingRequired && (
                          <div className="sm:col-span-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                            <strong>Required Next Action:</strong> Coordinate with {m.opponentName || "your opponent"} to finalize your match date, time, and reserve your home court.
                          </div>
                        )}

                        {/* Action Box for State 3: Opponent Assigned */}
                        {!isCompleted && isOpponentAssignedOnly && (
                          <div className="sm:col-span-2 rounded-xl bg-blue-500/10 border border-blue-500/30 p-3.5 text-xs text-blue-900 dark:text-blue-200">
                            <strong>Opponent Assigned:</strong> Your opponent information is shown above. Official scheduling and fixture dates will open shortly.
                          </div>
                        )}

                        {/* Result / Score section on card (State 5 & 6) */}
                        <div className="sm:col-span-2 border-t border-border/60 pt-4">
                          {matchResult ? (
                            <div className="rounded-xl p-3.5 bg-muted/40 border border-border/60 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <span className="text-xs text-muted-foreground">Reported Match Score:</span>
                                  <p className="font-mono text-base font-bold text-foreground mt-0.5">
                                    {matchResult.scoreData}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs text-muted-foreground">Winner:</span>
                                  <p className="text-sm font-bold text-primary">
                                    {matchResult.winnerId === currentPlayer.id ? "You Won" : m.opponentName || "Opponent"}
                                  </p>
                                </div>
                              </div>

                              {matchResult.status === "awaiting-confirmation" && (
                                <p className="text-xs leading-relaxed text-muted-foreground border-t border-border/40 pt-2">
                                  ⏳ <strong>Pending Organizer Review:</strong> This score was submitted by {matchResult.submittedBy === currentPlayer.id ? "you" : "the player"}. It will count toward official stats once verified by the league organizer.
                                </p>
                              )}

                              {matchResult.status === "accepted" && (
                                <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-400 border-t border-border/40 pt-2">
                                  ✓ <strong>Verified Official Result:</strong> Confirmed by league organizer. Official match points and stats are recorded.
                                </p>
                              )}

                              {matchResult.status === "disputed" && (
                                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
                                  <strong>⚠️ Result Disputed by Organizer:</strong> {matchResult.disputeReason || "Score under review."} Disputed results do not contribute to player statistics.
                                </div>
                              )}
                            </div>
                          ) : isFullyScheduled ? (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-secondary/50 rounded-xl p-3.5 border border-border/50">
                              <div>
                                <p className="text-sm font-bold text-foreground">Finished playing this fixture?</p>
                                <p className="text-xs text-muted-foreground">
                                  Enter sets and scores. Results become official once verified by the organizer.
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleOpenScoreModal(m)}
                                className="rounded-full shrink-0 shadow-sm"
                              >
                                <PlusCircle className="mr-1.5 size-3.5" />
                                Enter Match Score
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                (() => {
                  const hasConfirmedReg = myRegistrations.some(
                    (r) => r.registrationStatus === "confirmed" || r.paymentStatus === "paid" || r.paymentStatus === "succeeded"
                  );
                  const hasAwaitingPlacementReg = myRegistrations.some(
                    (r) => r.registrationStatus === "awaiting-review" || r.paymentStatus === "pending"
                  );

                  // STATE 1: Registration confirmed, no match scheduled
                  if (hasConfirmedReg) {
                    return (
                      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                          <CheckCircle className="size-6" />
                        </div>
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-bold text-emerald-700">
                          Registration Confirmed
                        </div>
                        <h3 className="mt-3 text-lg font-bold text-foreground">
                          Your registration is confirmed.
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          League entry confirmed.
                        </p>
                        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                          Your league registration is recorded. Check your registration details and status for the season.
                        </p>
                      </div>
                    );
                  }

                  // STATE 2: Awaiting placement
                  if (hasAwaitingPlacementReg) {
                    return (
                      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                          <Clock className="size-6" />
                        </div>
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-amber-700">
                          Awaiting Placement
                        </div>
                        <h3 className="mt-3 text-lg font-bold text-foreground">
                          Your registration has been received.
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          Registration in progress.
                        </p>
                        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                          The league organizer is currently reviewing registrations and capacity based on skill level and geographic area.
                        </p>
                      </div>
                    );
                  }

                  // Default empty state when not registered
                  return (
                    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
                      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <CalendarDays className="size-6" />
                      </div>
                      <h4 className="mt-3 text-base font-bold text-foreground">No active league registration</h4>
                      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                        Browse open leagues across metro Atlanta and begin your registration today.
                      </p>
                      <Button asChild className="mt-4 rounded-full" size="sm">
                        <Link to="/leagues">Find a league</Link>
                      </Button>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>

        {/* Right Column: My Stats & Profile Details */}
        <div className="space-y-6">
          {/* My Stats Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Trophy className="size-4 text-primary" /> My Stats
              </h3>
              <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[9px] font-bold text-amber-700 uppercase tracking-wider">
                Future Concept
              </span>
            </div>

            {stats.matchesPlayed > 0 ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted/50 p-3 text-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Matches</span>
                    <p className="mt-1 text-2xl font-bold text-foreground">{stats.matchesPlayed}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3 text-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Win Rate</span>
                    <p className="mt-1 text-2xl font-bold text-primary">{stats.winRate}%</p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-3 text-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-700">Wins</span>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.wins}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3 text-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Losses</span>
                    <p className="mt-1 text-2xl font-bold text-muted-foreground">{stats.losses}</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  Based on verified, accepted match results in active seasons.
                </p>
              </div>
            ) : (
              <div className="mt-4 text-center py-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Player match statistics and standings are planned for future league releases.
                </p>
                <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                  V1 includes player profiles, capacity tracking, and confirmed registrations. Match statistics are not included in V1.
                </div>
              </div>
            )}

            {/* View Full Stats Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFullStatsOpen(true)}
              className="mt-4 w-full rounded-full text-xs font-semibold"
            >
              <Eye className="mr-1.5 size-3.5 text-primary" />
              Show Full Stats & Match Results
            </Button>
          </div>

          {/* Profile Overview Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-bold text-foreground">Player Profile</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Player ID</span>
                <span className="font-mono text-xs font-bold text-primary">{currentPlayer.id}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Declared Skill</span>
                <span className="font-semibold text-foreground">
                  NTRP {currentPlayer.ntrp}
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">(Self-declared)</span>
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Preferred Court</span>
                <span className="font-medium text-foreground truncate max-w-[160px]">
                  {currentPlayer.preferredCourt || "Piedmont Park Courts"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">City & Area</span>
                <span className="font-medium text-foreground">{currentPlayer.city || "Atlanta"}</span>
              </div>
            </div>

            <Button asChild variant="outline" size="sm" className="mt-5 w-full rounded-full text-xs">
              <Link to="/profile">Edit Profile & Court</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* POPUP 1: REPORT MATCH SCORE DIALOG */}
      <Dialog open={!!reportModalMatch} onOpenChange={(open) => !open && setReportModalMatch(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="size-5 text-primary" /> Report Match Score
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter your set scores against {reportModalMatch?.opponentName || "Opponent"}. Submitted results require organizer verification before appearing in official stats.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitScore} className="mt-4 space-y-4">
            {/* Set 1 */}
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Set 1</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Your Games</Label>
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    required
                    value={set1Player}
                    onChange={(e) => setSet1Player(e.target.value)}
                    className="h-10 text-center font-bold font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Opponent Games</Label>
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    required
                    value={set1Opponent}
                    onChange={(e) => setSet1Opponent(e.target.value)}
                    className="h-10 text-center font-bold font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Set 2 */}
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Set 2</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Your Games</Label>
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    required
                    value={set2Player}
                    onChange={(e) => setSet2Player(e.target.value)}
                    className="h-10 text-center font-bold font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Opponent Games</Label>
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    required
                    value={set2Opponent}
                    onChange={(e) => setSet2Opponent(e.target.value)}
                    className="h-10 text-center font-bold font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Optional 10-Point Match Tiebreak / Set 3 */}
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Match Tiebreak / Set 3 (If split sets)
                </span>
                <button
                  type="button"
                  onClick={() => setHasSet3(!hasSet3)}
                  className="text-xs font-semibold text-primary underline"
                >
                  {hasSet3 ? "Remove 3rd Set" : "+ Add 3rd Set"}
                </button>
              </div>
              {hasSet3 && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Your Points</Label>
                    <Input
                      type="number"
                      min="0"
                      max="30"
                      value={set3Player}
                      onChange={(e) => setSet3Player(e.target.value)}
                      className="h-10 text-center font-bold font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Opponent Points</Label>
                    <Input
                      type="number"
                      min="0"
                      max="30"
                      value={set3Opponent}
                      onChange={(e) => setSet3Opponent(e.target.value)}
                      className="h-10 text-center font-bold font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Winner selection */}
            <div>
              <Label className="text-xs font-bold text-foreground">Match Winner</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setWinnerChoice("player")}
                  className={`rounded-xl border p-2.5 text-xs font-bold transition-all ${winnerChoice === "player"
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                    }`}
                >
                  ✓ I Won
                </button>
                <button
                  type="button"
                  onClick={() => setWinnerChoice("opponent")}
                  className={`rounded-xl border p-2.5 text-xs font-bold transition-all ${winnerChoice === "opponent"
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                    }`}
                >
                  Opponent Won
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-800">
              Future Concept Preview: Match score reporting and automated standings verification are scheduled for post-V1 release.
            </div>

            <DialogFooter className="mt-4 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReportModalMatch(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="rounded-full">
                Submit Score for Verification
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* POPUP 2: FULL STATS & RESULTS MODAL */}
      <Dialog open={fullStatsOpen} onOpenChange={setFullStatsOpen}>
        <DialogContent className="max-w-2xl rounded-2xl p-6 sm:p-8 max-h-[85vh] overflow-y-auto modern-scrollbar pr-4">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                  <Trophy className="size-6 text-primary" /> Full Match Statistics & Results
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Complete breakdown for {currentPlayer.firstName} {currentPlayer.lastName} ({currentPlayer.id})
                </DialogDescription>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
                NTRP {currentPlayer.ntrp}
              </span>
            </div>
          </DialogHeader>

          {/* Key Metrics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="rounded-xl border border-border bg-card p-3.5 text-center shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Matches Played
              </span>
              <p className="mt-1 text-3xl font-bold text-foreground">{stats.matchesPlayed}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-center shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Official Wins
              </span>
              <p className="mt-1 text-3xl font-bold text-emerald-600">{stats.wins}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 text-center shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Losses
              </span>
              <p className="mt-1 text-3xl font-bold text-muted-foreground">{stats.losses}</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-center shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Win Rate
              </span>
              <p className="mt-1 text-3xl font-bold text-primary">{stats.winRate}%</p>
            </div>
          </div>

          {/* Match Results History */}
          <div className="mt-6 space-y-3">
            <h4 className="text-sm font-bold text-foreground">Verified & Submitted Match Breakdown</h4>

            {myResults.length > 0 ? (
              <div className="space-y-3">
                {myResults.map((res: MatchResult) => {
                  const match = matches.find((m: Match) => m.id === res.matchId) || myMatches.find((m: Match) => m.id === res.matchId);
                  const isWinner = res.winnerId === currentPlayer.id;

                  return (
                    <div
                      key={res.resultId}
                      className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${isWinner ? "bg-emerald-500/20 text-emerald-700" : "bg-muted text-muted-foreground"
                              }`}
                          >
                            {isWinner ? "WIN" : "LOSS"}
                          </span>
                          <span className="font-bold text-sm text-foreground">
                            vs {match?.opponentName || "League Opponent"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({match?.opponentLevel ? `NTRP ${match.opponentLevel}` : "NTRP 3.5"})
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {match?.court || "Piedmont Park Courts"} · {match?.matchDate || "Recent fixture"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
                        <div className="text-right">
                          <span className="font-mono text-base font-bold text-foreground block">
                            {res.scoreData}
                          </span>
                          <span className="text-[10px] text-muted-foreground">Set Scores</span>
                        </div>

                        <div>
                          {res.status === "accepted" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                              <CheckCircle className="size-3" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                              <Clock className="size-3" /> Awaiting Review
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Trophy className="size-6 text-muted-foreground/60" />
                </div>
                <h5 className="mt-3 text-sm font-bold text-foreground">No Match Results Yet</h5>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Match coordination and score reporting are outside the current V1 release. Confirmed registrations and league entries are shown in your dashboard.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
            <strong>Scope Notice:</strong> Automated fixtures, score submission, standings, and rankings are scheduled for future platform updates and not included in V1.
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFullStatsOpen(false)}
              className="rounded-full w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
