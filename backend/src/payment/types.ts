/**
 * PaymentProvider interface – ported from the Stripe PoC.
 * StripeProvider, WorldpayProvider, and MockProvider implement this contract.
 * The reservation layer only talks to this interface; it never
 * imports Stripe or mock internals directly.
 */

export type PaymentStatus =
  | "available"       // not yet reserved
  | "held"            // slot atomically decremented, awaiting payment initiation
  | "payment_pending" // createPayment called, awaiting confirmation
  | "authorized"      // card authorized; server must capture before hold deadline
  | "paid"            // payment confirmed
  | "registered"      // paid + registration record written
  | "failed"          // payment failed (card declined etc.)
  | "expired"         // held TTL elapsed before payment completed
  | "cancelled"       // player cancelled before paying
  | "refunded"        // paid but then refunded
  | "disputed"        // chargeback opened

export interface CreatePaymentInput {
  reservationId: string;   // becomes the idempotency key
  amountCents: number;
  currency: string;        // "usd"
  description: string;
  playerEmail: string;
  metadata: Record<string, string>;
}

export interface CreatePaymentResult {
  paymentIntentId: string;
  checkoutUrl?: string;
  clientSecret?: string;   // undefined for mock provider
  status: PaymentStatus;
}

export interface RetrievePaymentResult {
  paymentIntentId: string;
  status: PaymentStatus;
  amountCents: number;
  currency?: string;
}

export interface RefundPaymentInput {
  paymentIntentId: string;
  amountCents?: number;    // partial refund if specified
  reason?: string;
}

export interface RefundPaymentResult {
  refundId: string;
  status: "succeeded" | "pending" | "failed";
}

export interface WebhookEventResult {
  eventId: string;
  type: string;
  paymentIntentId: string;
  status: PaymentStatus;
}

/**
 * Core interface every payment adapter must implement.
 */
export interface PaymentProvider {
  readonly name: "stripe" | "mock" | "worldpay";

  /** Initiate a payment. Idempotent on reservationId. */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  /** Poll current payment state. */
  retrievePayment(paymentIntentId: string): Promise<RetrievePaymentResult>;

  /** Cancel an uncompleted payment. */
  cancelPayment?(paymentIntentId: string): Promise<void>;
  capturePayment?(paymentIntentId: string): Promise<void>;

  /** Verify the product's browser return; this is not a server webhook. */
  verifyCheckoutReturn?(paymentIntentId: string, fields: Record<string, string>): Promise<void>;

  /** Issue a full or partial refund. */
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;

  /**
   * Parse and validate an inbound webhook payload.
   * Returns null if the event is not relevant to this provider.
   */
  parseWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<WebhookEventResult | null>;
}
