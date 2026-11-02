import { Schema, model, Document } from "mongoose";
import { ATLANTA_AREAS, type AtlantaArea } from "../lib/constants";

export type LeagueFormat =
  | "men-singles"
  | "women-singles"
  | "men-doubles"
  | "women-doubles"
  | "junior-singles"
  | "junior-doubles"
  | "mixed-doubles";

export type SkillLevel = "2.5" | "3.0" | "3.5" | "4.0" | "4.5" | "5.0";

export interface ILeague extends Document {
  slug: string;           // stable frontend ID e.g. "l-1"
  seasonSlug: string;     // references Season.slug
  name: string;
  format: LeagueFormat;
  skillLevel: SkillLevel;
  feeCents: number;
  scheduleDay: string;    // e.g. "Tuesday"
  scheduleTime: string;   // e.g. "6:30 PM"
  venue: string;
  area?: AtlantaArea;
  playerLimit: number;
  spotsRemaining: number; // decremented atomically on reservation
  registrationOpen: boolean;
  registrationDeadline?: Date;
  description: string;
  startDate?: string;
  endDate?: string;
  ageCategory?: "open" | "junior";
  ageMin?: number;
  ageMax?: number;
  dataSource?: string;
}

const LeagueSchema = new Schema<ILeague>(
  {
    slug:             { type: String, required: true, unique: true, index: true },
    seasonSlug:       { type: String, required: true, index: true },
    name:             { type: String, required: true },
    format:           {
      type: String,
      enum: [
        "men-singles",
        "women-singles",
        "men-doubles",
        "women-doubles",
        "junior-singles",
        "junior-doubles",
        "mixed-doubles",
      ],
      required: true,
    },
    skillLevel:       { type: String, enum: ["2.5","3.0","3.5","4.0","4.5","5.0"], required: true },
    feeCents:         { type: Number, required: true, min: 0 },
    scheduleDay:      { type: String, required: true },
    scheduleTime:     { type: String, required: true },
    venue:            { type: String, required: true },
    area:             { type: String, enum: ATLANTA_AREAS, default: "Midtown" },
    playerLimit:      { type: Number, required: true, min: 1 },
    spotsRemaining:   { type: Number, required: true, min: 0 },
    registrationOpen: { type: Boolean, default: true },
    registrationDeadline: { type: Date },
    description:      { type: String, default: "" },
    startDate:        { type: String },
    endDate:          { type: String },
    ageCategory:      { type: String, enum: ["open", "junior"], default: "open" },
    ageMin:           { type: Number },
    ageMax:           { type: Number },
    dataSource:       { type: String },
  },
  { timestamps: true },
);

// Compound index for the browse-leagues query
LeagueSchema.index({ registrationOpen: 1, skillLevel: 1, format: 1 });

export const League = model<ILeague>("League", LeagueSchema);
