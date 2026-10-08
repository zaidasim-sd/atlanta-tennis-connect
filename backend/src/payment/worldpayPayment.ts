import { Schema, model } from "mongoose";

// A durable creation claim prevents concurrent requests from issuing two hosted sessions.
const schema = new Schema(
  {
    _id: { type: String, required: true },
    amountCents: { type: Number, required: true },
    setupId: String,
    cancelled: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const WorldpayPayment = model("WorldpayPayment", schema);
