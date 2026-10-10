import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import type { Request, Response, RequestHandler } from "express";
import { Account, AuthSession, AuthAttempt } from "../models/Auth";
import { Reservation } from "../models/Reservation";
import { err } from "./apiResponse";

export interface Identity { accountId: string; playerSlug: string; email: string; role: "player" | "organizer" }
declare global { namespace Express { interface Request { identity?: Identity } } }
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const isProduction = () => process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const cookieName = () => process.env.SESSION_COOKIE_NAME || (isProduction() ? "__Host-atl-session" : "atl-session");
const sameSiteOption = () => (process.env.SESSION_COOKIE_SAMESITE as "lax" | "strict" | "none") || "lax";
// __Host- cookies must NOT carry a Domain attribute (RFC 6265bis §4.1.3).
// Silently suppress SESSION_COOKIE_DOMAIN when the cookie name uses the prefix.
const cookieDomain = () => {
  if (cookieName().startsWith("__Host-")) return undefined;
  return process.env.SESSION_COOKIE_DOMAIN || undefined;
};
const cookieOptions = () => ({
  httpOnly: true,
  secure: isProduction() || sameSiteOption() === "none",
  sameSite: sameSiteOption(),
  path: "/",
  ...(cookieDomain() ? { domain: cookieDomain() } : {}),
});
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 }, (e, key) => e ? reject(e) : resolve(key));
});
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded?: string) {
  const parts = encoded?.split("$");
  const valid = parts?.length === 3 && parts[0] === "scrypt" && /^[a-f0-9]{128}$/.test(parts[2]);
  const key = await derive(password, valid ? parts![1] : "00000000000000000000000000000000");
  return Boolean(valid && timingSafeEqual(key, Buffer.from(parts![2], "hex")));
}
function sessionToken(req: Request) {
  const tokens = req.headers.cookie
    ?.split(";")
    .map(v => v.trim())
    .filter(v => v.startsWith(`${cookieName()}=`))
    .map(v => v.slice(cookieName().length + 1))
    .filter(v => /^[a-f0-9]{64}$/.test(v));
  return tokens && tokens.length > 0 ? tokens[tokens.length - 1] : undefined;
}
export async function endSession(req: Request, res: Response) {
  const token = sessionToken(req);
  if (token) await AuthSession.deleteOne({ tokenHash: hash(token) });
  res.clearCookie(cookieName(), cookieOptions());
}
export async function beginSession(req: Request, res: Response, accountId: string) {
  await endSession(req, res);
  const token = randomBytes(32).toString("hex"), maxAge = 7 * 24 * 60 * 60_000;
  await AuthSession.create({ tokenHash: hash(token), accountId, expiresAt: new Date(Date.now() + maxAge) });
  res.cookie(cookieName(), token, { ...cookieOptions(), maxAge });
}
export const requireAuth: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  void (async () => {
    const token = sessionToken(req);
    const session = token && await AuthSession.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } });
    const account = session && await Account.findOne({ _id: session.accountId, disabled: false });
    if (!account) return err(res, "Sign in to continue", 401);
    req.identity = { accountId: account._id.toString(), playerSlug: account.playerSlug, email: account.email, role: account.role as Identity["role"] };
    next();
  })().catch(next);
};
export const requireOrganizer: RequestHandler = (req, res, next) => {
  if (req.identity?.role !== "organizer") return err(res, "Organizer access required", 403);
  next();
};
export function ownsEmail(req: Request, email: string) { return req.identity?.email === email.trim().toLowerCase(); }
export const requireReservationOwner: RequestHandler = (req, res, next) => {
  void (async () => {
    const id = String(req.params.reservationId);
    if (!/^[a-f0-9]{24}$/i.test(id)) return err(res, "Reservation not found", 404);
    const filter = req.identity?.role === "organizer" ? { _id: id } : { _id: id, playerSlug: req.identity?.playerSlug };
    if (!await Reservation.exists(filter)) return err(res, "Reservation not found", 404);
    next();
  })().catch(next);
};
// Persistent fixed-window counters work across serverless instances and do not
// depend on MongoDB's asynchronous TTL deletion for enforcing expiry.
export async function limitAuth(req: Request, action: string, email: string) {
  const bucket = Math.floor(Date.now() / (15 * 60_000));
  const address = process.env.VERCEL === "1" ? req.headers["x-vercel-forwarded-for"] || req.socket.remoteAddress : req.socket.remoteAddress;
  for (const [kind, value, limit] of [["email", email, 10], ["ip", String(address), 40]] as const) {
    const key = hash(`${action}:${kind}:${value}:${bucket}`);
    let counter;
    try {
      counter = await AuthAttempt.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 15 * 60_000) } }, { upsert: true, new: true });
    } catch (e) {
      if ((e as {code?: number}).code !== 11000) throw e;
      counter = await AuthAttempt.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
    }
    if (!counter || counter.count > limit) throw Object.assign(new Error("Too many attempts. Try again in 15 minutes."), { statusCode: 429 });
  }
}
