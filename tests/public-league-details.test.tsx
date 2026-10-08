import type { ComponentType, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { League } from "@/lib/tennis";
import { Route } from "@/routes/leagues.$leagueId";
import { LeagueCard } from "@/components/league-card";
import { Route as RegistrationRoute } from "@/routes/register.$leagueId";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useParams: () => ({ leagueId: "singles" }) }),
  useParams: () => ({ leagueId: "singles" }),
  useNavigate: () => navigate,
  Link: ({ children, to, params }: { children: ReactNode; to: string; params?: { leagueId: string } }) =>
    <a href={to.replace("$leagueId", params?.leagueId || "")}>{children}</a>,
}));
vi.mock("@/lib/store", () => ({ useStore: () => store, getApiUrl: (path: string) => path }));
vi.mock("@/components/stripe-checkout-form", () => ({ StripeCheckoutForm: () => null }));

const league: League = {
  id: "singles", seasonId: "fall", name: "Midtown Singles", format: "men-singles",
  skillLevel: "3.5", feeCents: 3000, scheduleDay: "Saturday", scheduleTime: "9:00 AM",
  venue: "Piedmont Park", playerLimit: 16, registrationOpen: true,
  description: "Saturday singles", startDate: "2026-10-01", endDate: "2026-12-15",
};
let currentLeague: League | undefined;
const store = {
  user: null, hydrated: true, registrations: [], leagues: [league], seasons: [], players: [],
  leagueById: () => currentLeague, seasonById: () => undefined,
  spotsLeft: () => 10, registrationsForPlayer: () => [],
};
const LeagueDetail = Route.options.component as ComponentType;
const Registration = RegistrationRoute.options.component as ComponentType;

beforeEach(() => { currentLeague = league; navigate.mockClear(); });

describe("public league details", () => {
  it("links visitors directly from browsing to league details", () => {
    render(<LeagueCard league={league} season={undefined} spotsLeft={10} />);
    expect(screen.getByRole("link", { name: /View Details/ }).getAttribute("href")).toBe("/leagues/singles");
  });

  it("shows full details to visitors and sends Register to protected registration", () => {
    render(<LeagueDetail />);
    expect(screen.getByRole("heading", { name: league.name })).toBeTruthy();
    for (const label of ["Format", "Eligibility", "Venue", "Season dates", "Spots remaining", "Season fee"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("Piedmont Park")).toBeTruthy();
    expect(screen.getByText("$30")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Register →/ }).getAttribute("href")).toBe("/register/singles");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows closed leagues without offering registration", () => {
    currentLeague = { ...league, registrationOpen: false };
    render(<LeagueDetail />);
    expect((screen.getByRole("button", { name: "Registration closed" }) as HTMLButtonElement).disabled).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows a missing league without requiring sign-in", () => {
    currentLeague = undefined;
    render(<LeagueDetail />);
    expect(screen.getByRole("heading", { name: "League not found" })).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("requires sign-in for direct registration and preserves the checkout destination", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ json: async () => ({ ok: false }) } as Response);
    render(<Registration />);
    expect(navigate).toHaveBeenCalledWith({
      to: "/login", search: { leagueId: "singles", redirect: "/register/singles" }, replace: true,
    });
    expect(screen.queryByRole("button", { name: /Reserve Spot & Pay/ })).toBeNull();
    vi.restoreAllMocks();
  });
});
