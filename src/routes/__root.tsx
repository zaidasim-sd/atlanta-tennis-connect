import * as React from "react";
import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TennisBall } from "@/components/tennis-ball";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StoreProvider } from "@/lib/store";

import appCss from "../styles.css?url";

const DISCLAIMER_LAST_SHOWN_KEY = "baseline-atl-disclaimer-last-shown";
const DISCLAIMER_INTERVAL_MS = 24 * 60 * 60 * 1000;

function DemoDisclaimer() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Used only for shareable evidence captures. The persistent footer notice
    // remains visible and normal visits still receive the acknowledgement.
    if (new URLSearchParams(window.location.search).get("evidence") === "1") return;
    const now = Date.now();
    const lastShown = Number(window.localStorage.getItem(DISCLAIMER_LAST_SHOWN_KEY));

    if (!lastShown || now - lastShown >= DISCLAIMER_INTERVAL_MS) {
      // Record when the notice is displayed so a refresh does not show it again.
      window.localStorage.setItem(DISCLAIMER_LAST_SHOWN_KEY, String(now));
      setIsOpen(true);
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md gap-6 rounded-2xl border-border bg-card p-7 shadow-lift sm:p-8">
        <DialogHeader className="items-center space-y-3 text-center sm:text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
            <TennisBall className="size-7" />
          </span>
          <DialogTitle className="font-display text-2xl font-bold text-foreground">
            A quick note
          </DialogTitle>
          <DialogDescription className="max-w-sm text-base leading-relaxed text-muted-foreground">
            All content and data shown are for demonstration purposes only.
          </DialogDescription>
        </DialogHeader>
        <Button className="w-full" size="lg" onClick={() => setIsOpen(false)}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-deep"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: any; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-deep"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Baseline ATL — Atlanta Tennis Leagues" },
      {
        name: "description",
        content: "Join organized tennis leagues across metro Atlanta. Browse formats, pick your level, sign up and play.",
      },
      { property: "og:site_name", content: "Baseline ATL" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap",
        crossOrigin: "anonymous",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <StoreProvider>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              <main className="flex-1">
                {/* Required: nested routes render here. */}
                <Outlet />
              </main>
              <SiteFooter />
            </div>
            <DemoDisclaimer />
            <Toaster position="top-center" />
          </StoreProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
