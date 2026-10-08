import * as React from "react";
import { toast } from "sonner";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { Menu, X, LogOut, Copy, Check, LayoutDashboard, User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TennisBall } from "@/components/tennis-ball";
import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/leagues", label: "Browse leagues" },
  { to: "/how-it-works", label: "How it works" },
] as const;

export function SiteHeader() {
  const { user, logout, dbConnected, fallbackActive, hydrated } = useStore();
  const [open, setOpen] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(false);
  const navigate = useNavigate();

  const handleCopyId = (id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      toast.success(`Player ID copied: ${id}`);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const location = useLocation();
  const isOrganizerRoute = location.pathname.startsWith("/organizer");
  const isOrganizer = user?.role === "organizer" || isOrganizerRoute;
  const homeTo = isOrganizer ? "/organizer" : "/";
  const dashboardTo = isOrganizer ? "/organizer" : "/dashboard";
  const currentNavItems = isOrganizer
    ? [{ to: "/organizer" as const, label: "Organizer Hub" }]
    : navItems;

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link to={homeTo} className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <TennisBall className="size-7" />
            <span className="font-display text-lg font-bold tracking-tight text-primary">
              Baseline<span className="text-muted-foreground font-medium"> ATL</span>
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {currentNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" || item.to === "/organizer" }}
              activeProps={{ className: "text-primary bg-secondary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex items-center gap-2.5 rounded-full border border-border/80 bg-card/60 py-1.5 pl-2 pr-3.5 shadow-sm transition-all duration-200 hover:border-primary/50 hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="User profile menu"
                >
                  <div className="relative">
                    <Avatar className="size-8 border border-primary/30 shadow-xs transition-transform duration-200 group-hover:scale-105">
                      <AvatarFallback className="bg-primary/10 font-bold text-xs text-primary">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 size-2 rounded-full border border-background bg-emerald-500 ring-1 ring-background" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold leading-tight text-foreground transition-colors group-hover:text-primary max-w-[120px] truncate">
                      {user.name}
                    </span>
                    {!isOrganizer && user.playerId && (
                      <span className="font-mono text-[10px] text-muted-foreground leading-tight">
                        ID: {user.playerId}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 p-2 shadow-xl border-border/80 rounded-2xl bg-card/95 backdrop-blur-md"
              >
                {/* Profile Header */}
                <div className="p-3 bg-muted/50 rounded-xl mb-1 border border-border/50">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10 border border-primary/20">
                      <AvatarFallback className="bg-primary font-bold text-primary-foreground text-sm">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{user.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  {!isOrganizer && user.playerId && (
                    <div className="mt-2.5 flex items-center justify-between rounded-lg bg-background/90 px-2.5 py-1.5 border border-border/70 text-xs">
                      <span className="font-mono text-[11px] text-muted-foreground truncate">
                        ID: {user.playerId}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCopyId(user.playerId!);
                        }}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Copy Player ID"
                      >
                        {copiedId ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        <span>{copiedId ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  )}
                  {user.role === "organizer" && (
                    <div className="mt-2 text-center">
                      <span className="inline-block rounded bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                        Organizer Account
                      </span>
                    </div>
                  )}
                </div>

                <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2 text-xs font-semibold">
                  <Link to={dashboardTo}>
                    <LayoutDashboard className="mr-2 size-4 text-primary" />
                    {user.role === "organizer" ? "Organizer Hub" : "Player Dashboard"}
                  </Link>
                </DropdownMenuItem>

                {user.role === "player" && (
                  <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2 text-xs font-semibold">
                    <Link to="/profile">
                      <User className="mr-2 size-4 text-primary" />
                      My Profile & Court
                    </Link>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator className="my-1 border-border/60" />

                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await logout();
                      navigate({ to: "/" });
                    } catch {
                      toast.error("Sign out failed. Please retry.");
                    }
                  }}
                  className="cursor-pointer rounded-lg py-2 text-xs font-semibold text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : !hydrated ? (
            <div className="flex items-center gap-2">
              <div className="h-8 w-20 rounded-full bg-muted/20 animate-pulse" />
            </div>
          ) : isOrganizerRoute ? (
            <Button asChild size="sm">
              <Link to="/organizer">Organizer Hub</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login" search={{ leagueId: undefined }}>
                  Sign in
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/signup" search={{ leagueId: undefined }}>
                  Sign up
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/leagues">Find a league</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="inline-flex size-10 items-center justify-center rounded-full border border-border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-white text-slate-900 shadow-lg lg:hidden">
          <nav id="mobile-navigation" aria-label="Mobile navigation" className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
            {currentNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                activeOptions={{ exact: item.to === "/" || item.to === "/organizer" }}
                activeProps={{ className: "border-l-4 border-primary bg-secondary text-primary font-bold", "aria-current": "page" }}
                inactiveProps={{ className: "border-l-4 border-transparent text-slate-900" }}
                className="rounded-lg px-3 py-3 text-base font-semibold transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {item.to === "/leagues" ? "Leagues" : item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              {user ? (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
                    <div>
                      <span className="font-semibold text-sm text-foreground block">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                      {isOrganizer && (
                        <span className="mt-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                          Organizer Account
                        </span>
                      )}
                    </div>
                    {!isOrganizer && user.playerId && (
                      <button
                        type="button"
                        onClick={() => handleCopyId(user.playerId!)}
                        className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground border border-border/50 hover:bg-muted/80 active:bg-muted transition-colors"
                        title="Copy Player ID"
                      >
                        {copiedId ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 text-muted-foreground" />}
                        <span>ID: {user.playerId}</span>
                      </button>
                    )}
                  </div>
                  <Button asChild onClick={() => setOpen(false)}>
                    <Link to={dashboardTo}>{user.role === "organizer" ? "Organizer Hub" : "My Dashboard"}</Link>
                  </Button>
                  {user.role === "player" && (
                    <Button asChild variant="outline" onClick={() => setOpen(false)}>
                      <Link to="/profile">My Profile & Stats</Link>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try { await logout(); setOpen(false); navigate({ to: "/" }); }
                      catch { toast.error("Sign out failed. Please retry."); }
                    }}
                  >
                    Sign out
                  </Button>
                </>
              ) : !hydrated ? (
                <div className="h-10 w-full rounded-lg bg-muted/20 animate-pulse" />
              ) : isOrganizerRoute ? (
                <Button asChild onClick={() => setOpen(false)}>
                  <Link to="/organizer">Organizer Hub</Link>
                </Button>
              ) : (
                <>
                  <Link
                    to="/login"
                    search={{ leagueId: undefined }}
                    onClick={() => setOpen(false)}
                    activeProps={{ className: "border-l-4 border-primary bg-secondary text-primary font-bold", "aria-current": "page" }}
                    inactiveProps={{ className: "border-l-4 border-transparent text-slate-900" }}
                    className="rounded-lg px-3 py-3 text-base font-semibold transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Sign in
                  </Link>
                  <Button asChild className="mt-2 h-12 text-base" onClick={() => setOpen(false)}>
                    <Link to="/signup" search={{ leagueId: undefined }} activeProps={{ "aria-current": "page" }}>Create account</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
