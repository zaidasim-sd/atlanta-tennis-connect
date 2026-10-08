import { Schema, model } from "mongoose";

// A durable creation claim prevents concurrent requests from issuing two hosted sessions.
const schema = new Schema(
  {
    _id: { type: String, required: true },
    amountCents: { type: Number, required: true },
    reservationId: String,
    orderReference: String,
    currency: { type: String, default: "USD" },
    setupId: String,
    validationCode: { type: String, select: false },
    returnVerifiedAt: Date,
    transactionId: String,
    captureTransactionId: String,
    providerStatus: String,
    providerStatusCode: String,
    providerEventTime: String,
    verifiedAt: Date,
    currencySource: String,
    refundLock: String,
    cancelled: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const WorldpayPayment = model("WorldpayPayment", schema);

// Store only allowlisted reporting fields. Never retain raw gateway responses,
// which can include card information. A stable event ID deduplicates polling.
export const WorldpayObservation = model("WorldpayObservation", new Schema({
  _id: String,
  paymentId: { type: String, index: true, required: true },
  reservationId: String,
  transactionId: String,
  orderReference: String,
  currency: String,
  currencySource: String,
  amountCents: Number,
  providerStatus: String,
  providerStatusCode: String,
  transactionType: String,
  providerEventTime: String,
  providerTimezone: String,
  verifiedAt: Date,
}, { timestamps: true }));

export const WorldpayOperation = model("WorldpayOperation", new Schema({
  _id: String,
  paymentId: { type: String, required: true, index: true },
  type: String,
  amountCents: Number,
  transactionId: String,
  status: String,
  completedAt: Date,
}, { timestamps: true }));
