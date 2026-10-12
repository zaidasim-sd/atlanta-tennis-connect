/**
 * POST /api/registrations
 *   Atomically reserves a spot and initiates payment.
 *   Body: { leagueId, playerEmail, partnerEmail? }
 *   Returns: ReservationDTO  (matches frontend Registration shape)
 *
 * GET /api/registrations?email=
 *   Returns all active reservations for a player email.
 *
 * POST /api/registrations/admin
 *   Organiser reservation using the same capacity, TTL and payment rules.
 *   Body: { leagueId, playerEmail, partnerEmail? }
 *   Requires a server-authenticated organiser session.
 */
import { Router } from "express";
import { z } from "zod";
import {
  createReservation,
  adminRegister,
  getPlayerReservations,
  reconcileReservation,
} from "../lib/reservationService";
import { Player } from "../models/Player";
import { League } from "../models/League";
import { Reservation } from "../models/Reservation";
import { wrap, ok, err } from "../lib/apiResponse";
import { requireAuth, requireOrganizer, ownsEmail } from "../lib/auth";

const router = Router();

// Compatibility endpoint: confirmation comes from server/provider state only.
router.post(
  "/confirm",
  requireAuth,
  wrap(async (req, res) => {
    const { leagueId, playerEmail } = req.body;
    if (typeof leagueId !== "string" || typeof playerEmail !== "string")
      return err(res, "leagueId and playerEmail are required", 400);
    if (!ownsEmail(req, playerEmail)) return err(res, "Access denied", 403);
    const reservation = await Reservation.findOne({
      leagueSlug: leagueId, playerEmail: req.identity!.email,
      status: { $in: ["held", "payment_pending", "paid", "registered"] },
    });
    if (!reservation) return err(res, "Reservation not found", 404);
    const verified = await reconcileReservation(reservation._id.toString());
    if (verified.status !== "registered") return err(res, "Payment verification pending", 409);
    ok(res, verified);
  }),
);

router.use(requireAuth);

const CreateBody = z.object({
  leagueId:     z.string().min(1),
  playerEmail:  z.string().email(),
  partnerEmail: z.string().min(1).optional(),
});

// POST /api/registrations
router.post(
  "/",
  wrap(async (req, res) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) return err(res, "Invalid request body", 400, parsed.error.flatten());

    const { leagueId, playerEmail, partnerEmail } = parsed.data;
    if (!ownsEmail(req, playerEmail)) return err(res, "You can only register your own account", 403);

    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (process.env.PAYMENT_PROVIDER !== "mock" && !publishableKey?.startsWith("pk_")) {
      return err(res, "Stripe checkout is not configured. Please contact the organizer.", 503);
    }

    const result = await createReservation({
      leagueSlug: leagueId,
      playerEmail: req.identity!.email,
      partnerEmail,
    });

    // Return shape the frontend Registration interface expects
    ok(res, { ...result, publishableKey }, 201);
  }),
);

// GET /api/registrations?email=&leagueId=
router.get(
  "/",
  wrap(async (req, res) => {
    // If organizer, allow querying all registrations or by leagueId with full player profile and hold status
    if (req.identity!.role === "organizer") {
      const query: Record<string, unknown> = {};
      if (typeof req.query.leagueId === "string" && req.query.leagueId) {
        query.leagueSlug = req.query.leagueId;
      }
      if (typeof req.query.email === "string" && req.query.email) {
        query.playerEmail = req.query.email.toLowerCase();
      }

      const reservations = await Reservation.find(query).sort({ heldAt: -1 });
      const playerSlugs = [...new Set(reservations.map((r) => r.playerSlug).filter(Boolean))];
      const playerEmails = [...new Set(reservations.map((r) => r.playerEmail).filter(Boolean))];

      const players = await Player.find({
        $or: [
          { slug: { $in: playerSlugs } },
          { email: { $in: playerEmails } },
        ],
      });
      const playerBySlug = new Map(players.map((p) => [p.slug, p]));
      const playerByEmail = new Map(players.map((p) => [p.email.toLowerCase(), p]));

      const data = reservations.map((r) => {
        const player = playerBySlug.get(r.playerSlug) || playerByEmail.get(r.playerEmail.toLowerCase());
        const isHold = ["held", "payment_pending"].includes(r.status);
        const isExpired = isHold && new Date() > new Date(r.expiresAt);
        const isPaid = ["paid", "registered", "completed"].includes(r.status);
        const status = isExpired ? "expired" : r.status;
        const paymentStatus = isPaid
          ? "paid"
          : isHold && !isExpired
          ? "held"
          : "expired";

        return {
          id: r._id.toString(),
          leagueId: r.leagueSlug,
          playerId: r.playerSlug,
          name: player ? `${player.firstName} ${player.lastName}`.trim() : r.playerEmail.split("@")[0],
          email: player?.email || r.playerEmail,
          phone: player?.phone || "Not provided",
          ntrp: player?.ntrp || "3.5",
          city: player?.city || "Atlanta",
          preferredCourt: player?.preferredCourt,
          status: status,
          paymentStatus: paymentStatus,
          amountCents: r.amountCents,
          heldAt: r.heldAt,
          expiresAt: r.expiresAt,
          paidAt: r.paidAt,
          createdAt: r.heldAt ? new Date(r.heldAt).toISOString() : new Date().toISOString(),
        };
      });

      return ok(res, data);
    }

    const email = typeof req.query.email === "string" ? req.query.email : req.identity!.email;
    if (!ownsEmail(req, email)) return err(res, "Access denied", 403);

    const reservations = await getPlayerReservations(email);
    ok(res, reservations);
  }),
);

// POST /api/registrations/admin
router.post(
  "/admin",
  requireOrganizer,
  wrap(async (req, res) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) return err(res, "Invalid request body", 400, parsed.error.flatten());

    const { leagueId, playerEmail, partnerEmail } = parsed.data;
    const reservation = await adminRegister({ leagueSlug: leagueId, playerEmail, partnerEmail });

    ok(res, reservation, 201);
  }),
);

export default router;
