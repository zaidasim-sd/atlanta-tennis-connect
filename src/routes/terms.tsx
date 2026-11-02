import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { ShieldCheck, MapPin, Scale, AlertCircle, FileText, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use | Baseline ATL" },
      {
        name: "description",
        content:
          "Terms of Use for Baseline ATL, operated by Hyper Nexus Group LLC, operated by Mr Saad Moudood. Platform registration, court booking responsibilities, and league rules.",
      },
    ],
  }),
  component: TermsOfUse,
});

function TermsOfUse() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-primary transition-colors">Home</Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground font-medium">Terms of Use</span>
      </nav>

      {/* Header */}
      <div className="border-b border-border pb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <ShieldCheck className="size-3.5" />
          <span>Official Legal Terms & Platform Policies</span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Terms of Use & Player Agreement
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: November 2026 · Effective for Season One and all subsequent Baseline ATL operations.
        </p>
      </div>

      {/* Legal Entity Banner */}
      <div className="mt-8 rounded-2xl border border-primary/20 bg-secondary/40 p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <Scale className="size-6 shrink-0 text-primary mt-1" />
          <div>
            <h2 className="text-base font-bold text-foreground">Operating Entity & Merchant of Record</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Baseline ATL and this platform are owned and operated by{" "}
              <strong className="text-foreground font-semibold">Hyper Nexus Group LLC, operated by Mr Saad Moudood</strong>.
              All merchant transactions, platform services, and league administration agreements are entered into with
              Hyper Nexus Group LLC.
            </p>
          </div>
        </div>
      </div>

      {/* Critical Court Booking Disclaimer (Mandatory Callout) */}
      <div className="mt-8 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-6 sm:p-7 shadow-sm">
        <div className="flex items-start gap-4">
          <AlertCircle className="size-6 shrink-0 text-amber-600 dark:text-amber-400 mt-1" />
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span>Important Court-Booking Disclaimer</span>
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                Player Responsibility
              </span>
            </h2>
            <p className="text-sm leading-relaxed text-foreground/90 font-medium">
              Baseline ATL provides adult and junior tennis league registration, division scheduling, roster management,
              and related coordination services.
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground/85">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <span>
                  <strong>Independent Court Reservations:</strong> Players and teams are individually responsible for arranging,
                  reserving, and booking their own tennis courts for scheduled matches.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <span>
                  <strong>No Guarantee of Court Availability:</strong> Baseline ATL is not responsible for municipal or private court
                  availability, court access fees, lighting charges, surface conditions, or weather cancellations.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <span>
                  <strong>Registration Excludes Court Booking:</strong> A confirmed league registration reserves a player's spot in
                  the competition division, but does not constitute, include, or guarantee an individual court booking.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground">
        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">1</span>
            Seasonal Operating State & Enrollment
          </h2>
          <p>
            Baseline ATL is operated on a scheduled seasonal cadence rather than an open year-round registration queue.
            Each competition cycle operates under defined state controls:
          </p>
          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-bold text-foreground">Active Season</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Registration is open for scheduled divisions, timed reservation holds are honored, and live payment processing confirms player roster spots.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-bold text-foreground">Off Season</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Matches and season playoffs are underway. New registration holds are locked to protect competitive integrity.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-bold text-foreground">Standby</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Inter-season transition window. Historical records and player profiles remain accessible while upcoming season schedules are finalized.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">2</span>
            Registration, Capacity & Instant Confirmation
          </h2>
          <p>
            To prevent overbooking, registration begins with a temporary reservation hold that reserves capacity. Payment is collected
            securely through verified merchant channels (e.g., Easy Pay Direct / Worldpay).
          </p>
          <p>
            Upon successful verification of payment by the backend payment processor, your registration status is confirmed
            instantly. There is no manual approval delay or administrative pending state required for paid entries. In the event of
            payment processing or network timeouts, reservation holds expire automatically to return inventory to other players.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">3</span>
            Competition Format, Scoring & Playoff Preferences
          </h2>
          <p>
            Baseline ATL divisions utilize best-of-3 sets scoring. Individual and doubles match results determine regular-season
            win-percentage rankings within each designated City Division.
          </p>
          <p>
            Divisions roll up into City Winner and City Finalist recognitions. Playoff participation is
            managed on a manual opt-in basis. Registered players may record their playoff opt-in or opt-out preference directly
            through their Player Dashboard for organizer review and bracket coordination. Standings calculations and playoff
            brackets remain administrative and manual for Season One.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">4</span>
            Player Conduct, Sportsmanship & Safety
          </h2>
          <p>
            All participants must uphold standard USTA tennis etiquette, integrity, and fair play. Unsportsmanlike conduct,
            intentional score misreporting, verbal abuse, or harassment will result in immediate expulsion from the league
            without refund. Players participate at their own risk and are advised to maintain appropriate medical coverage.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">5</span>
            Contact & Legal Inquiries
          </h2>
          <p>
            For questions concerning these terms, registration records, or payment confirmations, contact the platform
            management at:
          </p>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="font-bold text-foreground">Hyper Nexus Group LLC</p>
            <p className="text-xs text-muted-foreground mt-0.5">Operated by Mr Saad Moudood</p>
            <p className="text-xs text-muted-foreground mt-2">Atlanta, Georgia · Metro Area Tennis Operations</p>
            <p className="text-xs text-muted-foreground">Email: contact@baselineatl.com</p>
          </div>
        </section>
      </div>

      {/* Navigation Buttons */}
      <div className="mt-12 flex flex-col gap-3 sm:flex-row border-t border-border pt-8">
        <Button asChild size="lg" className="rounded-full font-bold">
          <Link to="/leagues">Browse Active Leagues</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="rounded-full">
          <Link to="/how-it-works">How Baseline ATL Works</Link>
        </Button>
      </div>
    </main>
  );
}
