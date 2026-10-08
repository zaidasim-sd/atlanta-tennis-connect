import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/tennis";
import { CreditCard, Lock, ShieldCheck } from "lucide-react";

interface Props {
  publishableKey: string;
  clientSecret: string;
  reservationId: string;
  amountCents: number;
  expiresAt: string;
  leagueName: string;
  busy: boolean;
  onSuccess: () => Promise<void> | void;
  onCancel: () => Promise<void> | void;
  onError: (message: string) => void;
  onProcessingChange: (value: boolean) => void;
}

function RealStripePaymentForm(props: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(props.expiresAt).getTime() - Date.now()),
  );
  const expiryRequested = useRef(false);
  const lock = useRef(false);

  useEffect(() => {
    const timer = setInterval(
      () => setRemaining(Math.max(0, new Date(props.expiresAt).getTime() - Date.now())),
      1000,
    );
    return () => clearInterval(timer);
  }, [props.expiresAt]);

  useEffect(() => {
    if (remaining > 0 || processing || submitted || expiryRequested.current) return;
    expiryRequested.current = true;
    void props.onCancel();
  }, [remaining, processing, submitted, props.onCancel]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || remaining <= 0 || lock.current || submitted) return;
    lock.current = true;
    setProcessing(true);
    props.onProcessingChange(true);
    setError("");
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (result.error)
        throw new Error(result.error.message || "Payment failed. Please try again.");
      if (
        ["succeeded", "processing", "requires_capture"].includes(result.paymentIntent?.status || "")
      ) {
        setSubmitted(true);
        await props.onSuccess();
      } else throw new Error("Payment needs additional action. Please try again.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Payment could not be completed.";
      setError(message);
      props.onError(message);
    } finally {
      lock.current = false;
      setProcessing(false);
      props.onProcessingChange(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex justify-between rounded-xl bg-primary/5 p-4 text-sm" aria-live="off">
        <span>{remaining > 0 ? "Your spot is reserved" : "Reservation time has ended"}</span>
        <span className="font-mono font-bold text-primary">
          {String(Math.floor(remaining / 60000)).padStart(2, "0")}:
          {String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}
        </span>
      </div>
      {props.publishableKey.startsWith("pk_test_") && (
        <p className="text-xs text-muted-foreground">
          Stripe test mode — no real money is charged.
        </p>
      )}
      {!submitted && (
        <PaymentElement
          onReady={() => setReady(true)}
          onLoadError={() =>
            setError("Stripe could not load. Check your connection or retry.")
          }
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full rounded-full font-bold shadow-md shadow-primary/20"
        disabled={!stripe || !elements || !ready || processing || props.busy || remaining <= 0}
      >
        {processing
          ? "Confirming payment…"
          : `Pay ${formatMoney(props.amountCents)} for ${props.leagueName}`}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full text-xs text-muted-foreground"
        disabled={processing || props.busy}
        onClick={props.onCancel}
      >
        {props.busy ? "Updating reservation…" : "Cancel reservation & release spot"}
      </Button>
      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
        <Lock className="size-3 text-primary" /> Payment processing is handled by the selected provider when enabled.
      </p>
    </form>
  );
}

function StripeInteractiveCardForm(props: Props) {
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [cardExpiry, setCardExpiry] = useState("12 / 28");
  const [cardCvc, setCardCvc] = useState("123");
  const [cardZip, setCardZip] = useState("30305");
  const [cardName, setCardName] = useState("Alex Mercer");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(props.expiresAt).getTime() - Date.now()),
  );

  useEffect(() => {
    const timer = setInterval(
      () => setRemaining(Math.max(0, new Date(props.expiresAt).getTime() - Date.now())),
      1000,
    );
    return () => clearInterval(timer);
  }, [props.expiresAt]);

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      raw = `${raw.slice(0, 2)} / ${raw.slice(2)}`;
    }
    setCardExpiry(raw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanNum = cardNumber.replace(/\s/g, "");
    if (cleanNum.length < 16) {
      setError("Please enter a valid 16-digit card number.");
      return;
    }
    if (!cardExpiry.includes("/") || cardExpiry.length < 5) {
      setError("Please enter a valid expiration date (MM / YY).");
      return;
    }
    if (cardCvc.length < 3) {
      setError("Please enter a valid 3 or 4 digit security code (CVC).");
      return;
    }
    if (cardZip.length < 5) {
      setError("Please enter a valid 5-digit ZIP code.");
      return;
    }

    setProcessing(true);
    props.onProcessingChange(true);

    // Simulate Stripe payment intent confirmation
    await new Promise((res) => setTimeout(res, 1200));

    try {
      await props.onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed. Please retry.");
    } finally {
      setProcessing(false);
      props.onProcessingChange(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Reservation Timer */}
      <div className="flex justify-between items-center rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2.5 text-xs text-primary" aria-live="off">
        <span className="font-semibold flex items-center gap-1.5">
          <Lock className="size-3.5" /> Registration session
        </span>
        <span className="font-mono font-bold text-sm">
          {String(Math.floor(remaining / 60000)).padStart(2, "0")}:
          {String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}
        </span>
      </div>

      <div className="rounded-lg bg-muted/60 border border-border/80 px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>Mock payment — no real money is charged</span>
        <span className="font-mono font-bold text-primary">Test: 4242 •••• 4242</span>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Card Details Inputs */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div>
          <Label className="text-xs font-semibold text-foreground flex items-center justify-between mb-1.5">
            <span>Card Information</span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <CreditCard className="size-3 text-primary" /> Visa / Mastercard / Amex
            </span>
          </Label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              required
              value={cardNumber}
              onChange={handleCardNumberChange}
              placeholder="4242 4242 4242 4242"
              className="pl-9 font-mono text-sm tracking-wider font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-foreground block mb-1">
              Expires
            </Label>
            <Input
              type="text"
              required
              value={cardExpiry}
              onChange={handleExpiryChange}
              placeholder="MM / YY"
              className="font-mono text-xs font-semibold text-center"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-foreground block mb-1">
              CVC / CVV
            </Label>
            <Input
              type="password"
              maxLength={4}
              required
              value={cardCvc}
              onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ""))}
              placeholder="123"
              className="font-mono text-xs font-semibold text-center"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-foreground block mb-1">
              Cardholder Name
            </Label>
            <Input
              type="text"
              required
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="First & Last Name"
              className="text-xs font-medium"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-foreground block mb-1">
              Billing ZIP Code
            </Label>
            <Input
              type="text"
              maxLength={5}
              required
              value={cardZip}
              onChange={(e) => setCardZip(e.target.value.replace(/\D/g, ""))}
              placeholder="30305"
              className="font-mono text-xs font-semibold text-center"
            />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full rounded-full font-bold shadow-md shadow-primary/20"
        disabled={processing || props.busy || remaining <= 0}
      >
        {processing ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Processing mock payment…
          </span>
        ) : (
          `Pay ${formatMoney(props.amountCents)} & Complete Entry`
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full text-xs text-muted-foreground"
        disabled={processing || props.busy}
        onClick={props.onCancel}
      >
        Cancel reservation & release spot
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
        <ShieldCheck className="size-3.5 text-primary" />
        <span>Mock payment flow · Use test card details only</span>
      </div>
    </form>
  );
}

export function StripeCheckoutForm(props: Props) {
  const isRealStripe =
    props.publishableKey.startsWith("pk_") &&
    props.clientSecret.includes("_secret_") &&
    props.clientSecret !== "mock_secret";

  const stripe = useMemo(() => {
    if (isRealStripe) {
      return loadStripe(props.publishableKey);
    }
    return null;
  }, [props.publishableKey, isRealStripe]);

  if (isRealStripe && stripe) {
    return (
      <Elements
        stripe={stripe}
        options={{
          clientSecret: props.clientSecret,
          appearance: {
            theme: "stripe",
            variables: { colorPrimary: "#166534", borderRadius: "10px" },
          },
        }}
      >
        <RealStripePaymentForm {...props} />
      </Elements>
    );
  }

  return <StripeInteractiveCardForm {...props} />;
}
