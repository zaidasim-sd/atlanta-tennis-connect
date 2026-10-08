import { createHash, timingSafeEqual } from "crypto";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { WorldpayPayment, WorldpayObservation, WorldpayOperation } from "./worldpayPayment";
import type {
  PaymentProvider,
  CreatePaymentInput,
  CreatePaymentResult,
  RetrievePaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  PaymentStatus,
} from "./types";

// Express requires a GUID idempotency key; deterministic per operation across retries.
export function operationKey(value: string): string {
  const hash = createHash("sha256").update(value).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
});
const builder = new XMLBuilder({ ignoreAttributes: false });
function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
function findAll(value: any, key: string): any[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) =>
    k === key ? (Array.isArray(v) ? v : [v]) : findAll(v, key),
  );
}
export class WorldpayRequestError extends Error {
  constructor(readonly code: string, readonly providerMessage: string) {
    super(`Worldpay request failed (code ${code})`);
  }
}
export function parseExpressResponse(xml: string, allowNoRecords = false): any {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Invalid Worldpay response");
  const response = findAll(parser.parse(xml), "Response")[0];
  // Reporting has no transaction until the player submits the hosted checkout.
  // Code 90 is generic: only this precise Reporting response means pending.
  if (allowNoRecords && String(response?.ExpressResponseCode) === "90" &&
      /^no record\(s\)$/i.test(String(response.ExpressResponseMessage).trim())) {
    return { ...response, ReportingData: "" };
  }
  if (!response || String(response.ExpressResponseCode) !== "0")
    throw new WorldpayRequestError(String(response?.ExpressResponseCode ?? "unknown"), String(response?.ExpressResponseMessage ?? ""));
  return response;
}

export function expressAmount(value: unknown): number {
  const text = String(value);
  if (!/^\d+\.\d{2}$/.test(text)) throw new Error("Invalid Worldpay transaction amount");
  const [whole, fraction] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction);
  if (!Number.isSafeInteger(cents)) throw new Error("Invalid Worldpay transaction amount");
  return cents;
}
export function worldpayStatus(code: string): PaymentStatus {
  switch (String(code)) {
    case "5":
      return "authorized";
    case "1":
    case "6":
    case "15":
      return "paid";
    case "4":
    case "7":
      return "cancelled";
    case "2":
    case "13":
    case "17":
      return "failed";
    default:
      return "payment_pending";
  }
}

export class WorldpayProvider implements PaymentProvider {
  readonly name = "worldpay" as const;
  private credentials = {
    AccountID: required("WORLDPAY_HOSTED_PAYMENTS_ACCOUNT_ID"),
    AccountToken: required("WORLDPAY_HOSTED_PAYMENTS_API_KEY"),
    AcceptorID: required("WORLDPAY_HOSTED_PAYMENTS_ACCEPTOR_ID"),
  };
  private application = {
    ApplicationID: required("WORLDPAY_HOSTED_PAYMENTS_APP_ID"),
    ApplicationName: "Atlanta Tennis Connect",
    ApplicationVersion: "1.0",
  };
  private prefix: string;
  private returnOrigin: string;
  private merchantCurrency: string;
  constructor() {
    const environment = process.env.WORLDPAY_ENVIRONMENT ?? "sandbox";
    if (!["sandbox", "production"].includes(environment))
      throw new Error("Invalid WORLDPAY_ENVIRONMENT");
    this.prefix = environment === "sandbox" ? "cert" : "";
    this.merchantCurrency = (process.env.WORLDPAY_MERCHANT_CURRENCY ?? (environment === "sandbox" ? "USD" : required("WORLDPAY_MERCHANT_CURRENCY"))).toUpperCase();
    if (this.merchantCurrency !== "USD") throw new Error("Worldpay Express adapter requires a USD merchant account");
    this.returnOrigin = new URL(
      process.env.WORLDPAY_RETURN_ORIGIN || required("CLIENT_URL"),
    ).origin;
  }
  private terminal() {
    return {
      TerminalID: process.env.WORLDPAY_TERMINAL_ID ?? "0001",
      LaneNumber: "1",
      CardPresentCode: "3",
      CardholderPresentCode: "7",
      CardInputCode: "4",
      CVVPresenceCode: "1",
      TerminalCapabilityCode: "5",
      TerminalEnvironmentCode: "6",
      MotoECICode: "7",
      TerminalType: "2",
    };
  }
  private async request(method: string, fields: object, reporting = false): Promise<any> {
    const domain = reporting ? "reporting" : "transaction";
    const body = builder.build({
      [method]: {
        "@_xmlns": `https://${domain}.elementexpress.com`,
        Credentials: this.credentials,
        Application: this.application,
        ...fields,
      },
    });
    const response = await fetch(`https://${this.prefix}${domain}.elementexpress.com/`, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Worldpay HTTP error ${response.status}`);
    return parseExpressResponse(await response.text(), method === "TransactionQuery");
  }
  private async payment(id: string) {
    const payment = await WorldpayPayment.findById(id);
    if (!payment?.setupId)
      throw new Error(
        "Worldpay checkout creation is unresolved; contact the organizer before retrying",
      );
    return payment;
  }
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (
      input.currency.toLowerCase() !== "usd" ||
      !Number.isSafeInteger(input.amountCents) ||
      input.amountCents <= 0
    )
      throw new Error("Worldpay Express requires a positive USD amount");
    const id = `worldpay_${input.reservationId}`;
    let payment = await WorldpayPayment.findById(id);
    if (!payment) {
      try {
        payment = await WorldpayPayment.create({ _id: id, amountCents: input.amountCents, reservationId: input.reservationId, orderReference: input.reservationId, currency: this.merchantCurrency });
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
        payment = await this.payment(id);
      }
      if (!payment.setupId) {
        // Never automatically replay an ambiguous setup request. An untracked session
        // could otherwise accept a second payment after a network/database failure.
        const result = await this.request("TransactionSetup", {
          Transaction: {
            TransactionAmount: (input.amountCents / 100).toFixed(2),
            ReferenceNumber: input.reservationId,
            TicketNumber: input.reservationId.slice(-6),
            MarketCode: "3",
            PartialApprovedFlag: "0",
          },
          Terminal: this.terminal(),
          TransactionSetup: {
            TransactionSetupMethod: "2",
            Embedded: "0",
            CVVRequired: "1",
            AutoReturn: "1",
            ReturnURL: `${this.returnOrigin}/register/${encodeURIComponent(input.metadata.leagueSlug)}`,
            OrderDetails: input.description,
          },
        });
        const setupId = findAll(result, "TransactionSetupID")[0];
        if (!setupId) throw new Error("Worldpay did not return a checkout session");
        payment.setupId = String(setupId);
        payment.validationCode = result.TransactionSetup?.ValidationCode;
        await payment.save();
      }
    }
    if (payment.amountCents !== input.amountCents)
      throw new Error("Worldpay payment amount mismatch");
    if (!payment.setupId)
      throw new Error("Worldpay checkout creation is unresolved; contact the organizer");
    return {
      paymentIntentId: id,
      status: payment.cancelled ? "cancelled" : "payment_pending",
      checkoutUrl: `https://${this.prefix}transaction.hostedpayments.com/?TransactionSetupID=${encodeURIComponent(payment.setupId)}`,
    };
  }
  private async query(setupId: string): Promise<any[]> {
    const result = await this.request(
      "TransactionQuery",
      { Parameters: { TransactionSetupID: setupId } },
      true,
    );
    const data =
      typeof result.ReportingData === "string"
        ? parser.parse(result.ReportingData)
        : result.ReportingData;
    if (result.ReportingData === undefined) throw new Error("Worldpay reporting data is missing");
    return findAll(data, "Item");
  }
  private async verifiedTransactions(id: string) {
    const payment = await this.payment(id);
    const transactions = await this.query(payment.setupId!);
    const orderReference = payment.orderReference ?? id.slice("worldpay_".length);
    for (const t of transactions) {
      if (!t.TransactionID || t.ReferenceNumber !== orderReference)
        throw new Error("Worldpay transaction order reference mismatch");
      if (t.TransactionSetupID && t.TransactionSetupID.toUpperCase() !== payment.setupId!.toUpperCase())
        throw new Error("Worldpay checkout session mismatch");
      if ((t.AccountID && t.AccountID !== this.credentials.AccountID) || (t.AcceptorID && t.AcceptorID !== this.credentials.AcceptorID))
        throw new Error("Worldpay merchant account mismatch");
      const reportedCurrency = t.CurrencyCode ?? t.Currency;
      const currency = reportedCurrency === "840" ? "USD" : String(reportedCurrency ?? this.merchantCurrency).toUpperCase();
      if (currency !== (payment.currency ?? "USD")) throw new Error("Worldpay transaction currency mismatch");
      const amountCents = expressAmount(t.ApprovedAmount ?? t.TransactionAmount);
      const fields = {
        paymentId: id, reservationId: payment.reservationId ?? orderReference,
        transactionId: String(t.TransactionID), orderReference, currency,
        currencySource: reportedCurrency ? "provider" : "merchant_configuration",
        amountCents, providerStatus: String(t.TransactionStatus ?? ""),
        providerStatusCode: String(t.TransactionStatusCode), transactionType: String(t.TransactionType ?? ""),
        providerEventTime: String(t.TimeStamp ?? `${t.ExpressTransactionDate ?? ""} ${t.ExpressTransactionTime ?? ""}`).trim(),
        providerTimezone: String(t.ExpressTransactionTimezone ?? "not_supplied"),
      };
      const eventId = createHash("sha256").update(JSON.stringify(fields)).digest("hex");
      await WorldpayObservation.updateOne({ _id: eventId }, { $setOnInsert: { ...fields, verifiedAt: new Date() } }, { upsert: true });
    }
    return { payment, transactions };
  }
  private selectPayment(transactions: any[]) {
    const payments = transactions.filter(t => !/Return|Refund|Credit|Void|Reversal/i.test(String(t.TransactionType ?? "").replace(/^CreditCard/, "Card")));
    const successful = payments.filter((t) =>
      ["1", "5", "6", "15"].includes(String(t.TransactionStatusCode)),
    );
    const distinct = new Set(successful.map(t => t.TransactionID));
    if (distinct.size > 1)
      throw new Error("Multiple Worldpay transactions require manual review");
    return successful[successful.length - 1] ?? payments[payments.length - 1];
  }
  async retrievePayment(id: string): Promise<RetrievePaymentResult> {
    const { payment, transactions } = await this.verifiedTransactions(id);
    const transaction = this.selectPayment(transactions);
    const amount = transaction
      ? expressAmount(transaction.ApprovedAmount ?? transaction.TransactionAmount)
      : payment.amountCents;
    if (transaction && amount !== payment.amountCents) throw new Error("Worldpay payment amount mismatch");
    const observed = transaction ? await WorldpayObservation.findOne({ paymentId: id, transactionId: transaction.TransactionID }).sort({ verifiedAt: -1 }) : null;
    await WorldpayPayment.updateOne({ _id: id }, { $set: {
      reservationId: payment.reservationId ?? id.slice("worldpay_".length), orderReference: payment.orderReference ?? id.slice("worldpay_".length),
      currency: payment.currency ?? this.merchantCurrency, verifiedAt: new Date(),
      ...(transaction ? { transactionId: transaction.TransactionID, providerStatus: transaction.TransactionStatus ?? "", providerStatusCode: transaction.TransactionStatusCode, providerEventTime: observed?.providerEventTime, currencySource: observed?.currencySource } : {}),
    } });
    return {
      paymentIntentId: id,
      status:
        transaction &&
        !(payment.cancelled && worldpayStatus(transaction.TransactionStatusCode) === "failed")
          ? worldpayStatus(transaction.TransactionStatusCode)
          : payment.cancelled
            ? "cancelled"
            : "payment_pending",
      amountCents: amount,
      currency: (payment.currency ?? this.merchantCurrency).toLowerCase(),
    };
  }
  private async action(id: string, method: string, amountCents?: number) {
    const { payment, transactions } = await this.verifiedTransactions(id);
    const transaction = this.selectPayment(transactions);
    if (!transaction?.TransactionID) throw new Error("Worldpay transaction not available");
    if (expressAmount(transaction.ApprovedAmount ?? transaction.TransactionAmount) !== payment.amountCents)
      throw new Error("Worldpay payment amount mismatch");
    let transactionId = transaction.TransactionID;
    if (method === "CreditCardReturn") {
      if (!payment.captureTransactionId && String(transaction.TransactionStatusCode) === "6") {
        // Completion has its own TransactionID. Older builds did not persist it,
        // and sent an extra underscore in the completion's ReferenceNumber.
        // Recover only a uniquely linked completion, never an unrelated charge.
        const format = (date: Date) => date.toISOString().slice(0,19).replace("T", " ");
        const start = new Date(payment.createdAt!.getTime() - 86400000);
        const end = new Date(Date.now() + 86400000);
        const candidates: any[] = [];
        for (const reference of [id.slice("worldpay_".length), `_${id.slice("worldpay_".length)}`]) {
          const report = await this.request("TransactionQuery", { Parameters: { ReferenceNumber: reference, TransactionDateTimeBegin: format(start), TransactionDateTimeEnd: format(end) } }, true);
          const data = typeof report.ReportingData === "string" ? parser.parse(report.ReportingData) : report.ReportingData;
          candidates.push(...findAll(data, "Item").filter(t =>
            t.OriginalTransactionID === transaction.TransactionID && t.TransactionType === "CreditCardAuthorizationCompletion" &&
            t.ReferenceNumber === reference && (!t.AccountID || t.AccountID === this.credentials.AccountID) &&
            (!t.AcceptorID || t.AcceptorID === this.credentials.AcceptorID) &&
            expressAmount(t.TransactionAmount) === payment.amountCents));
        }
        if (candidates.length !== 1) throw new Error("Worldpay capture reference requires manual review");
        payment.captureTransactionId = candidates[0].TransactionID;
        await payment.save();
      }
      transactionId = payment.captureTransactionId ?? transactionId;
    }
    const result = await this.request(method, {
      IdempotencyKey: operationKey(`${method}_${id}_${amountCents ?? payment.amountCents}`),
      Transaction: {
        TransactionID: transactionId,
        TransactionAmount: ((amountCents ?? payment.amountCents) / 100).toFixed(2),
        ReferenceNumber: id.slice("worldpay_".length),
        TicketNumber: id.slice(-6),
        MarketCode: "3",
        ...(method === "CreditCardReversal" ? { ReversalType: "1" } : {}),
      },
      Terminal: this.terminal(),
    });
    if (method === "CreditCardAuthorizationCompletion") {
      if (!result.Transaction?.TransactionID) throw new Error("Worldpay capture transaction reference missing");
      await WorldpayPayment.updateOne({ _id: id }, { $set: { captureTransactionId: String(result.Transaction.TransactionID) } });
    }
    return result;
  }
  async capturePayment(id: string): Promise<void> {
    const state = await this.retrievePayment(id);
    if (state.status === "paid") return;
    if (state.status !== "authorized") throw new Error("Worldpay payment is not authorized");
    await this.action(id, "CreditCardAuthorizationCompletion");
  }
  async cancelPayment(id: string): Promise<void> {
    const payment = await this.payment(id);
    if (!payment.cancelled) {
      try {
        await this.request("TransactionSetupExpire", {
          TransactionSetup: { TransactionSetupID: payment.setupId },
        });
      } catch (error) {
        // Express removes consumed/expired sessions. Only a known missing setup
        // beyond its documented ten minute lifetime is safe to treat as closed.
        const naturallyExpired = payment.createdAt && Date.now() - payment.createdAt.getTime() >= 10 * 60_000;
        if (!(naturallyExpired && error instanceof WorldpayRequestError && error.code === "103" && error.providerMessage === "TransactionSetupID not found")) throw error;
      }
      payment.cancelled = true;
      await payment.save();
    }
    const status = (await this.retrievePayment(id)).status;
    if (status === "authorized") await this.action(id, "CreditCardReversal");
    else if (status === "paid") throw new Error("Worldpay payment has already succeeded");
    else if (status !== "cancelled") throw new Error("Worldpay payment cancellation is not yet verified");
  }
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const payment = await this.payment(input.paymentIntentId);
    if (
      input.amountCents !== undefined &&
      (!Number.isSafeInteger(input.amountCents) ||
        input.amountCents <= 0 ||
        input.amountCents > payment.amountCents)
    )
      throw new Error("Invalid refund amount");
    const amountCents = input.amountCents ?? payment.amountCents;
    const operationId = operationKey(`CreditCardReturn_${input.paymentIntentId}_${amountCents}`);
    const previous = await WorldpayOperation.findById(operationId);
    if (previous?.status === "succeeded") return { refundId: previous.transactionId!, status: "succeeded" };
    const lock = await WorldpayPayment.findOneAndUpdate({ _id: payment.id, $or: [{ refundLock: { $exists: false } }, { refundLock: operationId }] }, { $set: { refundLock: operationId } });
    if (!lock) throw new Error("Another Worldpay refund is unresolved");
    const refunds = await WorldpayOperation.find({ paymentId: payment.id, type: "refund", status: "succeeded" });
    if (refunds.reduce((sum, r) => sum + (r.amountCents ?? 0), 0) + amountCents > payment.amountCents) {
      await WorldpayPayment.updateOne({ _id: payment.id, refundLock: operationId }, { $unset: { refundLock: 1 } });
      throw new Error("Refund exceeds the remaining payment amount");
    }
    await WorldpayOperation.updateOne({ _id: operationId }, { $setOnInsert: { paymentId: payment.id, type: "refund", amountCents, status: "pending" } }, { upsert: true });
    const result = await this.action(input.paymentIntentId, "CreditCardReturn", amountCents);
    if (!result.Transaction?.TransactionID) throw new Error("Worldpay refund transaction reference missing");
    const refundId = String(result.Transaction.TransactionID);
    await WorldpayOperation.updateOne({ _id: operationId }, { $set: { transactionId: refundId, status: "succeeded", completedAt: new Date() } });
    await WorldpayPayment.updateOne({ _id: payment.id, refundLock: operationId }, { $unset: { refundLock: 1 } });
    return { refundId, status: "succeeded" };
  }
  async verifyCheckoutReturn(id: string, fields: Record<string, string>): Promise<void> {
    const payment = await WorldpayPayment.findById(id).select("+validationCode");
    const supplied = Buffer.from(fields.ValidationCode ?? "");
    const expected = Buffer.from(payment?.validationCode ?? "");
    if (!payment?.setupId || fields.TransactionSetupID?.toUpperCase() !== payment.setupId.toUpperCase() ||
        !expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      throw new Error("Invalid Worldpay hosted return");
    // Even a valid return cannot confirm a payment without a Reporting query.
    await this.retrievePayment(id);
    await WorldpayPayment.updateOne({ _id: id }, { $set: { returnVerifiedAt: new Date() } });
  }
  async parseWebhookEvent(): Promise<null> {
    // Express redirects are untrusted. Authenticated reconciliation and the cron
    // query the Reporting API instead of accepting browser-supplied payment status.
    throw new Error("Worldpay Express uses authenticated reconciliation, not webhooks");
  }
}
