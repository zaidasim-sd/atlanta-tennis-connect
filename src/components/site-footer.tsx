import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { TennisBall } from "@/components/tennis-ball";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export function SiteFooter() {
  const { user, logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isOrganizerRoute = location.pathname.startsWith("/organizer");
  const isOrganizer = user?.role === "organizer" || isOrganizerRoute;

  return (
    <footer className="court-lines mt-24 bg-primary-deep text-white/80">
      <div className={`mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 ${isOrganizer ? "md:grid-cols-[2fr_1fr]" : "md:grid-cols-[1.4fr_1fr_1fr]"}`}>
        {/* Brand */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <TennisBall className="size-6" />
            <Link to={isOrganizer ? "/organizer" : "/"} className="font-display text-lg font-bold text-white hover:text-accent transition-colors">
              Baseline ATL
            </Link>
            {isOrganizer && (
              <span className="ml-2 rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                Organizer Portal
              </span>
            )}
          </div>

          <p className="mt-3 max-w-sm text-sm leading-relaxed">
            {isOrganizer
              ? "Official league administration, roster holds, capacity management, and participant verification for Atlanta tennis organizers."
              : "Organized tennis leagues across metro Atlanta. Clear league details, current availability, and online registration."}
          </p>
        </div>

        {/* Navigation wrapper */}
        <div className={isOrganizer ? "contents" : "grid grid-cols-2 gap-6 md:contents"}>
          {/* Players - hidden for organizers */}
          {!isOrganizer && (
            <div>
              <h3 className="eyebrow text-white">Players</h3>

              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link
                    to="/leagues"
                    className="transition-colors hover:text-accent"
                  >
                    Browse leagues
                  </Link>
                </li>
                <li>
                  <Link
                    to="/how-it-works"
                    className="transition-colors hover:text-accent"
                  >
                    How it works
                  </Link>
                </li>
                <li>
                  <Link
                    to="/dashboard"
                    className="transition-colors hover:text-accent"
                  >
                    My dashboard
                  </Link>
                </li>
              </ul>
            </div>
          )}

          {/* Organizers */}
          <div>
            <h3 className="eyebrow text-white">{isOrganizer ? "Organizer Controls" : "Organizers"}</h3>

            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  to="/organizer"
                  className="transition-colors hover:text-accent"
                >
                  Organizer hub
                </Link>
              </li>
              {isOrganizer ? (
                <li>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await logout();
                        toast.success("Signed out successfully.");
                        navigate({ to: "/login" });
                      } catch {
                        toast.error("Sign out failed.");
                      }
                    }}
                    className="transition-colors hover:text-destructive text-left"
                  >
                    Sign out
                  </button>
                </li>
              ) : (
                <li>
                  <Link
                    to="/login"
                    search={{ leagueId: undefined }}
                    className="transition-colors hover:text-accent"
                  >
                    Sign in
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Demo disclaimer — single line, white */}
          <p className="border-b border-white/10 py-3 text-center text-xs leading-relaxed text-white/70">
            Demo: League information is for demonstration. Payments are currently mocked; no real money is charged.
          </p>

          {/* Copyright + Powered by */}
          <div className="flex flex-col items-center gap-3 pt-8 pb-5 sm:flex-row sm:justify-between sm:gap-0">
            <p className="text-xs text-white">
              © {new Date().getFullYear()} Baseline ATL. Atlanta, Georgia.
            </p>

            {/* Vision71 branding */}
            <div className="flex items-center">
              {/* Mobile: beside logo */}
              <span className="mr-2 text-[10px] leading-none text-white sm:hidden">
                Powered by
              </span>

              {/* Desktop: directly above logo */}
              <div className="relative sm:pt-4">
                <span className="absolute left-0 top-0 hidden text-[9px] leading-none text-white sm:block">
                  Powered by
                </span>

                <a
                  href="https://vision71tech.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Vision71 Technologies"
                >
                  <img
                    src="/v71_white (1).png"
                    alt="Vision71 Technologies"
                    className="h-12 w-auto"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}