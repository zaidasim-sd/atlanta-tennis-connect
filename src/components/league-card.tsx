import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FORMAT_LABELS, formatDateRange, formatMoney, type League, type Season } from "@/lib/tennis";

import { useStore } from "@/lib/store";

export function LeagueCard({
  league,
  season,
  spotsLeft,
}: {
  league: League;
  season: Season | undefined;
  spotsLeft: number;
}) {
  const { user, registrations } = useStore();
  const isRegistered = user ? registrations.some((r) => r.playerId === user.playerId && r.leagueId === league.id) : false;
  const isFull = spotsLeft <= 0;
  const isClosed = !league.registrationOpen;

  const cleanTitle = league.name.replace(/^(Midtown|Buckhead|Decatur|Cumming|Marietta|Westside|Sandy Springs|Alpharetta|East Atlanta|Peachtree)\s+/i, "");
  const cleanSeason = season?.name?.replace(/\s*(Metro|Indoor|Premier)?\s*Season/i, "") || season?.name;
  const cleanSkill = (league.skillLevel as string).replace("+", "");

  return (
    <article className="hover-lift group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground" title="League Type">
          {FORMAT_LABELS[league.format] || league.format}
        </span>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground" title="Skill Level">
          NTRP {cleanSkill}
        </span>
        {isRegistered ? (
          <span className="rounded-full bg-primary/10 border border-primary/30 px-3 py-1 text-xs font-bold text-primary">
            ✓ Enrolled
          </span>
        ) : isClosed ? (
          <span className="rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Closed
          </span>
        ) : isFull ? (
          <span className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
            Full
          </span>
        ) : (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Registration Open
          </span>
        )}
      </div>

      <h3 className="mt-4 text-xl font-bold text-foreground">{cleanTitle}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{cleanSeason}</p>

      <dl className="mt-5 space-y-2.5 text-sm text-muted-foreground">
        {/* Metro Area / Locality & Venue */}
        <div className="flex items-center gap-2.5">
          <MapPin className="size-4 shrink-0 text-primary" />
          <dd className="truncate text-foreground/90">
            <span className="font-semibold text-foreground">{league.geographicGroup || "Atlanta"}</span>
            {league.venue ? ` · ${league.venue}` : ""}
          </dd>
        </div>

        {/* Day & Time */}
        <div className="flex items-center gap-2.5">
          <CalendarDays className="size-4 shrink-0 text-primary" />
          <dd>
            {league.scheduleDay}s · {league.scheduleTime}
            {league.startDate && league.endDate
              ? ` · ${formatDateRange(league.startDate, league.endDate)}`
              : season
                ? ` · ${formatDateRange(season.startDate, season.endDate)}`
                : ""}
          </dd>
        </div>

        {/* Remaining Spaces */}
        <div className="flex items-center gap-2.5">
          <Users className="size-4 shrink-0 text-primary" />
          <dd>
            {isFull ? (
              <span className="font-semibold text-destructive">0 spaces remaining</span>
            ) : (
              <span>
                <strong className="text-foreground">{spotsLeft}</strong> remaining {spotsLeft === 1 ? "space" : "spaces"}{" "}
                <span className="text-xs text-muted-foreground">({league.playerLimit} cap)</span>
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex items-end justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-2xl font-bold text-primary">{formatMoney(league.feeCents)}</p>
          <p className="text-xs text-muted-foreground">per player, per season</p>
        </div>
        <Button asChild size="sm" variant={isRegistered || isClosed ? "outline" : "default"}>
          <Link to="/leagues/$leagueId" params={{ leagueId: league.id }}>
            View Details <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function LeagueCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-6 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <div className="mt-5 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
    </div>
  );
}
