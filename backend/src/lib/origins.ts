import type { RequestHandler } from "express";
import { err } from "./apiResponse";
export function allowedOrigin(origin: string, host?: string) {
  if (host && (origin === `https://${host}` || origin === `http://${host}`)) return true;
  const configured = [process.env.CLIENT_URL, ...(process.env.ALLOWED_ORIGINS || "").split(",")].filter(Boolean);
  if (configured.some(value => value!.trim().replace(/\/$/, "") === origin)) return true;
  // Vercel provides these exact URLs for this project's deployments.
  const deploymentHosts = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean);
  if (deploymentHosts.some(hostname => origin === `https://${hostname}`)) return true;
  const isProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
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
