import { createHash, randomUUID } from "crypto";
import type { ClientSession } from "mongoose";
import nodemailer from "nodemailer";
import { League } from "../models/League";
import type { IReservation } from "../models/Reservation";
import { RegistrationEmail, type IRegistrationEmail, type ConfirmationDetails } from "../models/RegistrationEmail";
import { WorldpayPayment } from "../payment/worldpayPayment";

const mailbox = (value: string) => /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value) && !/[\r\n]/.test(value);

export function smtpConfig() {
  if (process.env.EMAIL_ENABLED === "false") return null;
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  const gmail = /@(gmail|googlemail)\.com$/i.test(user);
  const host = process.env.SMTP_HOST?.trim() || (gmail ? "smtp.gmail.com" : "");
  const port = Number(process.env.SMTP_PORT || "465");
  const configuredFrom = process.env.SMTP_FROM?.trim() || "";
  const from = mailbox(configuredFrom) ? configuredFrom : user;
  const fromName = !configuredFrom || mailbox(configuredFrom) ? "Atlanta Tennis Connect" : configuredFrom;
  const merchant = process.env.MERCHANT_NOTIFICATION_EMAIL?.trim() || "";
  if (!user || !pass || !host || !mailbox(from) || /[\r\n<>@,;]/.test(fromName) || fromName.length > 120) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port, secure: port === 465, auth: { user, pass }, from, fromName, merchant };
}

export async function queueRegistrationEmails(r: IReservation, session: ClientSession) {
  const league = await League.findOne({ slug: r.leagueSlug }).session(session);
  if (!league || r.status !== "registered" || !r.paidAt) throw new Error("Confirmed registration details missing");
  const worldpay = r.paymentProvider === "worldpay"
    ? await WorldpayPayment.findById(r.paymentIntentId).session(session) : null;
  const details: ConfirmationDetails = {
    league: league.name, format: league.format, level: league.skillLevel,
    schedule: `${league.scheduleDay} at ${league.scheduleTime}`, venue: league.venue,
    startDate: league.startDate, endDate: league.endDate,
    playerEmail: r.playerEmail, amountCents: r.amountCents, provider: r.paymentProvider,
    paymentReference: r.paymentIntentId ?? r._id.toString(),
    transactionReference: worldpay?.captureTransactionId || worldpay?.transactionId || undefined,
    confirmedAt: r.paidAt.toISOString(),
    sandbox: r.paymentProvider === "mock" || (r.paymentProvider === "worldpay"
      ? process.env.WORLDPAY_ENVIRONMENT !== "production"
      : !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")),
  };
  // Sequential writes: parallel operations are unsupported inside transactions.
  for (const kind of ["player", "merchant"] as const) {
    await RegistrationEmail.updateOne(
      { _id: `${r._id}:${kind}` },
      { $setOnInsert: { reservationId: r._id, kind, details,
        recipient: kind === "player" ? r.playerEmail : process.env.MERCHANT_NOTIFICATION_EMAIL?.trim() || "",
        status: "pending", attempts: 0, nextAttemptAt: new Date() } },
      { upsert: true, session },
    );
  }
}

export function registrationMessage(email: IRegistrationEmail) {
  const d = email.details;
  const merchant = email.kind === "merchant";
  const title = merchant ? "Payment verified and league registration confirmed" : "Your league registration is confirmed";
  const subject = `${d.sandbox ? "[Sandbox] " : ""}${title}: ${d.league}`.replace(/[\r\n]/g, " ");
  const dateRange = [d.startDate, d.endDate].filter(Boolean).join(" to ");
  const playerDetails = [
    `League: ${d.league}`, `Level: ${d.level}`, `When: ${d.schedule}`,
    `Where: ${d.venue}`, ...(dateRange ? [`Season: ${dateRange}`] : []),
    `Paid: USD ${(d.amountCents / 100).toFixed(2)}`,
  ];
  const merchantDetails = [
    `Player: ${d.playerEmail}`, `League: ${d.league}`, `Level: ${d.level}`,
    `Schedule: ${d.schedule}`, `Venue: ${d.venue}`, `Amount: USD ${(d.amountCents / 100).toFixed(2)}`,
    `Payment provider: ${d.provider}`, `Registration reference: ${email.reservationId}`,
    `Payment reference: ${d.paymentReference}`,
    ...(d.transactionReference ? [`Provider transaction reference: ${d.transactionReference}`] : []),
    `Confirmed at: ${d.confirmedAt} UTC`,
  ];
  const playerLines = [
    "Baseline Atlanta Tennis", "", "You are registered", "",
    ...(d.sandbox ? ["This is a sandbox test. No live money was collected.", ""] : []),
    "Your place in the league is confirmed. We look forward to seeing you on court.", "",
    ...playerDetails, "",
    "Keep this email for your records. If you have a question about your registration, reply to the league organiser.",
  ];
  const merchantLines = [
    "Baseline Atlanta Tennis", "", "Payment received and registration confirmed", "",
    ...(d.sandbox ? ["This is a sandbox test. No live money was collected.", ""] : []),
    "The player payment was verified and the league registration is confirmed.", "",
    ...merchantDetails, "",
    "This is an application notification. Confirm settlement in the payment provider dashboard.",
  ];
  const lines = merchant ? merchantLines : playerLines;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const details = merchant ? merchantDetails : playerDetails;
  const detailRows = details.map(line => {
    const [label, ...value] = line.split(": ");
    return `<tr><td style="padding:10px 0;color:#6b7280;font-size:14px">${escape(label)}</td><td style="padding:10px 0;text-align:right;color:#111827;font-weight:600;font-size:14px">${escape(value.join(": "))}</td></tr>`;
  }).join("");
  const intro = merchant ? "The player payment was verified and their registration is confirmed." : "Your place is confirmed. We look forward to seeing you on court.";
  const note = d.sandbox ? "Sandbox test only. No live money was collected." : "Keep this email for your records.";
  const html = `<div style="margin:0;padding:24px;background:#f5f7f6;font-family:Arial,Helvetica,sans-serif;color:#111827"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden"><tr><td style="padding:28px 32px;background:#063b2d;color:#ffffff"><div style="font-size:14px;font-weight:700;letter-spacing:.4px">BASELINE ATLANTA TENNIS</div><h1 style="margin:12px 0 0;font-size:26px;line-height:1.2">${escape(merchant ? "Registration confirmed" : "You are registered")}</h1></td></tr><tr><td style="padding:30px 32px"><p style="margin:0 0 22px;font-size:16px;line-height:1.55">${escape(intro)}</p>${d.sandbox ? `<p style="margin:0 0 20px;padding:12px 14px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:14px">${escape(note)}</p>` : ""}<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${detailRows}</table><p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;line-height:1.5">${escape(merchant ? "This is an application notification. Confirm settlement in the payment provider dashboard." : note)}</p></td></tr></table></div>`;
  return { subject, text: lines.join("\n"), html };
}

// SMTP cannot guarantee exactly once across a process crash after acceptance.
// A durable claim prevents ordinary concurrent sends; the stable Message-ID
// helps mail systems recognise a retry of the same message.
export async function deliverRegistrationEmails(reservationId?: string) {
  const config = smtpConfig();
  if (!config) return { sent: 0, retried: 0, failed: 0, configured: false };
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure,
    requireTLS: !config.secure, auth: config.auth,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
  });
  const counts = { sent: 0, retried: 0, failed: 0, configured: true };
  try {
    for (let i = 0; i < (reservationId ? 2 : 20); i++) {
      const now = new Date();
      const token = randomUUID();
      const email = await RegistrationEmail.findOneAndUpdate({
        ...(reservationId ? { reservationId } : {}),
        $or: [
          { status: "pending", nextAttemptAt: { $lte: now } },
          { status: "sending", leaseUntil: { $lte: now } },
        ],
      }, { $set: { status: "sending", leaseToken: token, leaseUntil: new Date(Date.now() + 120000) } },
      { new: true, sort: { nextAttemptAt: 1 } });
      if (!email) break;
      const recipient = email.recipient || (email.kind === "merchant" ? config.merchant : "");
      if (!mailbox(recipient)) {
        await RegistrationEmail.updateOne({ _id: email._id, leaseToken: token }, {
          $set: { status: "pending", lastErrorCode: "RECIPIENT_NOT_CONFIGURED", nextAttemptAt: new Date(Date.now() + 60000) },
          $unset: { leaseUntil: 1, leaseToken: 1 },
        });
        counts.retried++;
        continue;
      }
      try {
        // Persist the resolved recipient before submission, so later config
        // changes cannot redirect retries to a different mailbox.
        await RegistrationEmail.updateOne({ _id: email._id, leaseToken: token }, { $set: { recipient } });
        const id = createHash("sha256").update(email._id).digest("hex");
        const info = await transport.sendMail({
          from: { name: config.fromName, address: config.from }, to: recipient,
          messageId: `<registration-${id}@${config.from.split("@")[1]}>`, ...registrationMessage(email),
        });
        if (!info.accepted?.length || info.rejected?.length) throw Object.assign(new Error("Mail not accepted"), { code: "SMTP_REJECTED" });
        await RegistrationEmail.updateOne({ _id: email._id, leaseToken: token }, {
          $set: { status: "sent", sentAt: new Date() }, $inc: { attempts: 1 },
          $unset: { leaseUntil: 1, leaseToken: 1, lastErrorCode: 1 },
        });
        counts.sent++;
      } catch (error) {
        const attempts = email.attempts + 1;
        const code = String((error as { code?: string }).code ?? "SMTP_FAILED");
        const safeCode = /^[A-Z0-9_]{1,40}$/.test(code) ? code : "SMTP_FAILED";
        await RegistrationEmail.updateOne({ _id: email._id, leaseToken: token }, {
          $set: { status: attempts >= 6 ? "failed" : "pending", attempts, lastErrorCode: safeCode,
            nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** (attempts - 1))) },
          $unset: { leaseUntil: 1, leaseToken: 1 },
        });
        counts[attempts >= 6 ? "failed" : "retried"]++;
        console.error(`[registration-email] ${safeCode}; notification ${email._id}`);
      }
    }
  } finally { transport.close(); }
  return counts;
}
