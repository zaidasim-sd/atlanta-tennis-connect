import crypto from "node:crypto";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentStatus,
  RefundPaymentInput,
  RefundPaymentResult,
  RetrievePaymentResult,
  WebhookEventResult,
} from "./types";

const API_BASE = "https://api.epd.com/v1";
const PENDING_PREFIX = "epd_pending_";

export interface EpdCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

type EpdObject = Record<string, unknown>;

function asObject(value: unknown): EpdObject {
  return value && typeof value === "object" ? value as EpdObject : {};
}

function valueString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function valueNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function statusFromEpd(status: unknown): PaymentStatus {
  switch (String(status).toLowerCase()) {
    case "succeeded":
    case "paid":
      return "paid";
    case "failed":
    case "declined":
      return "failed";
    case "cancelled":
    case "canceled":
    case "voided":
      return "cancelled";
    case "refunded":
    case "partially_refunded":
      return "refunded";
    default:
      return "payment_pending";
  }
}

function idempotencyKey(seed: string): string {
  const hex = crypto.createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** EPD Commerce adapter. Card data stays in the EPD Elements iframe. */
export class EzPayDirectProvider implements PaymentProvider {
  readonly name = "ezpaydirect" as const;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly apiVersion: string;

  constructor() {
    this.secretKey = process.env.EZPAYDIRECT_SECRET_KEY ?? "";
    this.webhookSecret = process.env.EZPAYDIRECT_WEBHOOK_SECRET ?? "";
    this.apiVersion = process.env.EZPAYDIRECT_API_VERSION ?? "2026-02-11";
    if (!this.secretKey.startsWith("epd_test_sk_")) {
      throw new Error("EZPAYDIRECT_SECRET_KEY must be an EPD sandbox secret key (epd_test_sk_...)");
    }
  }

  /** A reservation exists before the browser creates a single-use EPD card token. */
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (input.currency.toLowerCase() !== "usd") throw new Error("Easy Pay Direct registration payments must use USD");
    return {
      paymentIntentId: `${PENDING_PREFIX}${input.reservationId}`,
      status: "payment_pending",
    };
  }

  async chargeCardToken(input: CreatePaymentInput, customer: EpdCustomer, cardToken: string): Promise<RetrievePaymentResult> {
    if (!/^cct_[A-Za-z0-9_-]+$/.test(cardToken)) throw new Error("Invalid Easy Pay Direct card token");
    if (!/^\+[1-9]\d{7,14}$/.test(customer.phone)) throw new Error("A valid phone number is required for Easy Pay Direct checkout");

    const customerResponse = await this.request("/customers", "POST", {
      email: customer.email,
      first_name: customer.firstName,
      last_name: customer.lastName,
      phone: customer.phone,
    }, `${input.reservationId}:customer`);
    const customerId = valueString(customerResponse.id);
    if (!customerId) throw new Error("Easy Pay Direct did not return a customer ID");

    const sku = `atl-${input.reservationId}`;
    const productResponse = await this.request("/products", "POST", {
      name: input.description,
      // EPD limits SKUs to 30 characters. Mongo reservation IDs are 24 hex characters.
      sku,
      description: "Atlanta Tennis league registration",
      pricing: { amount: input.amountCents, currency: input.currency.toLowerCase() },
      requires_shipping: false,
    // Bind the key to the actual product request. This preserves retry safety
    // while allowing a validation correction to be submitted as a new request.
    }, `${input.reservationId}:product:${sku}:${input.amountCents}:${input.currency.toLowerCase()}`);
    const productId = valueString(productResponse.id);
    if (!productId) throw new Error("Easy Pay Direct did not return a product ID");

    const methodResponse = await this.request(`/customers/${encodeURIComponent(customerId)}/payment_methods`, "POST", {
      card_token: cardToken,
      set_as_default: true,
    }, `${input.reservationId}:payment-method`);
    const paymentMethodId = valueString(methodResponse.id);
    if (!paymentMethodId) throw new Error("Easy Pay Direct did not return a payment method ID");

    const order = await this.request("/orders", "POST", {
      customer_id: customerId,
      payment_method_id: paymentMethodId,
      items: [{ product_id: productId, quantity: 1 }],
      metadata: input.metadata,
    }, `${input.reservationId}:order`);
    const orderId = valueString(order.id);
    if (!orderId) throw new Error("Easy Pay Direct did not return an order ID");
    return this.toPayment(order, orderId, input.amountCents, input.currency);
  }

  async retrievePayment(paymentIntentId: string): Promise<RetrievePaymentResult> {
    if (paymentIntentId.startsWith(PENDING_PREFIX)) {
      return { paymentIntentId, status: "payment_pending", amountCents: 0, currency: "usd" };
    }
    const order = await this.request(`/orders/${encodeURIComponent(paymentIntentId)}`, "GET");
    return this.toPayment(order, paymentIntentId);
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const result = await this.request(`/orders/${encodeURIComponent(input.paymentIntentId)}/refunds`, "POST", {
      ...(input.amountCents === undefined ? {} : { amount: input.amountCents }),
      ...(input.reason ? { reason: input.reason } : {}),
    }, `${input.paymentIntentId}:refund:${input.amountCents ?? "full"}`);
    const status = String(result.status ?? "pending").toLowerCase();
    return {
      refundId: valueString(result.id) ?? input.paymentIntentId,
      status: status === "succeeded" ? "succeeded" : status === "failed" ? "failed" : "pending",
    };
  }

  async parseWebhookEvent(rawBody: Buffer, signature: string): Promise<WebhookEventResult | null> {
    if (!this.webhookSecret) throw new Error("EZPAYDIRECT_WEBHOOK_SECRET is not configured");
    const parts = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=", 2)));
    const timestamp = Number(parts.t);
    const received = parts.v1;
    if (!Number.isFinite(timestamp) || !received || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
      throw new Error("Invalid or stale EPD webhook signature");
    }
    const expected = crypto.createHmac("sha256", this.webhookSecret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(received, "hex");
    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      throw new Error("Invalid EPD webhook signature");
    }

    const payload = asObject(JSON.parse(rawBody.toString("utf8")));
    const type = valueString(payload.type);
    if (!type || !type.startsWith("order.")) return null;
    const order = asObject(asObject(payload.data).object ?? asObject(payload.data).order ?? payload.data);
    const paymentIntentId = valueString(order.id) ?? valueString(payload.order_id);
    const eventId = valueString(payload.id);
    if (!paymentIntentId || !eventId) throw new Error("Invalid EPD webhook payload");
    return { eventId, type, paymentIntentId, status: statusFromEpd(type.replace(/^order\./, "")) };
  }

  private async request(path: string, method: "GET" | "POST", body?: EpdObject, seed?: string): Promise<EpdObject> {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        "EPD-Version": this.apiVersion,
        ...(seed ? { "X-EPD-Idempotency-Key": idempotencyKey(seed) } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = asObject(await response.json().catch(() => ({})));
    if (!response.ok) throw new Error(valueString(asObject(json.error).message) ?? "Easy Pay Direct request failed");
    return json;
  }

  private toPayment(order: EpdObject, orderId: string, expectedAmount?: number, expectedCurrency?: string): RetrievePaymentResult {
    const amount = valueNumber(order.amount) ?? valueNumber(order.amount_cents) ?? valueNumber(order.total) ?? expectedAmount ?? 0;
    const currency = valueString(order.currency) ?? valueString(asObject(order.total_money).currency) ?? expectedCurrency?.toLowerCase();
    return { paymentIntentId: orderId, status: statusFromEpd(order.status), amountCents: amount, currency };
  }
}
