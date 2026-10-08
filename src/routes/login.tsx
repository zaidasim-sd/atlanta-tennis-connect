import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { FORMAT_LABELS, formatMoney } from "@/lib/tennis";
import { TennisBall } from "@/components/tennis-ball";
import { toast } from "sonner";
import {
  MapPin,
  CalendarDays,
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { leagueId?: string | undefined; redirect?: string | undefined } => ({
    leagueId:
      typeof search["leagueId"] === "string"
        ? (search["leagueId"] as string)
        : undefined,
    redirect:
      typeof search["redirect"] === "string"
        ? (search["redirect"] as string)
        : undefined,
  }),
  component: Login,
});

// ─── Step indicator ─────────────────────────────────────────────────────────
const STEPS = ["League", "Sign in", "Payment", "Confirmed"] as const;

function Stepper({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-start justify-center">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={label} className="flex items-start">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ring-2 transition-all ${
                  done || active
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-background text-muted-foreground ring-border"
                }`}
              >
                {done ? (
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  n
                )}
              </div>
              <span
                className={`whitespace-nowrap text-[10px] font-semibold ${
                  active
                    ? "text-primary"
                    : done
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-1.5 mt-4 h-0.5 w-10 shrink-0 rounded-full transition-all sm:w-14 ${
                  done ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
function Login() {
  const { user, hydrated, login, logout, leagueById } = useStore();
  const navigate = useNavigate();
  const { leagueId, redirect } = Route.useSearch();
  const targetLeagueId = leagueId || (redirect?.startsWith("/leagues/") ? redirect.replace("/leagues/", "") : undefined);
  const leagueData = targetLeagueId ? leagueById(targetLeagueId) : undefined;

  const [role, setRole] = useState<"player" | "organizer">("player");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (hydrated && user?.role === "organizer") {
      navigate({ to: "/organizer", replace: true });
    }
  }, [hydrated, user, navigate]);

  if (hydrated && user?.role === "organizer") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm max-w-md w-full text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
            <ShieldCheck className="size-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Already Signed In</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are currently signed in as an active organizer (<strong>{user.email}</strong>). You cannot sign in again while an active organizer session is active.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button asChild size="lg" className="rounded-full font-bold">
              <Link to="/organizer">
                Go to Organizer Hub →
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full"
              onClick={async () => {
                try {
                  await logout();
                  toast.success("Signed out successfully.");
                } catch {
                  toast.error("Sign out failed.");
                }
              }}
            >
              Sign out to switch accounts
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const clearErrors = () => {
    setEmailError("");
    setPasswordError("");
  };

  const handleRoleChange = (r: "player" | "organizer") => {
    setRole(r);
    clearErrors();
    setEmail("");
    setPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setLoading(true);
    try {
      const user = await login(email.trim().toLowerCase(), password, role);
      if (role === "player" && user.role === "organizer") {
        await logout();
        setPasswordError("Invalid email or password");
        return;
      }
      if (role === "organizer" && user.role !== "organizer") {
        await logout();
        setPasswordError("Invalid email or password");
        return;
      }

      if (user.role === "organizer") {
        navigate({ to: "/organizer" });
      } else if (redirect) {
        window.location.assign(redirect);
      } else if (leagueId) {
        if (leagueData && !leagueData.registrationOpen) {
          navigate({ to: "/leagues/$leagueId", params: { leagueId } });
        } else {
          navigate({ to: "/register/$leagueId", params: { leagueId } });
        }
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Unable to sign in");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[90vh] bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg">
        {/* Progress stepper */}
        {leagueData && <Stepper current={2} />}

        {/* Notice banner for redirected visitors */}
        {redirect && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm font-medium text-foreground shadow-sm">
            <AlertCircle className="size-5 shrink-0 text-primary" />
            <p>
              Please sign in or create an account to continue with your league registration.
            </p>
          </div>
        )}

        {/* Selected league card */}
        {leagueData && (
          <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <TennisBall className="size-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Your Selected League
                </span>
              </div>
              <Link
                to="/leagues/$leagueId"
                params={{ leagueId: targetLeagueId! }}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                Change
              </Link>
            </div>
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold leading-tight text-foreground">
                  {leagueData.name}
                </h3>
                <span className="mt-1.5 inline-block rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                  {FORMAT_LABELS[leagueData.format]}
                </span>
                <div className="mt-2.5 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 shrink-0 text-primary" />
                    {leagueData.scheduleDay}s at {leagueData.scheduleTime}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0 text-primary" />
                    {leagueData.venue}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  League Fee
                </p>
                <p className="mt-1 font-display text-3xl font-bold text-primary">
                  {formatMoney(leagueData.feeCents)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Auth card */}
        <div className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)] sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {leagueData || redirect ? "Sign in to continue" : "Sign in to your account"}
            </h1>
            {leagueData && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Use your account to continue your registration for{" "}
                <strong className="font-semibold text-foreground">
                  {leagueData.name}
                </strong>
                .
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role toggle */}
            <div className="flex rounded-lg border border-border bg-muted p-1">
              {(["player", "organizer"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChange(r)}
                  className={`flex-1 rounded-md py-2 text-sm font-semibold capitalize transition-all ${
                    role === r
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "player" ? "Player" : "Organizer"}
                </button>
              ))}
            </div>

            {/* Organizer demo note */}
            {role === "organizer" && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-xs">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="size-4 text-primary shrink-0" />
                  <span>Organizer Sign-in</span>
                </div>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Use your administrator-provided account. Organizer access is verified by the server.
                </p>
              </div>
            )}

            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                placeholder="you@example.com"
                className={`block w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2 ${
                  emailError
                    ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                    : "border-input focus:border-primary focus:ring-primary/20"
                }`}
              />
              {emailError && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {emailError}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground"
                >
                  Password
                </label>

              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  placeholder="Enter your password"
                  className={`block w-full rounded-lg border bg-background py-2.5 pl-9 pr-10 text-sm shadow-sm transition focus:outline-none focus:ring-2 ${
                    passwordError
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : "border-input focus:border-primary focus:ring-primary/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {passwordError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full"
              disabled={loading}
            >
              {loading
                ? "Signing in…"
                : leagueData
                ? leagueData.registrationOpen
                  ? "Sign in & continue to payment →"
                  : "Sign in & view details →"
                : "Sign in"}
            </Button>
          </form>

          {role === "player" ? (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <a
                href={leagueId ? `/signup?leagueId=${leagueId}` : redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : "/signup"}
                className="font-semibold text-primary hover:underline"
              >
                Create one
              </a>
            </p>
          ) : (
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Organizer accounts are managed by administrators and cannot be created via public signup.
            </p>
          )}
        </div>

        {/* Safety note */}
        {leagueData && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
            <Lock className="mt-px size-3.5 shrink-0 text-primary" />
            <p>
              Your selected league will be saved while you sign in. You can
              complete your registration right after.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
