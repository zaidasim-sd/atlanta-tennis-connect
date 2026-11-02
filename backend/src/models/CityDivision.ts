import { Schema, model, Document } from "mongoose";

/** A city-level division used for manual Season One placement. */
export interface ICityDivision extends Document {
  slug: string;
  seasonSlug: string;
  city: string;
  name: string;
  categoryCode: string;
  skillLevel?: string;
  status: "open" | "standby" | "closed";
  leagueSlugs: string[];
  manualPlacementOnly: boolean;
}

const CityDivisionSchema = new Schema<ICityDivision>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    seasonSlug: { type: String, required: true, index: true },
    city: { type: String, required: true, index: true },
    name: { type: String, required: true },
    categoryCode: { type: String, required: true },
    skillLevel: { type: String },
    status: { type: String, enum: ["open", "standby", "closed"], default: "standby" },
    leagueSlugs: { type: [String], default: [] },
    manualPlacementOnly: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CityDivisionSchema.index({ seasonSlug: 1, city: 1, categoryCode: 1 });

export const CityDivision = model<ICityDivision>("CityDivision", CityDivisionSchema);
