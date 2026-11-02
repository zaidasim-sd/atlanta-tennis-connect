import { Schema, model, Document } from "mongoose";

/**
 * Captures a player's manual playoff preference. It intentionally does not
 * calculate qualification, standings, or bracket placement for V1.
 */
export interface IPlayoffOptIn extends Document {
  seasonSlug: string;
  divisionSlug: string;
  playerSlug: string;
  playerEmail: string;
  optedIn: boolean;
  capturedBy: "player" | "organizer";
  note?: string;
  declaredAt: Date;
}

const PlayoffOptInSchema = new Schema<IPlayoffOptIn>(
  {
    seasonSlug: { type: String, required: true, index: true },
    divisionSlug: { type: String, required: true, index: true },
    playerSlug: { type: String, required: true, index: true },
    playerEmail: { type: String, required: true, lowercase: true },
    optedIn: { type: Boolean, required: true },
    capturedBy: { type: String, enum: ["player", "organizer"], required: true },
    note: { type: String, maxlength: 1000 },
    declaredAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true },
);

PlayoffOptInSchema.index({ seasonSlug: 1, divisionSlug: 1, playerSlug: 1 }, { unique: true });

export const PlayoffOptIn = model<IPlayoffOptIn>("PlayoffOptIn", PlayoffOptInSchema);
