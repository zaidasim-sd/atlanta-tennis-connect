import { Schema, model, Document, Types } from "mongoose";

export type MatchResultStatus = "finalized" | "cancelled";

export interface ISetScore {
  playerA: number;
  playerB: number;
}

export interface IMatchResult extends Document {
  /** Unique slug e.g. "mr-season1-ms35-001" */
  slug: string;

  /** Season slug reference */
  seasonSlug: string;

  /** City division slug reference (optional for now) */
  cityDivisionSlug?: string;

  /** League slug reference */
  leagueSlug: string;

  /** League format for proper doubles accounting */
  leagueFormat: string;

  /** Match date ISO YYYY-MM-DD */
  matchDate: string;

  // === Singles / Team A ===
  playerASlug: string;
  playerAName: string;

  /** Doubles partner for A */
  playerAPartnerSlug?: string;
  playerAPartnerName?: string;

  // === Singles / Team B ===
  playerBSlug: string;
  playerBName: string;

  /** Doubles partner for B */
  playerBPartnerSlug?: string;
  playerBPartnerName?: string;

  // === Set Scores ===
  set1: ISetScore;
  set2: ISetScore;
  set3?: ISetScore;

  /** Player slug of the winner (A or B side lead) */
  winnerSlug: string;

  /** Derived: "A" | "B" */
  winningSide: "A" | "B";

  /** only "finalized" results count toward stats; "cancelled" are excluded */
  status: MatchResultStatus;

  /** Who entered this result */
  enteredBySlug: string;
  enteredByEmail: string;

  /** Immutable snapshot of the original data for audit trail */
  originalData?: Record<string, unknown>;

  /** Edit history */
  editHistory: Array<{
    editedAt: Date;
    editedBySlug: string;
    editedByEmail: string;
    previous: Record<string, unknown>;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const SetScoreSchema = new Schema<ISetScore>(
  {
    playerA: { type: Number, required: true, min: 0 },
    playerB: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const MatchResultSchema = new Schema<IMatchResult>(
  {
    slug:              { type: String, required: true, unique: true, index: true },
    seasonSlug:        { type: String, required: true, index: true },
    cityDivisionSlug:  { type: String, index: true },
    leagueSlug:        { type: String, required: true, index: true },
    leagueFormat:      { type: String, required: true },
    matchDate:         { type: String, required: true },

    playerASlug:           { type: String, required: true, index: true },
    playerAName:           { type: String, required: true },
    playerAPartnerSlug:    { type: String },
    playerAPartnerName:    { type: String },

    playerBSlug:           { type: String, required: true, index: true },
    playerBName:           { type: String, required: true },
    playerBPartnerSlug:    { type: String },
    playerBPartnerName:    { type: String },

    set1:              { type: SetScoreSchema, required: true },
    set2:              { type: SetScoreSchema, required: true },
    set3:              { type: SetScoreSchema },

    winnerSlug:        { type: String, required: true, index: true },
    winningSide:       { type: String, enum: ["A", "B"], required: true },

    status:            {
      type: String,
      enum: ["finalized", "cancelled"],
      default: "finalized",
      index: true,
    },

    enteredBySlug:     { type: String, required: true },
    enteredByEmail:    { type: String, required: true },

    originalData:      { type: Schema.Types.Mixed },
    editHistory:       {
      type: [
        {
          editedAt:        { type: Date, required: true },
          editedBySlug:    { type: String, required: true },
          editedByEmail:   { type: String, required: true },
          previous:        { type: Schema.Types.Mixed, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

// Compound indexes for stats lookups
MatchResultSchema.index({ playerASlug: 1, status: 1, seasonSlug: 1 });
MatchResultSchema.index({ playerBSlug: 1, status: 1, seasonSlug: 1 });
MatchResultSchema.index({ playerAPartnerSlug: 1, status: 1, seasonSlug: 1 });
MatchResultSchema.index({ playerBPartnerSlug: 1, status: 1, seasonSlug: 1 });
MatchResultSchema.index({ leagueSlug: 1, status: 1 });
// Prevent duplicate match records (same two players, same league, same date)
MatchResultSchema.index(
  { leagueSlug: 1, playerASlug: 1, playerBSlug: 1, matchDate: 1 },
  { unique: true },
);

export const MatchResult = model<IMatchResult>("MatchResult", MatchResultSchema);
