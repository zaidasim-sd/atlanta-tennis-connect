import { Schema, model, Types } from "mongoose";

export interface ConfirmationDetails {
  league: string;
  format: string;
  level: string;
  schedule: string;
  venue: string;
  startDate?: string;
  endDate?: string;
  playerEmail: string;
  amountCents: number;
  provider: string;
  paymentReference: string;
  transactionReference?: string;
  confirmedAt: string;
  sandbox: boolean;
}

export interface IRegistrationEmail {
  _id: string;
  reservationId: Types.ObjectId;
  kind: "player" | "merchant";
  recipient: string;
  details: ConfirmationDetails;
  status: "pending" | "sending" | "sent" | "failed";
  attempts: number;
  nextAttemptAt: Date;
  leaseUntil?: Date;
  leaseToken?: string;
  sentAt?: Date;
  lastErrorCode?: string;
}

// One durable message per reservation and recipient role. Created in the same
// transaction as registration confirmation, never from a browser success URL.
const schema = new Schema<IRegistrationEmail>({
  _id: { type: String, required: true },
  reservationId: { type: Schema.Types.ObjectId, required: true, index: true },
  kind: { type: String, enum: ["player", "merchant"], required: true },
  recipient: { type: String, default: "" },
  details: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["pending", "sending", "sent", "failed"], default: "pending" },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseUntil: Date,
  leaseToken: String,
  sentAt: Date,
  lastErrorCode: String,
}, { timestamps: true });
schema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
export const RegistrationEmail = model<IRegistrationEmail>("RegistrationEmail", schema);
