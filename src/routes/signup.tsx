import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useStore, getApiUrl } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { SKILL_LEVELS, FORMAT_LABELS, formatMoney, type SkillLevel, APPROVED_ATLANTA_ZIPS } from "@/lib/tennis";
import { TennisBall } from "@/components/tennis-ball";
import { MapPin, CalendarDays, Calendar, ShieldAlert, ShieldCheck, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { ModernDobPicker } from "@/components/modern-dob-picker";
import { ZipCodeInput } from "@/components/zip-code-input";

export const Route = createFileRoute("/signup")({
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
  component: Signup,
});

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
                className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ring-2 transition-all ${done || active
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
                className={`text-[10px] font-semibold whitespace-nowrap ${active
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
                className={`mx-1.5 mt-4 h-0.5 w-10 shrink-0 rounded-full transition-all sm:w-14 ${done ? "bg-primary" : "bg-border"
                  }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Signup() {
  const { user, hydrated, logout, refreshSession, leagueById } = useStore();
  const navigate = useNavigate();

  const { leagueId, redirect } = Route.useSearch();
  const targetLeagueId = leagueId || (redirect?.startsWith("/leagues/") ? redirect.replace("/leagues/", "") : undefined);
  const leagueData = targetLeagueId ? leagueById(targetLeagueId) : undefined;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [zipCode, setZipCode] = useState("");
  const [ntrp, setNtrp] = useState<SkillLevel | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <h1 className="text-2xl font-bold text-foreground">Organizer Account Active</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are signed in as an organizer (<strong>{user.email}</strong>). Organizers manage leagues and cannot register new player accounts while active.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button asChild size="lg" className="rounded-full font-bold">
              <Link to="/organizer">
                Return to Organizer Hub →
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full"
              onClick={async () => {
                await logout();
              }}
            >
              Sign out to register as a player
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate age based on entered Date of Birth
  const calculateAge = (dobString: string): number | null => {
    if (!dobString) return null;
    const parts = dobString.split("-");
    const p0 = parts[0];
    const p1 = parts[1];
    const p2 = parts[2];
    if (!p0 || !p1 || !p2) return null;
    const birthDate = new Date(parseInt(p0, 10), parseInt(p1, 10) - 1, parseInt(p2, 10));
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let computedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      computedAge--;
    }
    return computedAge;
  };

  const age = calculateAge(dateOfBirth);
  const isUnder18 = age !== null && age < 18;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (isUnder18) {
      if (!parentName.trim()) {
        setError("Parent or guardian name is required for junior players under 18.");
        return;
      }
      if (!parentPhone.trim()) {
        setError("Parent or guardian phone number is required for junior players under 18.");
        return;
      }
      const guardianDigits = parentPhone.replace(/\D/g, "");
      if (!/^[+\d\s().-]+$/.test(parentPhone) || guardianDigits.length < 10 || guardianDigits.length > 15) {
        setError("Please enter a valid parent or guardian phone number, including the area code.");
        return;
      }
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!APPROVED_ATLANTA_ZIPS.includes(zipCode.trim() as any)) {
      setError("Please select a valid 5-digit approved Atlanta metro ZIP code.");
      return;
    }

    if (!ntrp) {
      setError("Please select your skill level.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/auth/signup"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail,
          password, ntrp,
          dateOfBirth: dateOfBirth || undefined, parentName: isUnder18 ? parentName.trim() : undefined,
          parentPhone: isUnder18 ? parentPhone.trim() : undefined, isJunior: dateOfBirth ? isUnder18 : undefined,
          zipCode: zipCode.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Unable to create your account. Please try again.");
      }
      if (!await refreshSession()) throw new Error("Unable to establish your session. Please sign in.");

      // 3. Navigate to redirect, registration payment or dashboard
      if (redirect) {
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
    } catch (err: unknown) {
      console.error("Signup error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[90vh] bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg">
        {/* Progress stepper */}
        {leagueData && <Stepper current={2} />}

        {/* Selected league card */}
        {leagueData && leagueId && (
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
                params={{ leagueId }}
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

        {/* Signup card */}
        <div className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)] sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {leagueData ? "Create your account" : "Create a player profile"}
            </h1>
            {leagueData && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Join{" "}
                <strong className="font-semibold text-foreground">
                  {leagueData.name}
                </strong>{" "}
                and start playing.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-foreground">
                  <span className="text-red-500 font-bold text-xs mr-1 select-none" aria-hidden="true">*</span>First Name
                </label>
                <input
                  id="firstName"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-foreground">
                  <span className="text-red-500 font-bold text-xs mr-1 select-none" aria-hidden="true">*</span>Last Name
                </label>
                <input
                  id="lastName"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Email & Date of Birth */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
                  <span className="text-red-500 font-bold text-xs mr-1 select-none" aria-hidden="true">*</span>Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                  <label htmlFor="dob-trigger" className="block text-sm font-medium text-foreground">
                    Date of Birth <span className="text-xs text-muted-foreground font-normal ml-1">(Optional)</span>
                  </label>
                  {age !== null && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isUnder18
                          ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
                          : "bg-primary/10 text-primary border-primary/20"
                      }`}
                    >
                      {age} yrs · {isUnder18 ? "Junior (<18)" : "Adult"}
                    </span>
                  )}
                </div>
                <ModernDobPicker
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  age={age}
                  isUnder18={isUnder18}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">Used to identify age eligibility and guardian requirements.</p>
              </div>
            </div>

            {/* Junior Player Parent / Guardian Information */}
            {isUnder18 && (
              <div className="rounded-xl border border-border bg-secondary/30 p-4 sm:p-5 space-y-4">
                <div className="flex items-start gap-2.5 text-foreground">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <h3 className="text-sm font-semibold">Parent or guardian details</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Required for players under 18. Please provide their full name and contact number.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="parentName" className="mb-1 block text-xs font-semibold text-foreground">
                      <span className="text-red-500 font-bold text-xs mr-1 select-none" aria-hidden="true">*</span>Parent / Guardian Name
                    </label>
                    <input
                      id="parentName"
                      type="text"
                      required={isUnder18}
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="Enter their full name"
                      autoComplete="section-guardian name"
                      className="block w-full rounded-lg border border-input bg-background h-11 px-3.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="parentPhone" className="mb-1 block text-xs font-semibold text-foreground">
                      <span className="text-red-500 font-bold text-xs mr-1 select-none" aria-hidden="true">*</span>Parent / Guardian Phone
                    </label>
                    <input
                      id="parentPhone"
                      type="tel"
                      required={isUnder18}
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                      placeholder="Enter phone number"
                      autoComplete="section-guardian tel"
                      aria-describedby="guardian-phone-help"
                      className="block w-full rounded-lg border border-input bg-background h-11 px-3.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <p id="guardian-phone-help" className="mt-1.5 text-xs text-muted-foreground">Include the area code; add a country code if outside the US.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Required ZIP without preset player information */}
            <div>
              <label htmlFor="zipCode" className="mb-1 block text-sm font-medium text-foreground">
                <span className="text-red-500 font-bold text-xs mr-1 select-none" aria-hidden="true">*</span>ZIP Code
              </label>
              <ZipCodeInput id="zipCode" value={zipCode} onChange={setZipCode} required placeholder="Enter your ZIP code" />
              <p className="mt-1.5 text-xs text-muted-foreground">Choose an approved Metro Atlanta ZIP code.</p>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
                  <span className="text-red-500 font-bold text-xs mr-1 select-none" aria-hidden="true">*</span>Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="block w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-10 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-foreground">
                  <span className="text-red-500 font-bold text-xs mr-1 select-none" aria-hidden="true">*</span>Confirm Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="block w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertCircle className="size-3.5 shrink-0" />
                {error}
              </p>
            )}

            {/* NTRP */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  <span className="text-red-500 font-bold text-xs mr-1 select-none" aria-hidden="true">*</span>Declared Skill Level (NTRP)
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {SKILL_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={ntrp === level}
                    onClick={() => setNtrp(level as SkillLevel)}
                    className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${ntrp === level
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full"
              disabled={loading}
            >
              {loading
                ? "Creating account…"
                : leagueData
                  ? leagueData.registrationOpen
                    ? "Create account & continue to payment →"
                    : "Create account & view details →"
                  : "Create Account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link
              to="/login"
              search={{ leagueId: leagueId ?? undefined, redirect: redirect ?? undefined }}
              className="font-semibold text-primary hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>

        {/* Safety note */}
        {leagueData && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
            <Lock className="mt-px size-3.5 shrink-0 text-primary" />
            <p>
              Your selected league will be saved while you create your account.
              You can complete your registration right after.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
