import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/tennis";
import { getApiUrl } from "@/lib/store";
import { Lock } from "lucide-react";

declare global {
  interface Window { EPD?: (key: string) => Promise<any>; }
}

interface Props {
  publishableKey: string;
  reservationId: string;
  amountCents: number;
  leagueName: string;
  phone?: string;
  busy: boolean;
  onSuccess: () => Promise<void> | void;
  onCancel: () => Promise<void> | void;
  onError: (message: string) => void;
  onProcessingChange: (value: boolean) => void;
}

function loadEpdSdk(): Promise<void> {
  if (window.EPD) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.epd.com/element/v1/epd.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Easy Pay Direct could not load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.epd.com/element/v1/epd.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Easy Pay Direct could not load."));
    document.head.appendChild(script);
  });
}

export function EzPayDirectCheckout(props: Props) {
  const element = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState(props.phone ?? "");

  const phoneIsValid = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.length === 10 || (value.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15);
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await loadEpdSdk();
        if (!window.EPD || !mounted) throw new Error("Easy Pay Direct checkout is unavailable.");
        const epd = await window.EPD(props.publishableKey);
        const card = epd.create("card", {
          style: { base: { fontSize: "16px", color: "#172b24" }, invalid: { color: "#b42318" } },
          placeholder: { cardNumber: "Card number" },
        });
        await card.mount("#epd-card-field");
        card.on("change", (state: { complete: boolean }) => { if (mounted) setReady(state.complete); });
        element.current = { epd, card };
      } catch (error) {
        const text = error instanceof Error ? error.message : "Easy Pay Direct checkout could not start.";
        if (mounted) { setMessage(text); props.onError(text); }
      }
    })();
    return () => { mounted = false; element.current?.card?.unmount?.(); };
  }, [props.publishableKey]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!element.current || processing) return;
    if (!phoneIsValid(phone)) {
      const text = "Enter a valid US phone number to continue with Easy Pay Direct.";
      setMessage(text); props.onError(text);
      return;
    }
    setProcessing(true); props.onProcessingChange(true); setMessage("");
    try {
      const { token } = await element.current.epd.createToken(element.current.card);
      const response = await fetch(getApiUrl(`/api/payments/${props.reservationId}/ezpaydirect/confirm`), {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardToken: token, phone: phone.trim() }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Payment could not be completed.");
      if (json.data.status === "registered") await props.onSuccess();
      else if (json.data.status === "failed") throw new Error("Your payment was declined. No registration was confirmed.");
      else setMessage("Payment is processing. Your registration will be confirmed after verification.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Payment could not be completed.";
      setMessage(text); props.onError(text);
    } finally {
      setProcessing(false); props.onProcessingChange(false);
    }
  };

  return <form onSubmit={submit} className="space-y-4">
    <p className="text-sm text-muted-foreground">Enter your card in Easy Pay Direct's secure card field. Card details do not pass through Baseline ATL.</p>
    <div>
      <label htmlFor="epd-phone" className="mb-1.5 block text-sm font-medium text-foreground">Mobile number</label>
      <input
        id="epd-phone"
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="(404) 555-0100"
        className="block w-full rounded-xl border border-input bg-background px-3 py-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        required
      />
      <p className="mt-1.5 text-xs text-muted-foreground">Easy Pay Direct requires a phone number for the payment customer record.</p>
    </div>
    <div id="epd-card-field" className="rounded-xl border border-input bg-background px-3 py-4" />
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    <Button type="submit" className="w-full rounded-full font-bold" disabled={!ready || processing || props.busy || !phoneIsValid(phone)}>
      {processing ? "Processing payment…" : `Pay ${formatMoney(props.amountCents)} for ${props.leagueName}`}
    </Button>
    <Button type="button" variant="ghost" className="w-full text-xs" disabled={processing || props.busy} onClick={props.onCancel}>Cancel reservation and release spot</Button>
    <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Lock className="size-3 text-primary" /> Securely processed by Easy Pay Direct.</p>
  </form>;
}
