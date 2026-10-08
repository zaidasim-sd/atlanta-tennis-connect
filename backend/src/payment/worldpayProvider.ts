import { createHash } from "crypto";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { WorldpayPayment } from "./worldpayPayment";
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
    throw new Error(`Worldpay request failed (code ${response?.ExpressResponseCode ?? "unknown"})`);
  return response;
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
  constructor() {
    const environment = process.env.WORLDPAY_ENVIRONMENT ?? "sandbox";
    if (!["sandbox", "production"].includes(environment))
      throw new Error("Invalid WORLDPAY_ENVIRONMENT");
    this.prefix = environment === "sandbox" ? "cert" : "";
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
        payment = await WorldpayPayment.create({ _id: id, amountCents: input.amountCents });
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
  async retrievePayment(id: string): Promise<RetrievePaymentResult> {
    const payment = await this.payment(id);
    const transactions = await this.query(payment.setupId!);
    const successful = transactions.filter((t) =>
      ["1", "5", "6", "15"].includes(String(t.TransactionStatusCode)),
    );
    if (successful.length > 1)
      throw new Error("Multiple Worldpay transactions require manual review");
    const transaction = successful[0] ?? transactions[transactions.length - 1];
    const amount = transaction
      ? Math.round(Number(transaction.ApprovedAmount ?? transaction.TransactionAmount) * 100)
      : payment.amountCents;
    if (!Number.isSafeInteger(amount)) throw new Error("Invalid Worldpay transaction amount");
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
    };
  }
  private async action(id: string, method: string, amountCents?: number) {
    const payment = await this.payment(id);
    const transactions = await this.query(payment.setupId!);
    const transaction = transactions[transactions.length - 1];
    if (!transaction?.TransactionID) throw new Error("Worldpay transaction not available");
    return this.request(method, {
      IdempotencyKey: operationKey(`${method}_${id}_${amountCents ?? payment.amountCents}`),
      Transaction: {
        TransactionID: transaction.TransactionID,
        TransactionAmount: ((amountCents ?? payment.amountCents) / 100).toFixed(2),
        ReferenceNumber: id.slice(8),
        TicketNumber: id.slice(-6),
        MarketCode: "3",
      },
      Terminal: this.terminal(),
    });
  }
  async capturePayment(id: string): Promise<void> {
    if ((await this.retrievePayment(id)).status === "paid") return;
    await this.action(id, "CreditCardAuthorizationCompletion");
  }
  async cancelPayment(id: string): Promise<void> {
    const payment = await this.payment(id);
    if (!payment.cancelled) {
      await this.request("TransactionSetupExpire", {
        TransactionSetup: { TransactionSetupID: payment.setupId },
      });
      payment.cancelled = true;
      await payment.save();
    }
    const status = (await this.retrievePayment(id)).status;
    if (status === "authorized") await this.action(id, "CreditCardVoid");
    else if (status === "paid") throw new Error("Worldpay payment has already succeeded");
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
    const result = await this.action(input.paymentIntentId, "CreditCardReturn", input.amountCents);
    return { refundId: String(result.Transaction?.TransactionID ?? ""), status: "succeeded" };
  }
  async parseWebhookEvent(): Promise<null> {
    // Express redirects are untrusted. Authenticated reconciliation and the cron
    // query the Reporting API instead of accepting browser-supplied payment status.
    throw new Error("Worldpay Express uses authenticated reconciliation, not webhooks");
  }
}
