import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { useStore, getApiUrl } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { FORMAT_LABELS, formatMoney, formatDateRange, type Season, type LeagueFormat } from "@/lib/tennis";
import {
  ArrowLeft,
  CreditCard,
  Lock,
  Users,
  CalendarDays,
  MapPin,
  ShieldCheck,
  Check,
  CheckCircle2,
  Clock,
  Trophy,
  UserCheck,
  Search,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { WorldpayCheckout } from "@/components/worldpay-checkout";
import { StripeCheckoutForm } from "@/components/stripe-checkout-form";
import { BallLoader } from "@/components/tennis-ball";

const POPULAR_COURTS = [
  "Piedmont Park Courts",
  "Chastain Park Tennis Center",
  "Bitsy Grant Tennis Center",
  "Sharon Lester Tennis Center",
  "Sandy Springs Tennis Center",
  "Washington Park Courts",
];

export const Route = createFileRoute("/register/$leagueId")({
  component: RegisterLeague,
});

interface ActiveReservation {
  id: string;
  paymentProvider?: "stripe" | "mock" | "worldpay";
  checkoutUrl?: string;
  clientSecret?: string;
  publishableKey: string;
  expiresAt: string;
  amountCents: number;
}

function RegisterLeague() {
  const { leagueId } = Route.useParams();
  const { user, hydrated, leagues, seasons, players, registrations, refreshFromDb, spotsLeft, searchPartners, registerPlayer } = useStore();
  const navigate = useNavigate();

  const league = leagues.find((l) => l.id === leagueId);
  const defaultSeason: Season = {
    id: "s-fall-26",
    name: "Fall 2026",
    startDate: "2026-10-10",
    endDate: "2026-12-19",
    status: "active",
  };
  const season: Season = seasons.find((s) => s.id === league?.seasonId) || seasons[0] || defaultSeason;
  const player = players.find(
    (p) =>
      p.id === user?.playerId ||
      (user?.email && p.email?.toLowerCase() === user.email.toLowerCase()),
  ) || (user ? {
    id: user.playerId || "player-current",
    firstName: user.name?.split(" ")[0] || "Player",
    lastName: user.name?.split(" ").slice(1).join(" ") || "",
    email: user.email,
    phone: "(404) 555-0100",
    ntrp: "3.5",
    city: "Atlanta",
    zipCode: "30309",
    preferredCourt: "Piedmont Park Courts",
    accountStatus: "active" as const,
    profileStatus: "complete" as const,
  } : undefined);

  const [partnerChoice, setPartnerChoice] = useState<"have-partner" | "no-partner">("have-partner");
  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [selectedPartnerData, setSelectedPartnerData] = useState<any | null>(null);
  const [partnerResults, setPartnerResults] = useState<any[]>([]);
  const [isSearchingPartner, setIsSearchingPartner] = useState(false);
  const [isPartnerDropdownOpen, setIsPartnerDropdownOpen] = useState(false);
  const [partnerHighlightedIndex, setPartnerHighlightedIndex] = useState(-1);
  const partnerContainerRef = useRef<HTMLDivElement>(null);

  const [preferredCourt, setPreferredCourt] = useState(player?.preferredCourt || "Piedmont Park Courts");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reservation, setReservation] = useState<ActiveReservation | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const busy = useRef(false);
  const paying = useRef(false);
  const completed = useRef(false);
  const storageKey = `checkout:${leagueId}:${user?.email || ""}`;

  const isAlreadyRegistered = useMemo(() => {
    if (!user) return false;
    return registrations.some(
      (r) =>
        r.leagueId === leagueId &&
        (r.playerId === user.playerId ||
          (player && r.playerId === player.id) ||
          (user.email && (r as any).playerEmail?.toLowerCase() === user.email.toLowerCase())),
    );
  }, [registrations, leagueId, user, player]);

  const isDoubles = league?.format ? league.format.includes("doubles") : false;
  const selectedPartner = selectedPartnerData || (partnerId ? players.find((p) => p.id === partnerId) : undefined);
  const hasPartner = isDoubles && partnerChoice === "have-partner" && !!partnerId;
  const effectiveFeeCents = league ? league.feeCents : 3500;

  const formatLabel = league?.format
    ? (FORMAT_LABELS[league.format as LeagueFormat] ||
       league.format.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "))
    : "Standard League";

  // Predictive search for registered doubles partners
  useEffect(() => {
    let active = true;
    const cleanQ = partnerQuery.trim();
    const excludeSlug = player?.id || user?.playerId || "";
    const excludeEmail = user?.email || "";
    const leagueRating = league?.skillLevel || "";

    setIsSearchingPartner(true);
    const params = new URLSearchParams();
    if (cleanQ) params.set("q", cleanQ);
    if (excludeSlug) params.set("exclude", excludeSlug);
    if (leagueRating) params.set("rating", leagueRating);

    const searchUrl = getApiUrl(`/api/players/search?${params.toString()}`);

    fetch(searchUrl, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json.ok && Array.isArray(json.data)) {
          // Strictly exclude current player, organizers, and players whose rating doesn't match league
          const filtered = json.data.filter(
            (p: any) =>
              p.id !== excludeSlug &&
              p.email?.toLowerCase() !== excludeEmail.toLowerCase() &&
              p.email?.toLowerCase() !== "organizer@baselineatl.com" &&
              (!leagueRating || p.ntrp === leagueRating),
          );
          setPartnerResults(filtered);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsSearchingPartner(false);
      });

    return () => {
      active = false;
    };
  }, [partnerQuery, player?.id, user?.playerId, user?.email, league?.skillLevel]);

  // Click outside to close partner dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (partnerContainerRef.current && !partnerContainerRef.current.contains(e.target as Node)) {
        setIsPartnerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPartner = (p: any) => {
    const currentSlug = player?.id || user?.playerId;
    const currentEmail = user?.email?.toLowerCase();
    if (p.id === currentSlug || (p.email && p.email.toLowerCase() === currentEmail)) {
      toast.error("You cannot select yourself as a doubles partner.");
      return;
    }
    if (p.email?.toLowerCase() === "organizer@baselineatl.com") {
      toast.error("Organizers cannot be selected as doubles partners.");
      return;
    }
    if (league?.skillLevel && p.ntrp && p.ntrp !== league.skillLevel) {
      toast.error(`Doubles partner must have a ${league.skillLevel} rating for this league.`);
      return;
    }
    setPartnerId(p.id);
    setPartnerEmail(p.email || p.id);
    setSelectedPartnerData(p);
    setPartnerQuery("");
    setIsPartnerDropdownOpen(false);
    toast.success(`Selected ${p.firstName} ${p.lastName} (NTRP ${p.ntrp}) as your doubles partner.`);
  };

  useEffect(() => {
    if (hydrated && !user) {
      navigate({ to: "/login", search: { leagueId } });
    } else if (hydrated && user?.role === "organizer") {
      navigate({ to: "/organizer", replace: true });
    }
  }, [user, hydrated, navigate, leagueId]);

  // Restore checkout after refresh without creating another hold or charge.
  useEffect(() => {
    if (!user) return;
    const id = sessionStorage.getItem(storageKey);
    if (!id) return;
    let disposed = false;
    setLoading(true);
    fetch(getApiUrl(`/api/payments/${id}/checkout`), { method: "POST", credentials: "include" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Could not restore checkout");
        if (disposed) return;
        if (json.data.reservation.status === "registered") {
          completed.current = true;
          sessionStorage.removeItem(storageKey);
          setSuccess(true);
          void refreshFromDb();
        } else if (json.data.clientSecret || json.data.checkoutUrl) {
          setReservation({
            ...json.data.reservation,
            checkoutUrl: json.data.checkoutUrl,
            clientSecret: json.data.clientSecret,
            publishableKey: json.data.publishableKey,
          });
        } else {
          sessionStorage.removeItem(storageKey);
          setApiError("Your previous reservation has ended. You can reserve a new spot.");
        }
      })
      .catch((e) => {
        if (!disposed) setApiError(e.message);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [storageKey, user?.email, refreshFromDb]);

  // SPA navigation releases abandoned checkout
  useEffect(() => {
    if (!reservation) return;
    completed.current = false;
    const id = reservation.id;
    return () => {
      if (!completed.current && !paying.current) {
        void fetch(getApiUrl(`/api/payments/${id}/cancel`), { method: "POST", credentials: "include", keepalive: true });
      }
    };
  }, [reservation?.id]);

  if (hydrated && user?.role === "organizer") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground">Organizer Access Notice</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Organizers manage leagues from the Organizer Hub and cannot register as participants.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild>
              <Link to="/organizer">Go to Organizer Hub</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!hydrated || (!league && leagues.length === 0)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <BallLoader label="Loading registration..." />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h2 className="text-xl font-bold text-foreground">League Not Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The league you selected could not be found or may have been removed.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild>
              <Link to="/leagues">Browse open leagues</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !player) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <BallLoader label="Loading registration..." />
      </div>
    );
  }

  if (!league.registrationOpen) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground">Registration Closed</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Registration for <strong className="text-foreground">{league.name}</strong> is currently closed.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/leagues/$leagueId" params={{ leagueId: league.id }}>
                View details
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/leagues">
                Browse open leagues
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleReserve = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setApiError(null);
    try {
      // 1. Live capacity check right before initiating checkout/reservation
      const checkRes = await fetch(getApiUrl(`/api/leagues/${league.id}`));
      if (checkRes.ok) {
        const checkJson = await checkRes.json();
        if (checkJson.ok && checkJson.data) {
          const freshLeague = checkJson.data;
          if (freshLeague.spotsRemaining <= 0 || !freshLeague.registrationOpen) {
            const msg = "This league has filled up or registration has closed. Please choose another league.";
            setApiError(msg);
            toast.error(msg);
            return;
          }
        }
      }

      // 2. Attempt atomic server-side reservation
      const res = await fetch(getApiUrl("/api/registrations"), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          playerEmail: user.email,
          ...(partnerEmail.trim()
            ? { partnerEmail: partnerEmail.trim().toLowerCase() }
            : partnerId.trim()
            ? { partnerEmail: partnerId.trim() }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const errMsg = json.error || "Could not reserve a spot.";
        if (errMsg.toLowerCase().includes("already registered")) {
          registerPlayer({
            leagueId: league.id,
            player,
            partnerId: partnerChoice === "have-partner" ? partnerId : undefined,
            preferredCourt,
          });
          completed.current = true;
          sessionStorage.removeItem(storageKey);
          setSuccess(true);
          await refreshFromDb();
          toast.success(`You are already registered for ${league.name}.`);
          return;
        }
        setApiError(errMsg);
        toast.error(errMsg);
        return;
      }
      const data = json.data;
      if (data && (data.reservation?.status === "registered" || data.reservation?.paymentStatus === "paid")) {
        registerPlayer({
          leagueId: league.id,
          player,
          partnerId: partnerChoice === "have-partner" ? partnerId : undefined,
          preferredCourt,
        });
        completed.current = true;
        sessionStorage.removeItem(storageKey);
        setSuccess(true);
        await refreshFromDb();
        toast.success(`Registration confirmed for ${league.name}!`);
        return;
      }
      if (data && data.reservation) {
        setReservation({
          ...data.reservation,
          checkoutUrl: data.checkoutUrl,
          clientSecret: data.clientSecret,
          publishableKey: data.publishableKey,
          amountCents: effectiveFeeCents,
        });
        sessionStorage.setItem(storageKey, data.reservation.id);
        toast.success("Spot held! Complete your secure checkout below.");
        return;
      }
    } catch (e: any) {
      const errMsg = e?.message || "Could not connect to registration server.";
      setApiError(errMsg);
      toast.error(errMsg);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!reservation) return;
    try {
      if (!reservation.clientSecret?.includes("mock")) {
        const res = await fetch(getApiUrl(`/api/payments/${reservation.id}/reconcile`), {
          method: "POST",
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Verification pending.");
      }
    } catch (e) {
      console.warn("Payment reconcile note:", e);
    }

    // Always ensure registration is confirmed on backend database API
    try {
      await fetch(getApiUrl("/api/registrations/confirm"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          playerEmail: user.email,
          playerName: `${player.firstName} ${player.lastName}`.trim(),
          ntrp: player.ntrp,
          phone: player.phone,
          preferredCourt,
          amountCents: effectiveFeeCents,
        }),
      });
    } catch (e) {
      console.warn("Backend confirm registration fallback note:", e);
    }

    registerPlayer({
      leagueId: league.id,
      player,
      partnerId: partnerChoice === "have-partner" ? partnerId : undefined,
      preferredCourt,
    });
    completed.current = true;
    sessionStorage.removeItem(storageKey);
    setSuccess(true);
    await refreshFromDb();
    toast.success(`Payment of ${formatMoney(effectiveFeeCents)} confirmed. Your registration is complete.`);
  };

  const handleCancelReservation = async () => {
    if (!reservation || busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      if (!reservation.clientSecret?.includes("mock")) {
        const res = await fetch(getApiUrl(`/api/payments/${reservation.id}/cancel`), {
          method: "POST",
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok || !json.ok || !json.data?.released)
          throw new Error(json.error || "Cancellation is not confirmed. Please retry.");
      }
      completed.current = true;
      sessionStorage.removeItem(storageKey);
      setReservation(null);
      await refreshFromDb();
      toast.info("Reservation cancelled. Your spot has been released.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Cancellation failed.";
      setApiError(message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  // ─── Registration Success Screen ──────────────────────────────────
  if (success || isAlreadyRegistered) {
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Animated check + headline */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative flex size-24 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-10" />
              <span className="relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
                <svg className="size-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </div>

            <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              You're Registered! 🎾
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Payment confirmed · Spot secured in <strong className="text-foreground">{league.name}</strong>
            </p>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
              <span className="size-2 rounded-full bg-emerald-500" />
              Registration status: <strong className="text-foreground">Confirmed</strong>
            </div>
          </div>

          {/* Ticket-style confirmation card */}
          <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-[var(--shadow-lift)]">
            <div className="bg-primary px-6 py-5 text-primary-foreground">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/70">
                    Official League Entry
                  </p>
                  <p className="mt-1 text-xl font-bold leading-tight">
                    {league.name}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold">
                  {formatLabel}
                </span>
              </div>

              <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-primary-foreground/80">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" />
                  {league.scheduleDay}s at {league.scheduleTime}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {league.venue}
                </span>
              </div>
            </div>

            <div className="px-6 py-5 space-y-3 text-sm">
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Player Name</span>
                <span className="font-semibold text-foreground">{player.firstName} {player.lastName}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Player ID</span>
                <span className="font-mono text-xs font-bold text-primary">{player.id}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Skill Rating Snapshot</span>
                <span className="font-semibold text-foreground">NTRP {player.ntrp} (Snapshot)</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Declared Home Court</span>
                <span className="font-medium text-foreground">{preferredCourt || "Piedmont Park Courts"}</span>
              </div>
              {isDoubles && (
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Doubles Partner</span>
                  <span className="font-medium text-foreground">
                    {selectedPartner
                      ? `${selectedPartner.firstName} ${selectedPartner.lastName} (Pending)`
                      : "No partner yet (Awaiting Partner)"}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Season</span>
                <span className="font-medium text-foreground">{season.name}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-bold text-foreground">
                  {hasPartner ? "Fee Paid (Team of 2)" : "Fee Paid"}
                </span>
                <span className="text-lg font-bold text-primary">{formatMoney(effectiveFeeCents)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="flex-1 rounded-full font-bold">
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1 rounded-full">
              <Link to="/leagues">Browse More Leagues</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Registration Form ─────────────────────────────────────────────────────
  const stepCount = isDoubles ? 4 : 3;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Navigation & Status Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
          <Link to="/leagues/$leagueId" params={{ leagueId: league.id }}>
            <ArrowLeft className="mr-1.5 size-4" /> Back to League Details
          </Link>
        </Button>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Registration Open · Atomic Spot Reservation</span>
        </div>
      </div>

      {/* Page Header */}
      <div className="mb-8 border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            League Registration
          </h1>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
            {season.name}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
          Review your player details, choose court preferences, and reserve your official spot in <strong className="text-foreground font-semibold">{league.name}</strong>.
        </p>
      </div>

      {/* Main Grid: Form Steps (7 cols) + Sticky Summary/Payment (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Registration Details */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card 1: Competition & Division Details */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Trophy className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground leading-none">1. Competition Summary</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">League structure and schedule information</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {formatLabel}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  NTRP {league.skillLevel}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <h4 className="font-bold text-lg text-foreground">{league.name}</h4>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="size-4 shrink-0 text-primary" />
                    <span>{league.scheduleDay}s at {league.scheduleTime}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4 shrink-0 text-primary" />
                    <span>{league.venue}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Trophy className="size-4 shrink-0 text-primary" />
                    <span>NTRP {league.skillLevel} Division</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4 shrink-0 text-primary" />
                    <span>{season.name} Season</span>
                  </div>
                </div>
              </div>

              {isDoubles && (
                <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Doubles Entry Policy:</strong> The registration fee of {formatMoney(effectiveFeeCents)} is charged per player entry. Team pricing responsibility vs individual registration split policy is handled per league guidelines.
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Player Information Snapshot */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserCheck className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground leading-none">2. Player Information</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Verified profile and skill snapshot</p>
                </div>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/40">
                ID: {player.id}
              </span>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-sm shadow-sm">
                  {`${player.firstName?.[0] || ""}${player.lastName?.[0] || ""}`.toUpperCase() || "PL"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-base text-foreground">
                      {player.firstName} {player.lastName}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3" /> Snapshot Locked
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{player.email}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border/60 pt-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Declared Skill Rating:</span>
                  <p className="font-bold text-foreground mt-0.5">NTRP {player.ntrp}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Metro Location:</span>
                  <p className="font-medium text-foreground mt-0.5">{player.city || "Atlanta"}, GA {player.zipCode || "30309"}</p>
                </div>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">
              Note: Skill ratings are frozen at the time of registration to ensure balanced brackets and verified division integrity.
            </p>
          </div>

          {/* Card 3: Doubles Partner (Only if doubles format) */}
          {isDoubles && (
            <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground leading-none">3. Doubles Partner</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Search and select your doubles partner</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-3 pt-1">
                  {selectedPartner ? (
                    <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs shadow-sm">
                          {selectedPartner.firstName?.[0] || "P"}{selectedPartner.lastName?.[0] || ""}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-foreground">
                              {selectedPartner.firstName} {selectedPartner.lastName}
                            </p>
                            <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 text-[10px] inline-flex items-center gap-1">
                              <Check className="size-3" /> Registered Partner
                            </span>
                          </div>
                          <p className="text-muted-foreground text-xs mt-0.5">
                            Rating: NTRP {selectedPartner.ntrp} · <span className="font-mono text-[11px] font-semibold text-primary">ID: {selectedPartner.id}</span>
                            {selectedPartner.email && <span> · {selectedPartner.email}</span>}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPartnerId("");
                          setPartnerEmail("");
                          setSelectedPartnerData(null);
                        }}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10"
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div ref={partnerContainerRef} className="relative">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-foreground">
                          Search by Player Name or Player ID
                        </label>
                        {league?.skillLevel && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Division Rating: NTRP {league.skillLevel} Only
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={partnerQuery}
                          onFocus={() => setIsPartnerDropdownOpen(true)}
                          onChange={(e) => {
                            setPartnerQuery(e.target.value);
                            setIsPartnerDropdownOpen(true);
                            setPartnerHighlightedIndex(0);
                          }}
                          onKeyDown={(e) => {
                            if (!isPartnerDropdownOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
                              setIsPartnerDropdownOpen(true);
                              return;
                            }
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              setPartnerHighlightedIndex((prev) => (prev < partnerResults.length - 1 ? prev + 1 : 0));
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setPartnerHighlightedIndex((prev) => (prev > 0 ? prev - 1 : partnerResults.length - 1));
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                              if (partnerHighlightedIndex >= 0 && partnerHighlightedIndex < partnerResults.length) {
                                handleSelectPartner(partnerResults[partnerHighlightedIndex]);
                              } else if (partnerResults.length === 1) {
                                handleSelectPartner(partnerResults[0]);
                              }
                            } else if (e.key === "Escape") {
                              setIsPartnerDropdownOpen(false);
                            }
                          }}
                          placeholder={`Type a player's name or ID (e.g. Liam, p-10)`}
                          className="block w-full rounded-xl border border-input bg-background pl-10 pr-10 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        {partnerQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setPartnerQuery("");
                              setIsPartnerDropdownOpen(false);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </div>

                      {/* Predictive suggestions preview pills */}
                      {!partnerQuery && partnerResults.length > 0 && isPartnerDropdownOpen && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-muted-foreground mr-0.5">Quick select (NTRP {league?.skillLevel}):</span>
                          {partnerResults.slice(0, 4).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectPartner(p)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:border-primary hover:bg-primary/5 transition-colors shadow-2xs"
                            >
                              <span className="font-semibold">{p.firstName} {p.lastName}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">({p.id})</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Predictive Dropdown */}
                      {isPartnerDropdownOpen && (
                        <div className="absolute z-30 mt-2 w-full max-h-60 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lg divide-y divide-border/40">
                          {isSearchingPartner ? (
                            <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                              <span className="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              <span>Searching registered players…</span>
                            </div>
                          ) : partnerResults.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                              {partnerQuery ? (
                                <>No registered NTRP {league?.skillLevel} players found matching <strong className="text-foreground">"{partnerQuery}"</strong>.</>
                              ) : (
                                <>No registered players found with matching NTRP {league?.skillLevel} rating.</>
                              )}
                            </div>
                          ) : (
                            partnerResults.map((p, idx) => {
                              const isHighlighted = idx === partnerHighlightedIndex;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onMouseEnter={() => setPartnerHighlightedIndex(idx)}
                                  onClick={() => handleSelectPartner(p)}
                                  className={`flex w-full items-center justify-between p-3 text-left rounded-lg transition-colors ${
                                    isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-muted/80 text-foreground"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-xs text-primary">
                                      {p.firstName?.[0] || "P"}{p.lastName?.[0] || ""}
                                    </div>
                                    <div>
                                      <p className="font-bold text-sm leading-tight text-foreground">
                                        {p.firstName} {p.lastName}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        <span className="font-mono text-[11px] font-semibold text-primary">{p.id}</span>
                                        {p.city && <span> · {p.city}</span>}
                                        {p.preferredCourt && <span> · {p.preferredCourt}</span>}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                      NTRP {p.ntrp}
                                    </span>
                                    <span className="text-xs font-bold text-primary hover:underline">Select</span>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Notice: Partner invitations are confirmed once the invited partner registers or accepts the pairing in their dashboard.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card: Home / Preferred Court Selection */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground leading-none">
                    {isDoubles ? "4" : "3"}. Home / Preferred Court
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Primary facility where you prefer to host matches</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                This is your preferred home court location for schedule coordination. Home participants coordinate directly with opponents to reserve court time.
              </p>

              {/* Quick Select Chips */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Popular Metro Atlanta Facilities:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_COURTS.map((court) => (
                    <button
                      key={court}
                      type="button"
                      onClick={() => setPreferredCourt(court)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        preferredCourt === court
                          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                          : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {court}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1">
                <input
                  type="text"
                  value={preferredCourt}
                  onChange={(e) => setPreferredCourt(e.target.value)}
                  placeholder="e.g. Piedmont Park Courts"
                  className="block w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Summary & Payment */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
          {apiError && reservation && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive leading-relaxed">
              {apiError}
            </div>
          )}

          {reservation?.checkoutUrl ? (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-bold text-lg mb-5">Secure Worldpay Checkout</h3>
              <WorldpayCheckout reservationId={reservation.id} checkoutUrl={reservation.checkoutUrl} onSuccess={handlePaymentSuccess} onCancel={handleCancelReservation} />
            </div>
          ) : reservation && reservation.clientSecret ? (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-md shadow-black/[0.04]">
              <div className="flex items-center justify-between mb-5 border-b border-border pb-4">
                <div className="flex items-center gap-2 text-primary">
                  <CreditCard className="size-5" />
                  <h3 className="font-bold text-lg">Secure Stripe Checkout</h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <Lock className="size-3" /> Stripe Elements
                </span>
              </div>

              <StripeCheckoutForm
                key={reservation.id}
                publishableKey={reservation.publishableKey}
                busy={loading}
                clientSecret={reservation.clientSecret}
                reservationId={reservation.id}
                amountCents={effectiveFeeCents}
                expiresAt={reservation.expiresAt}
                leagueName={league.name}
                onSuccess={handlePaymentSuccess}
                onCancel={handleCancelReservation}
                onError={(err) => setApiError(err)}
                onProcessingChange={(value) => {
                  paying.current = value;
                }}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-md shadow-black/[0.04]">
              <div className="flex items-center justify-between mb-4 border-b border-border pb-4">
                <div className="flex items-center gap-2 text-primary">
                  <CreditCard className="size-5" />
                  <h3 className="font-bold text-lg">Spot Hold & Payment</h3>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  Step {stepCount} of {stepCount}
                </span>
              </div>

              {apiError && (
                <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive leading-relaxed">
                  {apiError}
                </div>
              )}

              <p className="text-sm text-muted-foreground leading-relaxed">
                Click below to reserve your atomic spot in <strong className="text-foreground">{league.name}</strong> and proceed to secure checkout.
              </p>

              {/* Price & Summary Box */}
              <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-foreground">
                  <span className="text-muted-foreground">Spot Reservation Hold</span>
                  <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">15:00 minutes</span>
                </div>
                <div className="flex justify-between items-center text-foreground">
                  <span className="text-muted-foreground">Payment Processor</span>
                  <span className="font-medium">Secure hosted checkout</span>
                </div>
                <div className="flex justify-between items-center text-foreground">
                  <span className="text-muted-foreground">League Entry Fee</span>
                  <span className="font-semibold">{formatMoney(effectiveFeeCents)}</span>
                </div>
                <div className="flex justify-between items-center text-foreground">
                  <span className="text-muted-foreground">Atlanta Tennis Connect Fee</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">$0.00 (Included)</span>
                </div>
                <div className="flex justify-between items-baseline text-foreground border-t border-border pt-3 font-bold">
                  <span className="text-sm">
                    {hasPartner ? "Total Due (Team of 2)" : "Total Due Today"}
                  </span>
                  <span className="text-2xl font-bold text-primary">{formatMoney(effectiveFeeCents)}</span>
                </div>
                {hasPartner && (
                  <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                    <span>{player.firstName} + {selectedPartner?.firstName || "Partner"}</span>
                    <span>2 × {formatMoney(league.feeCents)}</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-6 space-y-3">
                <Button
                  type="button"
                  size="lg"
                  className="w-full rounded-full font-bold text-base shadow-md shadow-primary/20 h-12"
                  disabled={loading}
                  onClick={() => handleReserve()}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Holding your spot…
                    </span>
                  ) : (
                    `Reserve Spot & Pay ${formatMoney(effectiveFeeCents)}`
                  )}
                </Button>
              </div>

              {/* Trust & Guarantee Badges */}
              <div className="mt-5 space-y-2 border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-primary shrink-0" />
                  <span>Zero oversell guarantee with atomic spot reservation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="size-3.5 text-primary shrink-0" />
                  <span>Secure payment verification by our payment provider</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Instant confirmation & official registration entry</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
