import type { RequestHandler } from "express";
import { err } from "./apiResponse";
export function allowedOrigin(origin: string, host?: string) {
  if (host && (origin === `https://${host}` || origin === `http://${host}`)) return true;
  const configured = [process.env.CLIENT_URL, ...(process.env.ALLOWED_ORIGINS || "").split(",")].filter(Boolean);
  if (configured.some(value => value!.trim().replace(/\/$/, "") === origin)) return true;
  if (process.env.ALLOWED_ORIGIN_SUFFIXES) {
    const suffixes = process.env.ALLOWED_ORIGIN_SUFFIXES.split(",").map(s => s.trim()).filter(Boolean);
    if (suffixes.some(suffix => origin.endsWith(suffix))) return true;
  }
  const isProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  return !isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
// Origin checks complement authentication and prevent cookie-based CSRF.
export const protectOrigin: RequestHandler = (req, res, next) => {
  if (req.path === "/api/payments/webhook") return next();
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && !allowedOrigin(origin, host)) return err(res, "Origin not allowed", 403);
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.cookie && !origin)
    return err(res, "Origin required", 403);
  next();
};
