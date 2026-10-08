import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/store";

export function WorldpayCheckout({
  reservationId,
  checkoutUrl,
  onSuccess,
  onCancel,
}: {
  reservationId: string;
  checkoutUrl: string;
  onSuccess: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const returnFields = new URLSearchParams(window.location.search);
    let returnPending = returnFields.has("ValidationCode") || returnFields.has("TransactionSetupID");
    const verify = async () => {
      try {
        if (returnPending) {
          const returned = await fetch(getApiUrl(`/api/payments/${reservationId}/hosted-return`), {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ TransactionSetupID: returnFields.get("TransactionSetupID"), ValidationCode: returnFields.get("ValidationCode") }),
          });
          const result = await returned.json();
          if (!returned.ok || !result.ok) throw new Error(result.error || "Could not verify the Worldpay return.");
          returnPending = false;
          // Remove provider response fields (including the validation code) from browser history.
          window.history.replaceState(window.history.state, "", window.location.pathname);
        }
        const response = await fetch(getApiUrl(`/api/payments/${reservationId}/reconcile`), {
          method: "POST",
          credentials: "include",
        });
        const json = await response.json();
        if (stopped) return;
        if (!response.ok || !json.ok)
          throw new Error(json.error || "Payment verification is pending.");
        if (json.data.status === "registered") {
          await onSuccess();
          return;
        }
        if (["expired", "cancelled", "failed"].includes(json.data.status)) {
          setMessage("This checkout has ended. Reserve a new spot to continue.");
          return;
        }
        setMessage("Waiting for Worldpay confirmation. Payment sessions last up to 10 minutes.");
      } catch (error) {
        if (!stopped) setMessage(error instanceof Error ? error.message : "Verification pending.");
      }
      if (!stopped) timer = setTimeout(verify, 5000);
    };
    void verify();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [reservationId]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Complete your card payment securely on Worldpay, then return here to confirm your
        registration.
      </p>
      <Button className="w-full" onClick={() => window.location.assign(checkoutUrl)}>
        Continue to Worldpay
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {message}
      </p>
      <Button variant="outline" className="w-full" onClick={() => void onCancel()}>
        Cancel reservation
      </Button>
    </div>
  );
}
