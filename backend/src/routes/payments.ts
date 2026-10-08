/**
 * POST /api/payments/webhook
 *   Receives Stripe or mock webhook events and advances reservation state.
 *   Conditional database transitions prevent duplicate registration effects.
 *
 * GET /api/payments/status/:reservationId
 *   Polls current payment state for a reservation.
 *   Requires the reservation owner or an authenticated organiser.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { getPaymentProvider } from "../payment";
import { confirmPayment, cancelReservation, reconcileReservation, resumeCheckout } from "../lib/reservationService";
import { Reservation } from "../models/Reservation";
import { wrap, ok, err } from "../lib/apiResponse";
import { requireAuth, requireReservationOwner } from "../lib/auth";

const router = Router();

router.post("/:reservationId/checkout", requireAuth, requireReservationOwner, wrap(async (req, res) => {
  const id = String(req.params.reservationId);
  res.setHeader("Cache-Control", "no-store");
  ok(res, { ...await resumeCheckout(id), publishableKey: getPaymentProvider().name === "stripe" ? process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY : undefined });
}));

// POST /api/payments/webhook
// express.raw() must be applied BEFORE this route so rawBody is a Buffer
router.post("/webhook", async (req: Request, res: Response) => {
  const provider = getPaymentProvider();
  const sig = (req.headers["stripe-signature"] as string) ?? "";

  let event;
  try {
    event = await provider.parseWebhookEvent(req.body as Buffer, sig);
  } catch {
    return err(res, "Webhook parse error", 400);
  }

  if (!event) {
    // Not relevant to us – acknowledge so provider doesn't retry
    return ok(res, { received: true });
  }

  try {
    await confirmPayment(
      event.paymentIntentId,
      event.status as import("../models/Reservation").ReservationStatus,
      event.eventId,
    );
  } catch (e) {
    console.error("confirmPayment error", e);
    return err(res, "Payment processing failed; retry delivery", 500);
  }

  ok(res, { received: true });
});

// GET /api/payments/status/:reservationId
router.get(
  "/status/:reservationId",
  requireAuth,
  requireReservationOwner,
  wrap(async (req, res) => {
    const rawId = req.params.reservationId;
    const reservationId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!reservationId) return err(res, "reservationId is required", 400);

    const reservation = await Reservation.findById(reservationId).lean();
    if (!reservation) return err(res, "Reservation not found", 404);

    ok(res, {
      id: reservation._id.toString(),
      status: reservation.status,
      paymentStatus: ["paid", "registered"].includes(reservation.status) ? "paid" : "pending",
      leagueId: reservation.leagueSlug,
      playerId: reservation.playerSlug,
      amountCents: reservation.amountCents,
      expiresAt: reservation.expiresAt,
      paidAt: reservation.paidAt ?? null,
    });
  }),
);

// POST /api/payments/:reservationId/reconcile
const handleReconcile = wrap(async (req, res) => {
  const rawId = req.params.reservationId;
  const reservationId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!reservationId) return err(res, "reservationId is required", 400);

  const updated = await reconcileReservation(reservationId);
  ok(res, updated);
});

router.post("/:reservationId/reconcile", requireAuth, requireReservationOwner, handleReconcile);
router.post("/reconcile/:reservationId", requireAuth, requireReservationOwner, handleReconcile);

// POST /api/payments/:reservationId/cancel
const handleCancel = wrap(async (req, res) => {
  const rawId = req.params.reservationId;
  const reservationId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!reservationId) return err(res, "reservationId is required", 400);

  const result = await cancelReservation(reservationId);
  ok(res, result);
});

router.post("/:reservationId/cancel", requireAuth, requireReservationOwner, handleCancel);
router.post("/cancel/:reservationId", requireAuth, requireReservationOwner, handleCancel);

export default router;
