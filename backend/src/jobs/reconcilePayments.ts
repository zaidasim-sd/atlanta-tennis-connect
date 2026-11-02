/**
 * Reconciliation job – catches any "payment_pending" reservations where
 * the webhook was missed or delayed.  Polls the payment provider directly
 * and advances state accordingly.
 *
 * Runs as a Vercel cron function and as a standalone callable.
 * Safe to run concurrently with the expiry job.
 */
import { Reservation } from "../models/Reservation";
import { getPaymentProvider } from "../payment";
import { reconcileReservation } from "../lib/reservationService";
import { deliverRegistrationEmails } from "../lib/registrationEmail";

async function reconcileProviderPayments(): Promise<{ reconciled: number; errors: number }> {
  // Skip reconciliation when using the mock provider – state is always current
  const provider = getPaymentProvider();
  if (provider.name === "mock") {
    return { reconciled: 0, errors: 0 };
  }

  const pending = await Reservation.find({
    status: { $in: ["held", "payment_pending"] },
    paymentProvider: provider.name,
  }).limit(100);

  if (pending.length === 0) return { reconciled: 0, errors: 0 };

  let reconciled = 0;
  let errors = 0;

  await Promise.all(
    pending.map(async (reservation) => {
      try {
        await reconcileReservation(reservation._id.toString());
        reconciled++;
      } catch (e) {
        console.error(`[reconcile-job] Error reconciling ${reservation._id.toString()}:`, e);
        errors++;
      }
    }),
  );

  console.log(`[reconcile-job] Reconciled ${reconciled}, errors ${errors}`);
  return { reconciled, errors };
}

export async function reconcilePayments(): Promise<{ reconciled: number; errors: number }> {
  const result = await reconcileProviderPayments();
  // A mail outage must never prevent payment recovery.
  try { await deliverRegistrationEmails(); }
  catch { console.error("[registration-email] Cron delivery deferred"); }
  return result;
}
