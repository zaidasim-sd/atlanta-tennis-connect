import mongoose from "mongoose";
import { League } from "../models/League";
import { Player } from "../models/Player";
import { Account } from "../models/Auth";
import { Reservation, type IReservation, type ReservationStatus } from "../models/Reservation";
import { TournamentHistory } from "../models/TournamentHistory";
import { AuditLog, type AuditAction } from "../models/AuditLog";
import { getPaymentProvider } from "../payment";
import { expireReservations } from "../jobs/expireReservations";
import { broadcastCapacityChange } from "./events";

const PENDING: ReservationStatus[] = ["held", "payment_pending"];
const ACTIVE: ReservationStatus[] = [...PENDING, "paid", "registered"];
const error = (message: string, statusCode = 409) =>
  Object.assign(new Error(message), { statusCode });

export interface ReservationDTO {
  id: string;
  leagueId: string;
  playerId: string;
  createdAt: string;
  paymentStatus: "paid" | "pending";
  amountCents: number;
  paymentIntentId?: string;
  clientSecret?: string;
  paymentProvider: "stripe" | "mock" | "worldpay";
  status: ReservationStatus;
  expiresAt: string;
  flaggedForReview?: boolean;
  reviewReason?: string;
}
function toDTO(r: IReservation): ReservationDTO {
  return {
    id: r._id.toString(),
    leagueId: r.leagueSlug,
    playerId: r.playerSlug,
    createdAt: r.heldAt.toISOString(),
    paymentStatus: ["paid", "registered"].includes(r.status) ? "paid" : "pending",
    amountCents: r.amountCents,
    paymentIntentId: r.paymentIntentId,
    paymentProvider: r.paymentProvider,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    flaggedForReview: r.flaggedForReview,
    reviewReason: r.reviewReason,
  };
}
export interface CreateReservationInput {
  leagueSlug: string;
  playerEmail: string;
  partnerEmail?: string;
}

// External calls stay outside Mongo transactions. The persisted reservation ID is
// the Stripe idempotency key, so a timeout/crash can safely recover the same intent.
async function ensurePayment(r: IReservation) {
  const provider = getPaymentProvider();
  if (r.paymentProvider !== provider.name)
    throw error("Reservation uses a different payment provider", 409);
  const payment = await provider.createPayment({
    reservationId: r._id.toString(),
    amountCents: r.amountCents,
    currency: "usd",
    description: `${r.leagueSlug} registration`,
    playerEmail: r.playerEmail,
    metadata: {
      reservationId: r._id.toString(),
      leagueSlug: r.leagueSlug,
      playerSlug: r.playerSlug,
    },
  });
  await Reservation.updateOne(
    { _id: r._id, status: { $in: PENDING } },
    { $set: { paymentIntentId: payment.paymentIntentId, status: "payment_pending" } },
  );
  r.paymentIntentId = payment.paymentIntentId;
  return payment;
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<{ reservation: ReservationDTO; clientSecret?: string; checkoutUrl?: string }> {
  const provider = getPaymentProvider(); // Validate configuration before taking capacity.
  await Reservation.init(); // Ensure the active-registration unique index exists.
  await expireReservations();
  const email = input.playerEmail.trim().toLowerCase();
  let reservation = await Reservation.findOne({
    leagueSlug: input.leagueSlug,
    playerEmail: email,
    status: { $in: ACTIVE },
  });
  if (reservation && !PENDING.includes(reservation.status))
    throw error("You are already registered for this league");
  if (!reservation) {
    try {
      await mongoose.connection.transaction(async (session) => {
        const league = await League.findOneAndUpdate(
          { slug: input.leagueSlug, spotsRemaining: { $gt: 0 }, $or: [{ registrationDeadline: { $gt: new Date() } }, { registrationDeadline: { $exists: false }, registrationOpen: true }] },
          { $inc: { spotsRemaining: -1 } },
          { new: true, session },
        );
        if (!league) throw error("League is full or registration is closed");
        const player = await Player.findOneAndUpdate(
          { email },
          {
            $setOnInsert: {
              slug: `p-${new mongoose.Types.ObjectId()}`,
              firstName: email.split("@")[0],
              lastName: "Member",
              phone: "",
              ntrp: league.skillLevel,
              city: "Atlanta",
              zipCode: "30309",
            },
          },
          { upsert: true, new: true, session },
        );
        let partnerSlug: string | undefined;
        if (league.format.includes("doubles") && !input.partnerEmail)
          throw error("Select a doubles partner", 400);
        if (input.partnerEmail) {
          const partnerInput = input.partnerEmail.trim();
          const partnerLower = partnerInput.toLowerCase();
          if (partnerLower === email || partnerInput === player.slug)
            throw error("Select a different player as your partner", 400);
          const partner = await Player.findOne({
            $or: [
              { email: partnerLower },
              { slug: partnerInput },
            ],
          }).session(session);
          if (!partner) throw error("Partner not found", 400);

          // Verify partner is not an organizer
          const organizerAccount = await Account.findOne({
            $or: [{ email: partner.email.toLowerCase() }, { playerSlug: partner.slug }],
            role: "organizer",
          }).session(session);
          if (organizerAccount || partner.email.toLowerCase() === "organizer@baselineatl.com") {
            throw error("Organizers cannot be selected as doubles partners", 400);
          }

          // Verify partner has the same rating as required by the doubles league
          if (league.format.includes("doubles") && partner.ntrp !== league.skillLevel) {
            throw error(`Doubles partner must have a ${league.skillLevel} rating for this league`, 400);
          }

          partnerSlug = partner.slug;
        }
        const history = await TournamentHistory.findOne({
          playerEmail: email,
          skillLevel: league.skillLevel,
          finish: { $in: ["champion", "finalist"] },
          year: { $gte: new Date().getFullYear() - 2 },
        })
          .sort({ year: -1 })
          .session(session);
        const now = new Date();
        const id = new mongoose.Types.ObjectId();
        [reservation] = await Reservation.create(
          [
            {
              _id: id,
              leagueSlug: league.slug,
              playerSlug: player.slug,
              playerEmail: email,
              partnerSlug,
              status: "held",
              amountCents: league.feeCents,
              paymentProvider: provider.name,
              idempotencyKey: id.toString(),
              heldAt: now,
              expiresAt: new Date(now.getTime() + 15 * 60_000),
              flaggedForReview: Boolean(history),
              reviewReason: history
                ? `Prior ${history.finish} in ${history.tournamentName} (${history.year})`
                : undefined,
            },
          ],
          { session },
        );
        await AuditLog.create(
          [
            {
              reservationId: id,
              leagueSlug: league.slug,
              playerEmail: email,
              action: "reservation.created",
              actor: "player",
              meta: { provider: provider.name },
            },
          ],
          { session },
        );
      });
      if (reservation) {
        broadcastCapacityChange({
          type: "reservation.created",
          leagueSlug: input.leagueSlug,
          reservationId: (reservation as any)._id.toString(),
          status: "held",
        });
      }
    } catch (e) {
      // Concurrent retries by one player reuse the winner's reservation.
      if ((e as { code?: number }).code !== 11000) throw e;
      reservation = await Reservation.findOne({
        leagueSlug: input.leagueSlug,
        playerEmail: email,
        status: { $in: PENDING },
      });
      if (!reservation) throw error("You already have an active registration");
    }
  }
  if (!reservation) throw error("Unable to reserve a spot", 503);
  const payment = await ensurePayment(reservation);
  if (payment.status === "paid") await confirmPayment(payment.paymentIntentId, "paid");
  const fresh = await Reservation.findById(reservation._id);
  if (!fresh || !ACTIVE.includes(fresh.status))
    throw error("This reservation has ended. Please reserve again.");
  if (fresh.expiresAt.getTime() <= Date.now() && PENDING.includes(fresh.status)) {
    await cancelReservation(fresh._id.toString(), "expired");
    throw error("This reservation has expired. Please reserve again.");
  }
  return { reservation: toDTO(fresh), clientSecret: payment.clientSecret, checkoutUrl: payment.checkoutUrl };
}

// Status and capacity change in ONE transaction. Conditional transitions prevent
// stale readers, duplicate webhooks, and concurrent cancellation from double releasing.
async function transition(
  r: IReservation,
  status: "registered" | "cancelled" | "expired" | "failed" | "refunded" | "disputed",
  eventId?: string,
): Promise<boolean> {
  let changed = false;
  await mongoose.connection.transaction(async (session) => {
    changed = false;
    const allowed: ReservationStatus[] =
      status === "refunded" || status === "disputed" ? ["registered", "paid", "disputed"] : PENDING;
    const updated = await Reservation.findOneAndUpdate(
      { _id: r._id, status: { $in: allowed } },
      {
        $set: {
          status,
          ...(status === "registered" ? { paidAt: new Date() } : { cancelledAt: new Date() }),
          ...(eventId ? { lastWebhookEventId: eventId } : {}),
        },
        ...(eventId ? { $addToSet: { webhookEventIds: eventId } } : {}),
      },
      { new: true, session },
    );
    if (!updated) return;
    if (["cancelled", "expired", "failed"].includes(status)) {
      await League.updateOne({ slug: r.leagueSlug }, { $inc: { spotsRemaining: 1 } }, { session });
    }
    const actions: Record<typeof status, AuditAction> = {
      registered: "registration.confirmed",
      cancelled: "reservation.cancelled",
      expired: "reservation.expired",
      failed: "payment.failed",
      refunded: "payment.refunded",
      disputed: "payment.disputed",
    };
    await AuditLog.create(
      [
        {
          reservationId: r._id,
          leagueSlug: r.leagueSlug,
          playerEmail: r.playerEmail,
          action: actions[status],
          actor: "system",
          meta: { webhookEventId: eventId },
        },
      ],
      { session },
    );
    changed = true;
  });
  if (changed) {
    broadcastCapacityChange({
      type: status === "registered" ? "reservation.registered" : (status === "cancelled" ? "reservation.cancelled" : (status === "expired" ? "reservation.expired" : "reservation.failed")),
      leagueSlug: r.leagueSlug,
      reservationId: r._id.toString(),
      status,
    });
  }
  return changed;
}

export async function confirmPayment(
  paymentIntentId: string,
  incomingStatus: ReservationStatus,
  webhookEventId?: string,
): Promise<void> {
  const r = await Reservation.findOne({ paymentIntentId });
  // Let Stripe retry if creation has not persisted the intent ID yet.
  if (!r) throw error("Payment reservation not yet available", 503);
  if (incomingStatus === "refunded" || incomingStatus === "disputed") {
    await transition(r, incomingStatus, webhookEventId);
    return;
  }
  // Read current provider state rather than trusting stale/out-of-order events.
  const provider = getPaymentProvider();
  if (r.paymentProvider !== provider.name) throw error("Reservation uses a different payment provider", 409);
  let result = await provider.retrievePayment(paymentIntentId);
  if (result.amountCents !== r.amountCents) throw error("Payment amount mismatch", 409);
  if (result.currency && result.currency.toLowerCase() !== "usd") throw error("Payment currency mismatch", 409);
  if (result.status === "authorized") {
    if (!PENDING.includes(r.status) || r.expiresAt.getTime() <= Date.now()) {
      await cancelReservation(r._id.toString(), "expired");
      return;
    }
    if (!provider.capturePayment) throw error("Payment capture unavailable", 503);
    // Stripe serializes capture vs cancellation; only one can win.
    try {
      await provider.capturePayment(paymentIntentId);
    } catch {
      result = await provider.retrievePayment(paymentIntentId);
      if (result.status !== "paid" && result.status !== "cancelled")
        throw error("Payment capture is pending; please retry", 503);
    }
    result = await provider.retrievePayment(paymentIntentId);
  }
  if (result.status === "paid") {
    if (result.amountCents !== r.amountCents || (result.currency && result.currency.toLowerCase() !== "usd"))
      throw error("Payment amount or currency mismatch", 409);
    if (["cancelled", "expired", "failed"].includes(r.status))
      throw error("Paid payment requires manual review: reservation already released", 409);
    await transition(r, "registered", webhookEventId);
  } else if (result.status === "cancelled") {
    await transition(r, "cancelled", webhookEventId);
  } else if (result.status === "failed" && r.paymentProvider === "mock") {
    await transition(r, "failed", webhookEventId);
  } else if (result.status === "failed" && r.paymentProvider === "worldpay") {
    // Close the retryable hosted session before releasing a declined payment's spot.
    await cancelReservation(r.id, "failed");
  }
}
async function findReservation(id: string) {
  const r = await Reservation.findOne({
    $or: [...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []), { paymentIntentId: id }],
  });
  if (!r) throw error("Reservation not found", 404);
  return r;
}
export async function cancelReservation(
  id: string,
  reason: "cancelled" | "expired" | "failed" = "cancelled",
): Promise<{ released: boolean }> {
  const r = await findReservation(id);
  if (["paid", "registered"].includes(r.status))
    throw error("Payment has already succeeded; your registration is confirmed");
  if (!PENDING.includes(r.status)) return { released: true };
  const provider = getPaymentProvider();
  if (r.paymentProvider !== provider.name) throw error("Reservation uses a different payment provider", 409);
  // Recover ambiguous creation failures before releasing. Never release a slot
  // while an associated payment can still succeed.
  if (!r.paymentIntentId) await ensurePayment(r);
  if (!provider.cancelPayment) throw error("Payment cancellation unavailable", 503);
  try {
    await provider.cancelPayment(r.paymentIntentId!);
  } catch {
    const latest = await provider.retrievePayment(r.paymentIntentId!);
    if (latest.status === "paid") await confirmPayment(r.paymentIntentId!, "paid");
    if (latest.status !== "cancelled")
      throw error(
        "Payment is processing or could not be cancelled. Your spot remains held; please retry.",
      );
  }
  const state = await provider.retrievePayment(r.paymentIntentId!);
  if (state.status !== "cancelled") throw error("Payment is not cancelled; your spot remains held");
  await transition(r, reason);
  const fresh = await findReservation(id);
  return { released: ["cancelled", "expired", "failed"].includes(fresh.status) };
}
export async function reconcileReservation(id: string): Promise<ReservationDTO> {
  const r = await findReservation(id);
  if (PENDING.includes(r.status)) {
    if (!r.paymentIntentId) await ensurePayment(r);
    await confirmPayment(r.paymentIntentId!, "payment_pending");
    const fresh = await findReservation(id);
    if (PENDING.includes(fresh.status) && fresh.expiresAt.getTime() <= Date.now())
      await cancelReservation(id, "expired");
  }
  return toDTO(await findReservation(id));
}
export async function resumeCheckout(id: string) {
  const reservation = await reconcileReservation(id);
  if (!PENDING.includes(reservation.status)) return { reservation };
  const r = await findReservation(id);
  const payment = await ensurePayment(r);
  return { reservation, clientSecret: payment.clientSecret, checkoutUrl: payment.checkoutUrl };
}
export async function getPlayerReservations(email: string): Promise<ReservationDTO[]> {
  return (
    await Reservation.find({ playerEmail: email.toLowerCase(), status: { $in: ACTIVE } }).sort({
      heldAt: -1,
    })
  ).map(toDTO);
}
export async function adminRegister(input: CreateReservationInput): Promise<ReservationDTO> {
  // Admin registrations must also complete payment; never fabricate paid status.
  return (await createReservation(input)).reservation;
}
