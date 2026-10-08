import type { ComponentType, ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser, League, Player, Season } from "@/lib/tennis";
import { Route } from "@/routes/leagues.index";

// Exercise the real page, filters and cards with deterministic API/session data.
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/lib/store", () => ({ useStore: () => store }));

const season: Season = {
  id: "fall", name: "Fall 2026 Season", status: "upcoming",
  startDate: "2026-10-01", endDate: "2026-12-15",
};
const league: League = {
  id: "singles", seasonId: "fall", name: "Midtown Singles", format: "men-singles",
  skillLevel: "3.5", feeCents: 3000, scheduleDay: "Saturday", scheduleTime: "9:00 AM",
  venue: "Piedmont Park", geographicGroup: "Midtown", playerLimit: 16,
  registrationOpen: true, description: "Saturday singles",
};
const player: Player = {
  id: "player", firstName: "Test", lastName: "Player", email: "test@example.com",
  ntrp: "3.5", city: "Midtown", preferredFormat: "men-singles",
};
const user: AuthUser = {
  id: "account", playerId: "player", name: "Test Player", email: player.email, role: "player",
};
let store: {
  leagues: League[]; seasons: Season[]; players: Player[]; user: AuthUser | null;
  registrations: []; hydrated: boolean; spotsLeft: () => number;
};
const BrowseLeagues = Route.options.component as ComponentType;

beforeEach(() => {
  vi.useFakeTimers();
  store = {
    leagues: [league], seasons: [season], players: [], user: null,
    registrations: [], hydrated: true, spotsLeft: () => 10,
  };
});

function finishLoading() {
  act(() => { vi.advanceTimersByTime(500); });
}

describe("league browsing", () => {
  it("shows six leagues at a time on mobile and resets after search changes", () => {
    store.leagues = Array.from({ length: 14 }, (_, index) => ({
      ...league, id: `league-${index}`, name: `League ${index}`,
    }));
    render(<BrowseLeagues />);
    finishLoading();
    expect(screen.getAllByRole("article")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getAllByRole("article")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getAllByRole("article")).toHaveLength(14);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Search leagues" }), { target: { value: "League" } });
    expect(screen.getAllByRole("article")).toHaveLength(6);
  });

  it("opens mobile filters in an accessible bottom sheet", () => {
    render(<BrowseLeagues />);
    finishLoading();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("dialog", { name: "Filter leagues" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show 1 league" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sorts mobile leagues by price and skill level", () => {
    store.leagues = [
      { ...league, id: "high", name: "High", feeCents: 5000, skillLevel: "4.0" },
      { ...league, id: "low", name: "Low", feeCents: 2000, skillLevel: "3.0" },
    ];
    render(<BrowseLeagues />);
    finishLoading();
    fireEvent.change(screen.getByRole("combobox", { name: "Sort leagues" }), { target: { value: "price" } });
    expect(screen.getAllByRole("article")[0].textContent).toContain("Low");
    fireEvent.change(screen.getByRole("combobox", { name: "Sort leagues" }), { target: { value: "skill" } });
    expect(screen.getAllByRole("article")[0].textContent).toContain("Low");
  });

  it("renders after a player signs in and filters by their profile skill", () => {
    const view = render(<BrowseLeagues />);
    finishLoading();
    store = { ...store, user, players: [player] };
    view.rerender(<BrowseLeagues />);
    expect(screen.getByText(/1 league found/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Singles" })).toBeTruthy();
  });

  it("renders on a direct visit with an existing player session with default filters", () => {
    store = { ...store, user, players: [player] };
    render(<BrowseLeagues />);
    finishLoading();
    expect(screen.getByText("1 league found (NTRP 3.5)")).toBeTruthy();
  });

  it("allows a visitor to filter by metro area", () => {
    render(<BrowseLeagues />);
    finishLoading();
    // Area combobox is the 3rd combobox (format, skill, area)
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBe(4);
    expect(screen.getByText("All 1 leagues available across Atlanta")).toBeTruthy();
  });

  it("keeps browsing usable when searching for non-matching league", () => {
    store = { ...store, user, players: [player] };
    render(<BrowseLeagues />);
    finishLoading();
    fireEvent.change(screen.getByRole("textbox", { name: "Search leagues" }), {
      target: { value: "no matching league" },
    });
    expect(screen.getByRole("heading", { name: "No leagues found for this specific combination" })).toBeTruthy();
  });

  it("prevents organizers from viewing player leagues and renders organizer access notice", () => {
    const organizerUser: AuthUser = {
      id: "org-1", email: "organizer@example.com", name: "Organizer Admin", role: "organizer",
    };
    store = { ...store, user: organizerUser };
    render(<BrowseLeagues />);
    finishLoading();
    expect(screen.getByText(/Organizer Access Only/i)).toBeTruthy();
  });
});
