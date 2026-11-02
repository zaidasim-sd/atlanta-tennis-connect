import { Schema, model, Document } from "mongoose";

export type SeasonStatus = "upcoming" | "active" | "closed";
export type SeasonOperatingState = "active-season" | "off-season" | "standby";

export interface ISeason extends Document {
  slug: string;          // e.g. "s-fall-26" – stable ID used by frontend
  name: string;
  startDate: string;     // ISO date string "YYYY-MM-DD"
  endDate: string;
  status: SeasonStatus;
  /** Controls whether player registration may create new reservations. */
  operatingState: SeasonOperatingState;
}

const SeasonSchema = new Schema<ISeason>(
  {
    slug:      { type: String, required: true, unique: true, index: true },
    name:      { type: String, required: true },
    startDate: { type: String, required: true },
    endDate:   { type: String, required: true },
    status:    { type: String, enum: ["upcoming", "active", "closed"], default: "upcoming" },
    operatingState: {
      type: String,
      enum: ["active-season", "off-season", "standby"],
      default: "standby",
      index: true,
    },
  },
  { timestamps: true },
);

export const Season = model<ISeason>("Season", SeasonSchema);
