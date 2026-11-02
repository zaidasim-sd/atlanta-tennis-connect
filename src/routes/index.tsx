import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowRight,
  Trophy,
  Users,
  Calendar,
  Lock,
  LogIn,
  UserPlus,
  ShieldCheck,
  MapPin,
} from "lucide-react";
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
            className="h-full w-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-1000 ease-out"
            poster="https://images.unsplash.com/photo-1499510318569-1a3d67dc3976?q=80&w=464&auto=format&fit=crop"
          >
            <source src="https://res.cloudinary.com/dereplqra/video/upload/v1789104060/281992_large_1_xy63dw.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-6xl text-center z-10">
          <h1 className="font-display animate-rise text-5xl font-bold tracking-tight text-white sm:text-7xl drop-shadow-lg">
            Real tennis. Real local.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/90 sm:text-xl font-medium drop-shadow-md">
            Join organized tennis leagues across metro Atlanta. Create your profile, browse member leagues, and secure your registration online with instant confirmation.
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

      {/* Stats/Info Section */}
      <section className="border-b border-border bg-card px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Trophy className="size-6" />
            </div>
            <h3 className="mt-4 font-bold text-foreground">Competitive Play</h3>
            <p className="mt-2 text-sm text-muted-foreground">Find leagues tailored to your exact skill level, from casual 2.5 to competitive 5.0.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Users className="size-6" />
            </div>
            <h3 className="mt-4 font-bold text-foreground">League Types</h3>
            <p className="mt-2 text-sm text-muted-foreground">Men's Singles, Women's Singles, Men's Doubles, and Mixed Doubles across metro Atlanta.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Calendar className="size-6" />
            </div>
            <h3 className="mt-4 font-bold text-foreground">Organized Seasons</h3>
            <p className="mt-2 text-sm text-muted-foreground">Spring, Summer, Fall, and Winter leagues organized across metro Atlanta communities.</p>
          </div>
        </div>
      </section>

      {/* Featured Leagues / Member Access Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-background">
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

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* FAQ Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 border-t border-border">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Frequently Asked Questions</h2>
            <p className="mt-4 text-lg text-muted-foreground">Everything you need to know about playing with Baseline ATL.</p>
          </div>
          
          <div className="mx-auto max-w-3xl rounded-2xl bg-card p-6 shadow-sm border border-border sm:p-10">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-base font-semibold hover:text-primary">How do I know my skill level?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  We use the standard NTRP rating system (2.5 to 5.0). If you're a beginner, 2.5 is a great start. Intermediate players typically fall into 3.0 or 3.5, while advanced players compete at 4.0 and 4.5 or 5.0. You can easily select your level when creating your profile.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-base font-semibold hover:text-primary">Where are the matches played?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  Matches are hosted at top-tier tennis facilities across metro Atlanta. Specific venues vary by league and season. When you view a league's details, you'll see exactly which venue will host your matches.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="text-base font-semibold hover:text-primary">How does league registration work?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  Browse available leagues by format, NTRP skill level, and metro area. Once you find the right fit, complete your registration and secure payment online to lock in your spot with instant confirmation.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger className="text-base font-semibold hover:text-primary">Do I need a partner for doubles?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  You can register for Men's Doubles or Mixed Doubles leagues. Both partners complete their registration to reserve their spots in the league.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5" className="border-b-0">
                <AccordionTrigger className="text-base font-semibold hover:text-primary">When does the next season start?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  We run four major seasons year-round: Spring, Summer, Fall, and Winter. Registration typically opens 4 weeks before the season begins. Check the "Browse leagues" page to see what's currently enrolling!
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-secondary px-6 py-16 text-center shadow-lg sm:px-12">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ready to hit the courts?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Create your player profile, find the right league for your skill level, and secure your spot today.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/signup" search={{ leagueId: undefined }}>Create account</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
