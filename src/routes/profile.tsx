import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useStore, getApiUrl } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { SKILL_LEVELS, type SkillLevel, APPROVED_ATLANTA_ZIPS } from "@/lib/tennis";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { BallLoader } from "@/components/tennis-ball";
import { ZipCodeInput } from "@/components/zip-code-input";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

function Profile() {
  const { hydrated, user, players, upsertPlayer, updatePlayer } = useStore();
  const navigate = useNavigate();
  
  const player = players.find(p => p.id === user?.playerId || p.email.toLowerCase() === user?.email.toLowerCase());

  const [firstName, setFirstName] = useState(player?.firstName || "");
  const [lastName, setLastName] = useState(player?.lastName || "");
  const [email, setEmail] = useState(player?.email || user?.email || "");
  const [phone, setPhone] = useState(player?.phone || "");
  const [city, setCity] = useState(player?.city || "Atlanta");
  const [zipCode, setZipCode] = useState(player?.zipCode || "30309");
  const [preferredCourt, setPreferredCourt] = useState(player?.preferredCourt || "Piedmont Park Courts");
  const [ntrp, setNtrp] = useState<SkillLevel>(player?.ntrp || "3.5");
  const [handedness, setHandedness] = useState<"right" | "left">(player?.handedness || "right");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      navigate({ to: "/login", search: { leagueId: undefined } });
    } else if (user.role === "organizer") {
      navigate({ to: "/organizer" });
    }
  }, [hydrated, user, navigate]);

  if (hydrated && user?.role === "organizer") {
    return null;
  }

  useEffect(() => {
    if (!player) return;
    setFirstName(player.firstName); setLastName(player.lastName); setEmail(player.email);
    setPhone(player.phone || ""); setCity(player.city || "Atlanta"); setNtrp(player.ntrp);
  }, [player]);

  if (!hydrated || !user || !player) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <BallLoader label="Loading profile..." />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (zipCode && !APPROVED_ATLANTA_ZIPS.includes(zipCode.trim() as any)) {
      toast.error("Please select a valid 5-digit approved Atlanta metro ZIP code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/players"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          city: city.trim(),
          ntrp,
          zipCode: zipCode.trim(),
          preferredCourt: preferredCourt.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Unable to save profile");
      upsertPlayer(json.data);
      toast.success("Profile updated successfully");
    } catch {
      updatePlayer(player.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        zipCode: zipCode.trim(),
        preferredCourt: preferredCourt.trim(),
        ntrp,
        handedness,
      });
      toast.success("Profile updated successfully");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-4 text-muted-foreground hover:text-foreground">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 size-4" /> Back to Dashboard
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Profile Settings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your identity, preferred home court, and declared tennis rating.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Identity */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-foreground">
                First Name <span className="text-destructive">*</span>
              </label>
              <input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-foreground">
                Last Name <span className="text-destructive">*</span>
              </label>
              <input
                id="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              readOnly
              value={email}
              className="mt-1.5 block w-full cursor-not-allowed rounded-lg border border-input bg-muted/60 px-3.5 py-2 text-sm text-muted-foreground shadow-sm focus:outline-none"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Account email is private and never publicly exposed.
            </p>
          </div>

          {/* Contact & Location */}
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-foreground">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(404) 555-0100"
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-foreground">
                City (Metro ATL)
              </label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Atlanta"
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="zipCode" className="block text-sm font-medium text-foreground mb-1.5">
                ZIP Code
              </label>
              <ZipCodeInput
                id="zipCode"
                value={zipCode}
                onChange={setZipCode}
                placeholder="30309"
              />
            </div>
          </div>

          {/* Preferred Home Court & Handedness */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="preferredCourt" className="block text-sm font-medium text-foreground">
                Preferred / Home Court
              </label>
              <input
                id="preferredCourt"
                type="text"
                value={preferredCourt}
                onChange={(e) => setPreferredCourt(e.target.value)}
                placeholder="e.g. Piedmont Park Courts"
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used to determine home match locations. Does not automatically reserve the court.
              </p>
            </div>
            <div>
              <label htmlFor="handedness" className="block text-sm font-medium text-foreground">
                Dominant Hand
              </label>
              <select
                id="handedness"
                value={handedness}
                onChange={(e) => setHandedness(e.target.value as "right" | "left")}
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="right">Right-handed</option>
                <option value="left">Left-handed</option>
              </select>
            </div>
          </div>

          {/* Skill Level */}
          <div>
            <label htmlFor="ntrp" className="block text-sm font-medium text-foreground">
              Declared Skill Level (NTRP) <span className="text-destructive">*</span>
            </label>
            <select
              id="ntrp"
              value={ntrp}
              onChange={(e) => setNtrp(e.target.value as SkillLevel)}
              className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {SKILL_LEVELS.map(level => (
                <option key={level} value={level}>
                  NTRP {level}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              <strong>Notice:</strong> This is a self-declared rating. It is captured as a snapshot at league registration and is unverified.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-5">
            <p className="text-xs text-muted-foreground">
              Private data is protected per Baseline ATL Privacy Policy.
            </p>
            <Button type="submit" className="rounded-full" disabled={loading}>
              {loading ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
