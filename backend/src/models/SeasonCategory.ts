import { Schema, model, Document } from "mongoose";

/**
 * A configurable Season One registration category. Categories are data, not
 * hard-coded standings logic, so organisers can enable only the divisions they
 * actually run.
 */
export interface ISeasonCategory extends Document {
  seasonSlug: string;
  code: string;
  name: string;
  format: string;
  audience: "adult" | "junior";
  partnerRequired: boolean;
  enabled: boolean;
}

const SeasonCategorySchema = new Schema<ISeasonCategory>(
  {
    seasonSlug: { type: String, required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    format: { type: String, required: true },
    audience: { type: String, enum: ["adult", "junior"], required: true },
    partnerRequired: { type: Boolean, required: true, default: false },
    enabled: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

SeasonCategorySchema.index({ seasonSlug: 1, code: 1 }, { unique: true });

export const SeasonCategory = model<ISeasonCategory>("SeasonCategory", SeasonCategorySchema);
