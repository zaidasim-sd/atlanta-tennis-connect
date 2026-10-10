import * as React from "react";
import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Users,
  Trophy,
  Clock,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { useStore } from "@/lib/store";
import { FORMAT_LABELS, formatDate, formatDateRange, formatMoney } from "@/lib/tennis";
import { BallLoader } from "@/components/tennis-ball";

export const Route = createFileRoute("/leagues/$leagueId")({
  head: () => ({
    meta: [
      { title: "League Details — Baseline ATL Atlanta Tennis Leagues" },
      {
        name: "description",
        content: "Format, skill level, venue details and registration status for this Atlanta tennis league, plus online registration.",
      },
      { property: "og:title", content: "League Details — Baseline ATL" },
      { property: "og:description", content: "Format, skill level, venue details and registration status, plus online registration." },
    ],
  }),
  component: LeagueDetail,
});

const ENROLLMENT_STEPS = [
  { time: "Step 1", title: "Review requirements", body: "Check the NTRP skill level, format, and venue location to confirm this league fits your game." },
  { time: "Step 2", title: "Reserve your spot", body: "Sign in or create an account, confirm your details, and complete the current mock payment flow." },
  { time: "Step 3", title: "Confirmed enrollment", body: "Registration is confirmed once the process is completed. View your registration status in your dashboard." },
];

function LeagueDetail() {
  const { leagueId } = useParams({ from: "/leagues/$leagueId" });
  const navigate = useNavigate();
  const { leagueById, seasonById, spotsLeft, registrationsForPlayer, user, hydrated } = useStore();

  React.useEffect(() => {
    if (hydrated && user?.role === "organizer") {
      navigate({ to: "/organizer" });
    }
  }, [hydrated, user, leagueId, navigate]);

  if (!hydrated || user?.role === "organizer") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <BallLoader label="Loading league details..." />
      </div>
    );
  }

  const league = leagueById(leagueId);

  if (!league) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-3xl font-bold">League not found</h1>
        <p className="mt-3 text-muted-foreground">This league may have been closed or removed.</p>
        <Button asChild className="mt-6">
          <Link to="/leagues">Back to all leagues</Link>
        </Button>
      </div>
    );
  }

  const season = seasonById(league.seasonId);
  const left = spotsLeft(league.id);
  const registeredCount = typeof league.registeredCount === "number" ? league.registeredCount : Math.max(0, league.playerLimit - left);
  const isRegistered = user?.playerId ? registrationsForPlayer(user.playerId).some((r) => r.leagueId === league.id) : false;
  const canRegister = league.registrationOpen && left > 0 && !isRegistered;
  const formatLabel = FORMAT_LABELS[league.format as keyof typeof FORMAT_LABELS] ||
    (league.format ? league.format.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "Standard League");

  return (
    <div>
      <section className="group relative overflow-hidden bg-black pb-20 pt-10 text-white sm:pb-32 sm:pt-16">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1635842939844-1fbf6bea8e78?q=80&w=1200&auto=format&fit=crop" 
            srcSet="https://images.unsplash.com/photo-1635842939844-1fbf6bea8e78?q=80&w=640&auto=format&fit=crop 640w, https://images.unsplash.com/photo-1635842939844-1fbf6bea8e78?q=80&w=1024&auto=format&fit=crop 1024w, https://images.unsplash.com/photo-1635842939844-1fbf6bea8e78?q=80&w=1400&auto=format&fit=crop 1400w"
            sizes="100vw"
            loading="lazy"
            decoding="async"
            alt="Tennis court" 
            className="h-full w-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-1000 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 z-10">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-white/70">
            <Link to="/" className="transition-colors hover:text-accent drop-shadow-md">Home</Link>
            <ChevronRight className="size-3.5 drop-shadow-md" />
            <Link to="/leagues" className="transition-colors hover:text-accent drop-shadow-md">Leagues</Link>
            <ChevronRight className="size-3.5 drop-shadow-md" />
            <span className="text-white drop-shadow-md">{league.name}</span>
          </nav>

          <div className="animate-rise mt-8 max-w-3xl">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground shadow-sm">
                {formatLabel}
              </span>
              <span className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm bg-black/20">
                NTRP {league.skillLevel}
              </span>
              <span className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm bg-black/20">
                {season?.status === "active" ? "Season in progress" : season?.status === "upcoming" ? "Upcoming season" : "Closed season"}
              </span>
            </div>
            <h1 className="mt-5 text-4xl font-bold sm:text-5xl drop-shadow-lg">{league.name}</h1>
            <p className="mt-4 text-lg leading-relaxed text-white/90 drop-shadow-md">{league.description}</p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.6fr_1fr] items-start">
        {/* Left Column: How Registration Works on top + Match Details */}
        <div className="space-y-8">
          {/* How league registration works - positioned at top beside season fee card */}
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              How league registration works
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review league details, complete registration, and check your status.
            </p>

            <ol className="mt-5 space-y-3.5">
              {ENROLLMENT_STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:border-primary/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <p className="eyebrow text-muted-foreground">{step.time}</p>
                    <h3 className="mt-0.5 font-bold text-base text-foreground">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Capacity guarantee notice */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs sm:text-sm leading-relaxed text-foreground/90">
                Registration is limited to <strong className="font-semibold text-foreground">{league.playerLimit} players</strong> per league. Current availability is shown for each league. View your registration status and league details in your dashboard after completing the process.
              </p>
            </div>
          </div>

          {/* Match & Venue Details */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4">
              Competition & Venue Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: CalendarDays, label: "Match night", value: `${league.scheduleDay}s at ${league.scheduleTime}` },
                { icon: MapPin, label: "Venue", value: league.venue },
                { icon: Trophy, label: "Format", value: formatLabel },
                { icon: ShieldCheck, label: "Eligibility", value: `NTRP ${(league.offeredSkillLevels?.length ? league.offeredSkillLevels : [league.skillLevel]).join(", ")}${league.ageCategory ? ` · ${league.ageCategory} age category` : ""} · ${formatLabel}` },
                {
                  icon: Clock,
                  label: "Season dates",
                  value:
                    league.startDate && league.endDate
                      ? formatDateRange(league.startDate, league.endDate)
                      : season
                        ? formatDateRange(season.startDate, season.endDate)
                        : "TBA",
                },
                { icon: Users, label: "League size", value: `${registeredCount} registered · ${league.playerLimit} max` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <item.icon className="size-4 text-primary" />
                    <p className="eyebrow">{item.label}</p>
                  </div>
                  <p className="mt-2 font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky signup / Season fee card */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-md shadow-black/[0.04]">
            <p className="eyebrow text-muted-foreground">Season fee</p>
            <p className="mt-1 font-display text-4xl font-bold text-primary">{formatMoney(league.feeCents)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Includes official league entry, venue reservation, and member registration.</p>

            <div className="mt-5 rounded-xl bg-muted/40 p-4 text-sm border border-border/60">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Spots remaining</span>
                <span className="font-bold text-foreground">
                  {left} / {league.playerLimit}
                </span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(100, (registeredCount / league.playerLimit) * 100)}%` }}
                />
              </div>
            </div>

            {isRegistered ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-center text-sm font-semibold text-primary">
                  ✓ You are registered for this league
                </div>
                <Button asChild size="lg" className="w-full rounded-full font-bold">
                  <Link to="/dashboard">View in Player Dashboard →</Link>
                </Button>
              </div>
            ) : canRegister ? (
              <Button asChild size="lg" className="mt-5 w-full rounded-full font-bold shadow-md shadow-primary/20">
                <Link to="/register/$leagueId" params={{ leagueId: league.id }}>
                  Register →
                </Link>
              </Button>
            ) : (
              <Button size="lg" className="mt-5 w-full rounded-full font-bold" disabled>
                {left === 0 ? "League is full" : "Registration closed"}
              </Button>
            )}

            {!user && canRegister && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Sign in or create an account to confirm your details and proceed to payment.
              </p>
            )}

            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              Mock payment flow · No real payment is taken
            </p>

            <Link
              to="/leagues"
              className="mt-5 flex items-center justify-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-deep"
            >
              <ArrowLeft className="size-4" /> Back to all leagues
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
