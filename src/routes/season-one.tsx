import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { Building2, CalendarDays, MapPin, Trophy, UsersRound, CheckCircle2 } from "lucide-react";
import { getApiUrl } from "@/lib/store";

type SeasonOneData = {
  organization: { legalEntityName: string; operatorName: string };
  operatingStates: string[];
  categories: { code: string; name: string; audience: string; partnerRequired: boolean }[];
  cityDivisionFields: string[];
  playoffOptInFields: string[];
  automation: { standings: string; playoffBrackets: string };
};

const DEFAULT_SEASON_ONE: SeasonOneData = {
  organization: { legalEntityName: "Hyper Nexus Group LLC", operatorName: "Mr Saad Moudood" },
  operatingStates: ["active-season", "off-season", "standby"],
  categories: [
    { code: "men-singles", name: "Men's Singles", audience: "adult", partnerRequired: false },
    { code: "women-singles", name: "Women's Singles", audience: "adult", partnerRequired: false },
    { code: "men-doubles", name: "Men's Doubles", audience: "adult", partnerRequired: true },
    { code: "women-doubles", name: "Women's Doubles", audience: "adult", partnerRequired: true },
    { code: "mixed-doubles", name: "Mixed Doubles", audience: "adult", partnerRequired: true },
    { code: "junior-singles", name: "Junior Singles", audience: "junior", partnerRequired: false },
    { code: "junior-doubles", name: "Junior Doubles", audience: "junior", partnerRequired: true },
    { code: "senior-singles", name: "Senior Singles", audience: "adult", partnerRequired: false },
    { code: "senior-doubles", name: "Senior Doubles", audience: "adult", partnerRequired: true },
  ],
  cityDivisionFields: ["season", "city", "category", "skill level", "linked leagues", "manual placement"],
  playoffOptInFields: ["player", "season", "city division", "opt in or opt out", "captured by", "date", "note"],
  automation: { standings: "manual", playoffBrackets: "manual" },
};

export const Route = createFileRoute("/season-one")({
  head: () => ({ meta: [{ title: "Season One Setup | Baseline ATL" }] }),
  component: SeasonOne,
});

function SeasonOne() {
  const [data, setData] = React.useState<SeasonOneData>(DEFAULT_SEASON_ONE);
  React.useEffect(() => {
    void fetch(getApiUrl("/api/season-one"))
      .then(async response => response.ok ? response.json() : Promise.reject(new Error("Unavailable")))
      .then(payload => setData(payload.data))
      .catch(() => undefined);
  }, []);

  const categories = data.categories;
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <section>
        <p className="eyebrow text-muted-foreground">Season One operations</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold sm:text-5xl">Season setup is controlled, local, and manual where it should be.</h1>
        <p className="mt-4 max-w-3xl text-lg text-muted-foreground">This page shows the live implementation structure for season operating states, categories, city divisions, and playoff preferences.</p>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <CalendarDays className="size-6 text-primary" />
          <h2 className="mt-4 text-xl font-bold">Season operating state</h2>
          <p className="mt-2 text-sm text-muted-foreground">Only an active season can accept a new registration hold.</p>
          <div className="mt-5 flex flex-wrap gap-2">{data.operatingStates.map(state => <span key={state} className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">{state.replace("-", " ")}</span>)}</div>
        </section>
        <section className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <MapPin className="size-6 text-primary" />
          <h2 className="mt-4 text-xl font-bold">City based divisions</h2>
          <p className="mt-2 text-sm text-muted-foreground">Each division stores its {data.cityDivisionFields.join(", ")}.</p>
          <p className="mt-5 rounded-xl bg-muted/50 p-3 text-xs font-medium text-muted-foreground">Placement remains an organizer decision for V1.</p>
        </section>
        <section className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <Trophy className="size-6 text-primary" />
          <h2 className="mt-4 text-xl font-bold">Manual playoffs</h2>
          <p className="mt-2 text-sm text-muted-foreground">Players can record a playoff opt in or opt out. The record includes {data.playoffOptInFields.slice(0, 5).join(", ")}.</p>
          <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800">Standings and brackets remain manual in V1.</p>
        </section>
      </section>

      <section className="mt-8 rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><UsersRound className="size-6 text-primary" /><h2 className="mt-4 text-2xl font-bold">Expanded Season One categories</h2><p className="mt-1 text-sm text-muted-foreground">These category definitions are available to organizer configuration.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Backend enabled</span></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{categories.map(category => <div key={category.code} className="flex items-center gap-3 rounded-xl border border-border/80 p-4"><CheckCircle2 className="size-5 shrink-0 text-primary" /><div><p className="font-bold">{category.name}</p><p className="text-xs text-muted-foreground">{category.audience === "junior" ? "Junior" : "Adult"}{category.partnerRequired ? " · Partner required" : " · Individual entry"}</p></div></div>)}</div>
      </section>

      <section className="mt-8 rounded-2xl border border-primary/20 bg-secondary/40 p-6">
        <div className="flex gap-4"><Building2 className="size-6 shrink-0 text-primary" /><div><p className="eyebrow text-primary">Merchant record</p><h2 className="mt-1 text-xl font-bold">{data.organization.legalEntityName}</h2><p className="mt-1 text-sm text-muted-foreground">Operated by {data.organization.operatorName}. New payment related reservations retain this identity snapshot.</p></div></div>
      </section>
    </main>
  );
}
