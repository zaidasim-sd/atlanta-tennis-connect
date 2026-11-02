import * as React from "react";
import {
  FALLBACK_MOCK_LEAGUES,
  FALLBACK_MOCK_MATCHES,
  FALLBACK_MOCK_RESULTS,
  FALLBACK_MOCK_SEASONS,
  type AuthUser,
  type League,
  type Match,
  type MatchResult,
  type Player,
  type PlayerStats,
  type Registration,
  type Season,
  type LeagueFormat,
  type SkillLevel,
} from "./tennis";

interface DataState {
  seasons: Season[];
  leagues: League[];
  players: Player[];
  registrations: Registration[];
  matches: Match[];
  results: MatchResult[];
  user: AuthUser | null;
  dbConnected: boolean;
  fallbackActive: boolean;
}

interface StoreValue extends DataState {
  hydrated: boolean;
  refreshFromDb: () => Promise<void>;
  login: (email: string, password: string, expectedRole?: "player" | "organizer") => Promise<AuthUser>;
  refreshSession: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  createSeason: (input: Omit<Season, "id">) => Season;
  createLeague: (input: Omit<League, "id">) => Promise<League>;
  toggleRegistration: (leagueId: string) => void;
  registerPlayer: (input: {
    leagueId: string;
    player: Player | Omit<Player, "id">;
    partnerId?: string | undefined;
    preferredCourt?: string | undefined;
  }) => { registration: Registration; player: Player };
  updatePlayer: (playerId: string, patch: Partial<Omit<Player, "id">>) => void;
  upsertPlayer: (player: Player) => void;
  leagueById: (id: string) => League | undefined;
  seasonById: (id: string) => Season | undefined;
  registrationsForLeague: (leagueId: string) => Registration[];
  registrationsForPlayer: (playerId: string) => Registration[];
  spotsLeft: (leagueId: string) => number;
  matchesForPlayer: (playerId: string) => Match[];
  statsForPlayer: (playerId: string) => PlayerStats;
  resultsForPlayer: (playerId: string) => MatchResult[];
  submitMatchScore: (input: {
    matchId: string;
    submittedBy: string;
    scoreData: string;
    winnerId: string;
    role?: "player" | "organizer";
  }) => void;
  confirmMatchResult: (resultId: string) => void;
  disputeMatchResult: (resultId: string, reason: string) => void;
  searchPartners: (query: string, excludePlayerId?: string) => Player[];
}

const STORAGE_KEY = "atl-tennis-league-state-v6";
const AUTH_CACHE_KEY = "atl-active-user-session";

const getCachedUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY) || sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === "string" && (parsed.role === "player" || parsed.role === "organizer")) {
      return parsed as AuthUser;
    }
  } catch {}
  return null;
};

export const setCachedUser = (user: AuthUser | null) => {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
      sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_CACHE_KEY);
      sessionStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {}
};

const initial: DataState = {
  seasons: FALLBACK_MOCK_SEASONS,
  leagues: FALLBACK_MOCK_LEAGUES,
  players: [],
  registrations: [],
  matches: FALLBACK_MOCK_MATCHES,
  results: FALLBACK_MOCK_RESULTS,
  user: null,
  dbConnected: false,
  fallbackActive: false,
};

const StoreContext = React.createContext<StoreValue | null>(null);

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export const getApiUrl = (path: string) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  // Keep session cookies on the same origin. Vite proxies local /api requests.
  return cleanPath;
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DataState>(() => ({
    ...initial,
    user: getCachedUser(),
  }));
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (!state.user?.email || !state.dbConnected) return;
    let disposed = false;
    const email = state.user.email;
    fetch(getApiUrl(`/api/registrations?email=${encodeURIComponent(email)}`), { credentials: "include" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok || !Array.isArray(json.data)) return;
        if (!disposed) setState((prev) => ({
          ...prev, registrations: json.data
            .filter((r: Registration & { status: string }) => r.status === "registered")
            .map((r: Registration) => ({ ...r, playerId: prev.user?.playerId || r.playerId }))
        }));
      }).catch(() => { });
    return () => { disposed = true; };
  }, [state.user?.email, state.dbConnected, state.leagues]);

  // DB-first initialization with explicit fallback
  const fetchDbData = React.useCallback(async () => {
    try {
      const url = getApiUrl("/api/leagues");
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      if (!json.ok || !Array.isArray(json.data)) throw new Error("Invalid API response format");

      const dbLeagues: League[] = json.data.map((l: any) => {
        // Enforce unified client-facing league taxonomy
        let format: LeagueFormat = "men-singles";
        const rawFormat = String(l.format || "").toLowerCase().trim();
        if (rawFormat === "women-singles") format = "women-singles";
        else if (rawFormat === "women-doubles") format = "women-doubles";
        else if (rawFormat === "senior-singles") format = "senior-singles";
        else if (rawFormat === "senior-doubles") format = "senior-doubles";
        else if (rawFormat === "junior-singles") format = "junior-singles";
        else if (rawFormat === "junior-doubles") format = "junior-doubles";
        else if (rawFormat === "mixed-doubles") format = "mixed-doubles";
        else if (rawFormat === "men-doubles" || rawFormat === "doubles") format = "men-doubles";
        else if (rawFormat === "men-singles" || rawFormat === "singles") format = "men-singles";

        let skillLevel: SkillLevel = "3.5";
        const rawSkill = String(l.skillLevel || "").trim();
        if (["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"].includes(rawSkill)) {
          skillLevel = rawSkill as SkillLevel;
        } else if (rawSkill === "4.5+") {
          skillLevel = "4.5";
        } else if (rawSkill === "5.0+") {
          skillLevel = "5.0";
        }

        return {
          id: l.id || l.slug,
          seasonId: l.seasonId || l.seasonSlug || "s-fall-26",
          name: l.name,
          format,
          skillLevel,
          offeredSkillLevels: [skillLevel],
          area: l.area || l.geographicGroup || "Midtown",
          geographicGroup: l.area || l.geographicGroup || "Midtown",
          feeCents: l.feeCents,
          scheduleDay: l.scheduleDay,
          scheduleTime: l.scheduleTime,
          venue: l.venue,
          playerLimit: l.playerLimit,
          spotsRemaining: l.spotsRemaining,
          registeredCount: typeof l.registeredCount === "number" ? l.registeredCount : Math.max(0, l.playerLimit - (l.spotsRemaining ?? 0)),
          registrationOpen: l.registrationOpen,
          description: l.description,
          startDate: l.startDate,
          endDate: l.endDate,
        };
      });

      // Extract live seasons with operatingState from backend
      const seasonsFromApi: Season[] = [];
      const seasonSeen = new Set<string>();
      for (const item of json.data) {
        if (item.season && !seasonSeen.has(item.season.id)) {
          seasonSeen.add(item.season.id);
          seasonsFromApi.push({
            id: item.season.id,
            name: item.season.name,
            startDate: item.season.startDate,
            endDate: item.season.endDate,
            status: item.season.status,
            operatingState: item.season.operatingState || "active-season",
          });
        }
      }

      console.info("🎾 [DB_CONNECTED] Successfully loaded live leagues and season state from MongoDB backend.");

      setState((prev) => ({
        ...prev,
        leagues: dbLeagues,
        seasons: seasonsFromApi.length > 0 ? seasonsFromApi : prev.seasons,
        dbConnected: true,
        fallbackActive: false,
      }));
    } catch (err) {
      console.warn(
        "⚠️ [FALLBACK_TRIGGERED] Failed to reach backend API. Using local mock fallback data.",
        err,
      );
      setState((prev) => ({
        ...prev,
        dbConnected: false,
        fallbackActive: true,
      }));
    }
  }, []);

  const refreshSession = React.useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/auth/me"), { credentials: "include" });
      const json = await res.json();
      if (res.status === 401) {
        setCachedUser(null);
        setState(s => ({ ...s, user: null, players: [], registrations: [] }));
        return null;
      }
      if (!res.ok || !json.ok) throw new Error("Unable to verify your session");
      const user = json.data as AuthUser;
      const profileRes = await fetch(getApiUrl(`/api/players/${encodeURIComponent(user.email)}`), { credentials: "include" });
      const profile = await profileRes.json();
      if (!profileRes.ok || !profile.ok) throw new Error("Unable to load your profile");
      setCachedUser(user);
      setState(s => ({ ...s, user, players: [profile.data], registrations: [] }));
      return user;
    } catch (err: any) {
      // If it's a network error (backend offline), don't wipe the current session
      const isNetworkError = err?.message?.includes("Failed to fetch") || err?.message?.includes("NetworkError") || err?.message?.includes("ERR_CONNECTION_REFUSED");
      if (isNetworkError) {
        // Backend offline — leave existing in-memory user state intact
        return null;
      }
      setCachedUser(null);
      throw err;
    }
  }, []);

  React.useEffect(() => {
    // Remove the prototype's plaintext passwords and untrusted persisted identity.
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("atl-registered-accounts");
    } catch { /* Storage may be disabled. */ }

    // Fire leagues fetch immediately in parallel with auth/session checks
    void fetchDbData();

    void refreshSession()
      .catch((err) => {
        const isNetwork = err?.message?.includes("Failed to fetch") || err?.message?.includes("NetworkError");
        if (!isNetwork) {
          setCachedUser(null);
          setState(s => ({ ...s, user: null }));
        }
      })
      .finally(() => {
        try {
          const stored = JSON.parse(localStorage.getItem("atl-user-registrations") || "[]");
          if (Array.isArray(stored) && stored.length > 0) {
            setState((prev) => ({
              ...prev,
              registrations: [
                ...prev.registrations,
                ...stored.filter((sr: any) => !prev.registrations.some((r) => r.id === sr.id)),
              ],
              players: [
                ...prev.players,
                ...stored.map((sr: any) => sr.player).filter((p: any) => p && !prev.players.some((pl) => pl.id === p.id)),
              ],
            }));
          }
        } catch { }
        setHydrated(true);
      });
  }, [fetchDbData, refreshSession]);

  // Real-time updates via WebSocket with automatic reconnection and periodic focus polling
  React.useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let isDisposed = false;

    function connectWs() {
      if (typeof window === "undefined") return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.type && (data.type.startsWith("reservation.") || data.type.startsWith("league."))) {
              void fetchDbData();
            }
          } catch {}
        };
        ws.onclose = () => {
          if (!isDisposed) {
            reconnectTimer = setTimeout(connectWs, 3000);
          }
        };
        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (!isDisposed) {
          reconnectTimer = setTimeout(connectWs, 5000);
        }
      }
    }

    connectWs();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchDbData();
      }
    }, 12000);

    const onFocus = () => {
      void fetchDbData();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [fetchDbData]);

  const value = React.useMemo<StoreValue>(() => {
    return {
      ...state,
      hydrated,
      refreshFromDb: fetchDbData,
      refreshSession,
      login: async (email, password, expectedRole) => {
        try {
          const res = await fetch(getApiUrl("/api/auth/login"), {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, ...(expectedRole ? { expectedRole } : {}) }),
          });
          const json = await res.json();
          if (!res.ok || !json.ok) throw new Error(json.error || "Invalid email or password");
          const user = await refreshSession();
          if (!user) throw new Error("Unable to establish your session");
          setCachedUser(user);
          return user;
        } catch (error) {
          if (error instanceof TypeError || error instanceof SyntaxError) {
            throw new Error("Unable to reach sign-in. Please try again when the service is available.");
          }
          throw error;
        }
      },
      logout: async () => {
        try {
          await fetch(getApiUrl("/api/auth/logout"), { method: "POST", credentials: "include" });
        } catch { }
        setCachedUser(null);
        setState((s) => ({ ...s, user: null, players: [], registrations: [] }));
        sessionStorage.clear();
      },
      createSeason: (input) => {
        const season: Season = { ...input, id: uid("s") };
        setState((s) => ({ ...s, seasons: [season, ...s.seasons] }));
        return season;
      },
      createLeague: async (input) => {
        const tempId = uid("l");
        const optimisticLeague: League = { ...input, id: tempId };
        setState((s) => ({ ...s, leagues: [optimisticLeague, ...s.leagues] }));

        try {
          const res = await fetch(getApiUrl("/api/leagues"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(input),
          });
          
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          
          const json = await res.json();
          if (json.ok && json.data) {
            const serverLeague = json.data;
            setState((s) => ({
              ...s,
              leagues: s.leagues.map((l) =>
                l.id === tempId ? { ...l, ...serverLeague } : l
              ),
            }));
            return { ...optimisticLeague, ...serverLeague };
          }
        } catch (err) {
          console.error("Failed to persist league to backend:", err);
          // Rollback could be implemented here if desired
        }
        
        return optimisticLeague;
      },
      toggleRegistration: (leagueId) => {
        const target = state.leagues.find((l) => l.id === leagueId);
        const nextOpen = target ? !target.registrationOpen : true;
        setState((s) => ({
          ...s,
          leagues: s.leagues.map((l) =>
            l.id === leagueId ? { ...l, registrationOpen: nextOpen } : l,
          ),
        }));
        // Persist to backend if database is connected
        fetch(getApiUrl(`/api/leagues/${encodeURIComponent(leagueId)}`), {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationOpen: nextOpen }),
        }).catch((err) => {
          console.warn("Could not persist league registration toggle to backend:", err);
        });
      },
      registerPlayer: ({ leagueId, player, partnerId, preferredCourt }) => {
        const league = state.leagues.find((l) => l.id === leagueId)!;
        const existing = state.players.find((p) => p.email.toLowerCase() === player.email.toLowerCase());
        const court = preferredCourt || player.preferredCourt || existing?.preferredCourt || "Piedmont Park Courts";
        const saved: Player = existing
          ? { ...existing, ...player, preferredCourt: court }
          : { ...player, id: uid("p"), preferredCourt: court };
        const registration: Registration = {
          id: uid("r"),
          leagueId,
          playerId: saved.id,
          createdAt: new Date().toISOString().slice(0, 10),
          registrationStatus: "confirmed",
          paymentStatus: "paid",
          amountCents: league ? league.feeCents : 3500,
          skillLevelSnapshot: saved.ntrp,
          doublesPartnerId: partnerId || undefined,
          partnerStatus: partnerId ? "requested" : undefined,
          preferredCourt: court,
        };
        setState((s) => ({
          ...s,
          players: existing ? s.players.map((p) => (p.id === saved.id ? saved : p)) : [...s.players, saved],
          registrations: [...s.registrations, registration],
          user: s.user ? { ...s.user, playerId: s.user.role === "player" ? saved.id : s.user.playerId } : s.user,
        }));
        try {
          const stored = JSON.parse(localStorage.getItem("atl-user-registrations") || "[]");
          localStorage.setItem("atl-user-registrations", JSON.stringify([...stored, { ...registration, player: saved }]));
        } catch { }
        return { registration, player: saved };
      },
      updatePlayer: (playerId, patch) =>
        setState((s) => ({
          ...s,
          players: s.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
        })),
      upsertPlayer: (player) =>
        setState((s) => {
          const exists = s.players.some((p) => p.id === player.id || p.email.toLowerCase() === player.email.toLowerCase());
          const newPlayers = exists
            ? s.players.map((p) => (p.id === player.id || p.email.toLowerCase() === player.email.toLowerCase() ? player : p))
            : [...s.players, player];
          return {
            ...s,
            players: newPlayers,
            user: s.user && s.user.email.toLowerCase() === player.email.toLowerCase()
              ? { ...s.user, playerId: player.id, name: `${player.firstName} ${player.lastName}` }
              : s.user,
          };
        }),
      leagueById: (id) => state.leagues.find((l) => l.id === id),
      seasonById: (id) => state.seasons.find((s) => s.id === id),
      registrationsForLeague: (leagueId) => state.registrations.filter((r) => r.leagueId === leagueId),
      registrationsForPlayer: (playerId) => state.registrations.filter((r) => r.playerId === playerId),
      spotsLeft: (leagueId) => {
        const league = state.leagues.find((l) => l.id === leagueId);
        if (!league) return 0;
        // If live spotsRemaining exists from DB, use it directly
        if (typeof (league as any).spotsRemaining === "number") {
          return (league as any).spotsRemaining;
        }
        return Math.max(0, league.playerLimit - state.registrations.filter((r) => r.leagueId === leagueId).length);
      },
      matchesForPlayer: (playerId) => {
        // Return only real, explicitly created/assigned fixtures. No fake auto-generation!
        return state.matches.filter((m) => m.playerId === playerId || m.opponentId === playerId);
      },
      statsForPlayer: (playerId) => {
        // Only accepted match results contribute to official stats
        const acceptedForPlayer = state.results.filter(
          (r) => r.status === "accepted" && (r.submittedBy === playerId || r.winnerId === playerId),
        );
        const matchesPlayed = acceptedForPlayer.length;
        const wins = acceptedForPlayer.filter((r) => r.winnerId === playerId).length;
        const losses = matchesPlayed - wins;
        const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
        return { matchesPlayed, wins, losses, winRate };
      },
      resultsForPlayer: (playerId) => {
        return state.results.filter((r) => {
          const match = state.matches.find((m) => m.id === r.matchId);
          return (
            r.submittedBy === playerId ||
            r.winnerId === playerId ||
            match?.playerId === playerId ||
            match?.opponentId === playerId
          );
        });
      },
      submitMatchScore: ({ matchId, submittedBy, scoreData, winnerId, role = "player" }) => {
        const isOrganizer = role === "organizer";
        const now = new Date().toISOString();
        const newResult: MatchResult = {
          resultId: uid("res"),
          matchId,
          submittedBy,
          scoreData,
          winnerId,
          status: isOrganizer ? "accepted" : "awaiting-confirmation",
          submittedAt: now,
          ...(isOrganizer ? { confirmedAt: now, confirmedBy: "organizer" } : {}),
        };
        setState((s) => ({
          ...s,
          results: [newResult, ...s.results.filter((r) => r.matchId !== matchId)],
          matches: s.matches.map((m) =>
            m.id === matchId ? { ...m, matchStatus: isOrganizer ? "completed" : "scheduled" } : m,
          ),
        }));
      },
      confirmMatchResult: (resultId) => {
        setState((s) => {
          const target = s.results.find((r) => r.resultId === resultId);
          if (!target) return s;
          const updatedResult: MatchResult = {
            ...target,
            status: "accepted",
            confirmedAt: new Date().toISOString(),
            confirmedBy: "organizer",
          };
          return {
            ...s,
            results: s.results.map((r) => (r.resultId === resultId ? updatedResult : r)),
            matches: s.matches.map((m) =>
              m.id === target.matchId ? { ...m, matchStatus: "completed" } : m,
            ),
          };
        });
      },
      disputeMatchResult: (resultId, reason) => {
        setState((s) => {
          const target = s.results.find((r) => r.resultId === resultId);
          if (!target) return s;
          const updatedResult: MatchResult = {
            ...target,
            status: "disputed",
            disputeReason: reason || "Dispute raised by league organizer or player review.",
            confirmedAt: new Date().toISOString(),
            confirmedBy: "organizer",
          };
          return {
            ...s,
            results: s.results.map((r) => (r.resultId === resultId ? updatedResult : r)),
            matches: s.matches.map((m) =>
              m.id === target.matchId ? { ...m, matchStatus: "scheduled" } : m,
            ),
          };
        });
      },
      searchPartners: (query, excludePlayerId) => {
        const q = query.trim().toLowerCase();
        if (!q) return state.players.filter((p) => p.id !== excludePlayerId).slice(0, 5);
        return state.players
          .filter((p) => p.id !== excludePlayerId)
          .filter(
            (p) =>
              p.firstName.toLowerCase().includes(q) ||
              p.lastName.toLowerCase().includes(q) ||
              p.id.toLowerCase().includes(q) ||
              `${p.firstName} ${p.lastName}`.toLowerCase().includes(q),
          );
      },
    };
  }, [state, hydrated, fetchDbData, refreshSession]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
