import { Schema, model, Document } from "mongoose";

/** The merchant organisation identity carried by new payment records. */
export interface IOrganizationProfile extends Document {
  key: "baseline-atl";
  legalEntityName: string;
  operatorName: string;
}

const OrganizationProfileSchema = new Schema<IOrganizationProfile>(
  {
    key: { type: String, enum: ["baseline-atl"], required: true, unique: true },
    legalEntityName: { type: String, required: true, default: "Hyper Nexus Group LLC" },
    operatorName: { type: String, required: true, default: "Mr Saad Moudood" },
  },
  { timestamps: true },
);

export const OrganizationProfile = model<IOrganizationProfile>("OrganizationProfile", OrganizationProfileSchema);
