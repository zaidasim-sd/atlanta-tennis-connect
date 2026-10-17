import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Trophy, Users, Calendar } from "lucide-react";
import { useStore } from "@/lib/store";
import { LeagueCard } from "@/components/league-card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { leagues, seasons, spotsLeft, user, hydrated } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && user?.role === "organizer") {
      navigate({ to: "/organizer" });
    }
  }, [hydrated, user, navigate]);

  if (hydrated && user?.role === "organizer") {
    return null;
  }

  const featuredLeagues = leagues.slice(0, 3);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="group relative overflow-hidden bg-black px-4 py-40 sm:py-56 text-primary-foreground sm:px-6 lg:px-8">
        <div className="absolute inset-0">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline 
            preload="metadata"
            aria-hidden="true"
            className="h-full w-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-1000 ease-out pointer-events-none"
            poster="https://images.unsplash.com/photo-1499510318569-1a3d67dc3976?q=80&w=1200&auto=format&fit=crop"
          >
            <source src="/hero-tennis.webm" type="video/webm" />
            <source src="/281992_large_1_xy63dw%20(1).webm" type="video/webm" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-6xl text-center z-10">
          <h1 className="font-display animate-rise text-5xl font-bold tracking-tight text-white sm:text-7xl drop-shadow-lg">
            Real tennis. Real local.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/90 sm:text-xl font-medium drop-shadow-md">
            Join organized tennis leagues across metro Atlanta. Browse full league details and current availability, then sign in to begin registration.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="rounded-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl border-2 border-primary/20">
              <Link to="/leagues">
                Find a league
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white border-white/30 backdrop-blur-sm shadow-xl">
              <Link to="/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Compact league features */}
      <section aria-label="League features" className="border-b border-border bg-card px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
        <ul className="mx-auto grid max-w-6xl grid-cols-3 gap-2 sm:gap-8">
          {[
            {
              icon: Trophy, title: "Competitive Play",
              detail: "NTRP 2.5–5.0",
              desktopDetail: "Find leagues tailored to your exact skill level, from casual 2.5 to competitive 5.0.",
            },
            {
              icon: Users, title: "League Types",
              detail: "Singles & doubles",
              desktopDetail: "Men's Singles, Women's Singles, Men's Doubles, and Mixed Doubles across metro Atlanta.",
            },
            {
              icon: Calendar, title: "Organized Seasons",
              detail: "Year-round play",
              desktopDetail: "Spring, Summer, Fall, and Winter leagues organized across metro Atlanta communities.",
            },
          ].map(({ icon: Icon, title, detail, desktopDetail }) => (
            <li key={title} className="group/feature min-w-0 text-center">
              <div className="flex flex-col items-center">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary transition-colors duration-300 group-hover/feature:bg-lime-200 motion-safe:transition-all motion-safe:group-hover/feature:-translate-y-1 motion-safe:group-hover/feature:scale-110 sm:size-12">
                  <Icon className="size-5 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover/feature:-rotate-6 sm:size-6" aria-hidden="true" />
                </span>
                <h3 className="mt-2 text-xs font-bold leading-snug text-foreground sm:mt-4 sm:text-base">{title}</h3>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:hidden">{detail}</p>
              <p className="mt-2 hidden text-sm text-muted-foreground sm:block">{desktopDetail}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Featured Leagues */}
      <section className="px-4 py-10 sm:py-16 sm:px-6 lg:px-8 bg-background">
        <div className="mx-auto max-w-6xl">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Featured Leagues</h2>
                <p className="mt-2 text-muted-foreground">Upcoming leagues with spots still available.</p>
              </div>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/leagues">View all leagues</Link>
              </Button>
            </div>


            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredLeagues.map((league) => (
                <LeagueCard
                  key={league.id}
                  league={league}
                  season={seasons.find((s) => s.id === league.seasonId)}
                  spotsLeft={spotsLeft(league.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Short registration overview */}
      <section className="border-t border-border px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">How it works</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { title: "Find your league", body: "Review the format, level, venue, dates and price." },
              { title: "Sign in & confirm details", body: "Choose Register, then sign in or create your player account." },
              { title: "Complete registration", body: "Complete the payment step and check your registration status." },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">{index + 1}</span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link to="/how-it-works" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            More about how it works <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 py-10 sm:py-16 sm:px-6 lg:px-8 border-t border-border">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-5">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Quick questions</h2>
          </div>
          
          <div className="mx-auto max-w-3xl rounded-2xl bg-card p-4 shadow-sm border border-border sm:p-6">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-base font-semibold hover:text-primary">How do I know my skill level?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  We use the standard NTRP rating system (2.5 to 5.0). If you're a beginner, 2.5 is a great start. Intermediate players typically fall into 3.0 or 3.5, while advanced players compete at 4.0 and 4.5 or 5.0. You can easily select your level when creating your profile.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="border-b-0">
                <AccordionTrigger className="text-base font-semibold hover:text-primary">Where are the matches played?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  Matches are hosted at top-tier tennis facilities across metro Atlanta. Specific venues vary by league and season. When you view a league's details, you'll see exactly which venue will host your matches.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-4 py-10 sm:py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-secondary px-6 py-8 sm:py-12 text-center shadow-lg sm:px-12">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ready to hit the courts?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
            Find the right league for your skill level and review the details before registering.
          </p>
          <div className="mt-5 flex justify-center gap-4">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/leagues">Find a league <ArrowRight className="size-4" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
