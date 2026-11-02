// Domain model for the Atlanta tennis league platform.
// Shaped so it can be swapped for real backend tables with minimal changes.

export type SeasonStatus = "upcoming" | "active" | "closed";

export type LeagueFormat =
  | "men-singles"
  | "women-singles"
  | "men-doubles"
  | "women-doubles"
  | "junior-singles"
  | "junior-doubles"
  | "mixed-doubles"
  | "senior-singles"
  | "senior-doubles";

export type SkillLevel = "2.5" | "3.0" | "3.5" | "4.0" | "4.5" | "5.0";

export const ATLANTA_AREAS = [
  "Midtown",
  "Buckhead",
  "Cumming",
  "Sandy Springs",
  "Alpharetta",
  "Marietta",
] as const;

export type AtlantaArea = (typeof ATLANTA_AREAS)[number];

export const APPROVED_ATLANTA_ZIPS = [
  "30004", "30005", "30008", "30009", "30022", "30023", "30028", "30040", "30041", "30060",
  "30062", "30064", "30066", "30067", "30068",
  "30303", "30305", "30306", "30307", "30308", "30309", "30310", "30311", "30312", "30313",
  "30314", "30315", "30316", "30317", "30318", "30319", "30324", "30326", "30327", "30328",
  "30329", "30331", "30332", "30334", "30336", "30337", "30338", "30339", "30340", "30341",
  "30342", "30344", "30345", "30349", "30350", "30354", "30360", "30363",
] as const;

export type ApprovedAtlantaZip = (typeof APPROVED_ATLANTA_ZIPS)[number];

export interface GeographicGroup {
  groupId: string;
  name: string;
  groupType: "metro-core" | "perimeter-north" | "perimeter-south" | "east-metro" | "west-metro" | string;
  parentGroupId?: string;
  city: string;
  status: "active" | "inactive" | "tbd";
}

export interface Season {
  id: string;
  seasonId?: string;
  name: string;
  seasonName?: string;
  startDate: string; // ISO
  endDate: string; // ISO
  status: SeasonStatus;
  operatingState?: "active-season" | "off-season" | "standby";
}

export interface League {
  id: string;
  leagueId?: string;
  seasonId: string;
  seasonName?: string;
  name: string;
  leagueName?: string;
  format: LeagueFormat;
  formatId?: LeagueFormat;
  skillLevel: SkillLevel;
  offeredSkillLevels?: SkillLevel[];
  ageCategory?: "open" | "senior" | "junior" | string;
  geographicGroup?: string;
  area?: string;
  feeCents: number;
  registrationFee?: number;
  scheduleDay: string;
  matchDay?: string;
  scheduleTime: string;
  matchTime?: string;
  venue: string;
  playerLimit: number;
  capacity?: number;
  spotsRemaining?: number;
  registeredCount?: number;
  registrationOpen: boolean;
  registrationStatus?: "open" | "closed" | "upcoming" | "waitlist";
  registrationClose?: string;
  description: string;
  startDate?: string;
  seasonStartDate?: string;
  endDate?: string;
  seasonEndDate?: string;
}

export interface Player {
  id: string; // System-generated Player ID (e.g. "p-demo-player")
  playerId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | undefined;
  password?: string | undefined;
  ntrp: SkillLevel; // Declared skill level (unverified)
  declaredSkillLevel?: SkillLevel | undefined;
  city: string;
  zipCode?: string | undefined;
  preferredCourt?: string | undefined;
  homeArea?: string | undefined;
  preferredFormat?: LeagueFormat | undefined;
  handedness?: "right" | "left" | undefined;
  dateOfBirth?: string | undefined;
  parentName?: string | undefined;
  parentPhone?: string | undefined;
  isJunior?: boolean | undefined;
  gender?: "male" | "female" | "prefer-not-to-say" | undefined;
  dataSource?: string | undefined;
  eligibilityStatus?: "eligible" | "pending-verification" | "ineligible" | undefined;
  privacyPreferences?: {
    showPhoneToOpponent: boolean;
    showEmailToOpponent: boolean;
  } | undefined;
  accountStatus?: "active" | "suspended" | "closed" | undefined;
  profileStatus?: "incomplete" | "complete" | "needs-review" | undefined;
  profileImage?: string | undefined;
}

export type RegistrationStatus =
  | "draft"
  | "payment-pending"
  | "paid"
  | "awaiting-review"
  | "confirmed";

export type PaymentStatus =
  | "not-started"
  | "pending"
  | "succeeded"
  | "failed"
  | "refund-pending"
  | "refunded";

export type PartnerStatus =
  | "none"
  | "search-initiated"
  | "requested"
  | "accepted"
  | "declined"
  | "replacement-needed"
  | "pending"; // backward-compatible alias for requested

export interface Registration {
  id: string;
  leagueId: string;
  playerId: string;
  createdAt: string;
  registrationStatus?: RegistrationStatus | undefined;
  paymentStatus: PaymentStatus | "paid" | "pending";
  amountCents: number;
  skillLevelSnapshot?: SkillLevel | undefined;
  doublesPartnerId?: string | undefined;
  partnerStatus?: PartnerStatus | undefined;
  preferredCourt?: string | undefined;
  paymentReference?: string | undefined;
}

export type MatchStatus =
  | "unassigned"
  | "opponent-assigned"
  | "scheduling-required"
  | "scheduled"
  | "completed";

export interface Match {
  id: string;
  matchId?: string;
  seasonId: string;
  leagueId: string;
  geographicGroupId?: string;
  playerId: string;
  opponentId?: string;
  opponentName?: string;
  opponentLevel?: SkillLevel;
  homeAway?: "home" | "away";
  matchDate?: string;
  matchTime?: string;
  court?: string;
  matchStatus: MatchStatus;
  scheduleSource?: "system" | "manual" | "mutual";
  courtBookingStatus?: "not-booked" | "booked" | "pending";
  courtBookingOwner?: string;
  rescheduleStatus?: "none" | "requested" | "rescheduled";
}

export interface MatchResult {
  resultId: string;
  matchId: string;
  submittedBy: string;
  scoreData: string;
  winnerId: string;
  status: "not-available" | "submitted" | "awaiting-confirmation" | "accepted" | "disputed";
  submittedAt?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  disputeReason?: string;
}

export interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number; // percentage e.g. 75
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "player" | "organizer";
  playerId?: string | undefined;
}

export const FORMAT_LABELS: Record<LeagueFormat, string> = {
  "men-singles": "Men's Singles",
  "women-singles": "Women's Singles",
  "men-doubles": "Men's Doubles",
  "women-doubles": "Women's Doubles",
  "junior-singles": "Junior Singles",
  "junior-doubles": "Junior Doubles",
  "mixed-doubles": "Mixed Doubles",
  "senior-singles": "Senior Singles",
  "senior-doubles": "Senior Doubles",
};

export const FORMAT_DETAILS: Record<LeagueFormat, { teamSize: number; partnerRequired: boolean }> = {
  "men-singles": { teamSize: 1, partnerRequired: false },
  "women-singles": { teamSize: 1, partnerRequired: false },
  "men-doubles": { teamSize: 2, partnerRequired: true },
  "women-doubles": { teamSize: 2, partnerRequired: true },
  "junior-singles": { teamSize: 1, partnerRequired: false },
  "junior-doubles": { teamSize: 2, partnerRequired: true },
  "mixed-doubles": { teamSize: 2, partnerRequired: true },
  "senior-singles": { teamSize: 1, partnerRequired: false },
  "senior-doubles": { teamSize: 2, partnerRequired: true },
};

export const SKILL_LEVELS: SkillLevel[] = ["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

export const ATLANTA_VENUES = [
  "Piedmont Park Courts",
  "Sharon Lester Tennis Center",
  "Tolleson Park Courts",
  "Newtown Park Courts",
  "State Bridge Tennis Courts",
  "Roswell Tennis Courts",
  "Roswell Area Park Tennis Center",
  "Terrell Mill Tennis Center",
  "Harrison Tennis Center",
  "Fowler Park Courts",
  "Sharon Springs Park",
  "Webb Bridge Park Courts",
  "North Park Tennis Center",
  "Sandy Springs Tennis Center",
  "Cumming City Park Tennis Center",
  "Central Park Tennis Complex",
  "Chastain Park Tennis Center",
  "Bitsy Grant Tennis Center",
  "Smyrna Tennis Center"
] as const;

export const formatMoney = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

export const formatDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const formatDateRange = (a: string, b: string) =>
  `${new Date(a + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${formatDate(b)}`;

/* ----------------------- FALLBACK MOCK DATA (Fallback Only) -----------------------
 * This data is used STRICTLY as an offline fallback when the backend database/API
 * is unreachable. Primary data fetching must always query the MongoDB API first.
 */

export const FALLBACK_MOCK_SEASONS: Season[] = [
  { id: "s-fall-26", name: "Fall 2026", startDate: "2026-10-10", endDate: "2026-12-19", status: "active" },
];
export const SEED_SEASONS = FALLBACK_MOCK_SEASONS;

export const FALLBACK_MOCK_LEAGUES: League[] = [];
export const SEED_LEAGUES = FALLBACK_MOCK_LEAGUES;

export const FALLBACK_MOCK_PLAYERS: Player[] = [
  { id: "p-demo-player", firstName: "Alex", lastName: "Mercer", email: "player@baselineatl.com", phone: "(404) 555-0100", ntrp: "3.5", city: "Atlanta", zipCode: "30305", preferredCourt: "Northside Tennis Center", accountStatus: "active", profileStatus: "complete" },
  { id: "p-demo-organizer", firstName: "Organizer", lastName: "", email: "organizer@baselineatl.com", phone: "(404) 555-0199", ntrp: "4.0", city: "Atlanta", zipCode: "30309", preferredCourt: "Northside Tennis Center", accountStatus: "active", profileStatus: "complete" },
  { id: "PLY-001", firstName: "Marcus", lastName: "Vance", email: "marcus.vance@example.com", phone: "(404) 555-0101", ntrp: "3.5", city: "Atlanta", zipCode: "30309", preferredCourt: "Northside Tennis Center", accountStatus: "active", profileStatus: "complete" },
  { id: "PLY-002", firstName: "Elena", lastName: "Brooks", email: "elena.brooks@example.com", phone: "(404) 555-0102", ntrp: "3.5", city: "Atlanta", zipCode: "30309", preferredCourt: "Midtown Court", accountStatus: "active", profileStatus: "complete" },
  { id: "PLY-003", firstName: "David", lastName: "Kim", email: "david.kim@example.com", phone: "(404) 555-0103", ntrp: "4.0", city: "Atlanta", zipCode: "30319", preferredCourt: "Brookhaven Area Court", accountStatus: "active", profileStatus: "complete" },
  { id: "PLY-004", firstName: "Rachel", lastName: "Patel", email: "rachel.patel@example.com", phone: "(404) 555-0104", ntrp: "3.5", city: "Atlanta", zipCode: "30309", preferredCourt: "Piedmont Area Court", accountStatus: "active", profileStatus: "complete" },
  { id: "PLY-005", firstName: "Thomas", lastName: "Hayes", email: "thomas.hayes@example.com", phone: "(404) 555-0105", ntrp: "3.5", city: "Atlanta", zipCode: "30309", preferredCourt: "Northside Tennis Center", accountStatus: "active", profileStatus: "complete" },
  { id: "PLY-006", firstName: "Maya", lastName: "Jenkins", email: "maya.jenkins@example.com", phone: "(404) 555-0106", ntrp: "3.5", city: "Atlanta", zipCode: "30309", preferredCourt: "Midtown Court", accountStatus: "active", profileStatus: "complete" },
  { id: "PLY-007", firstName: "Andre", lastName: "Silva", email: "andre.silva@example.com", phone: "(404) 555-0107", ntrp: "4.0", city: "Atlanta", zipCode: "30319", preferredCourt: "Brookhaven Area Court", accountStatus: "active", profileStatus: "complete" },
  { id: "PLY-008", firstName: "Chloe", lastName: "Bennett", email: "chloe.bennett@example.com", phone: "(404) 555-0108", ntrp: "3.5", city: "Atlanta", zipCode: "30309", preferredCourt: "Piedmont Area Court", accountStatus: "active", profileStatus: "complete" },
  { id: "PLY-009", firstName: "Nathan", lastName: "Walker", email: "nathan.walker@example.com", phone: "(404) 555-0109", ntrp: "3.5", city: "Atlanta", zipCode: "30309", preferredCourt: "Northside Tennis Center", accountStatus: "active", profileStatus: "complete" },
  { id: "PLY-010", firstName: "Sarah", lastName: "Collins", email: "sarah.collins@example.com", phone: "(404) 555-0110", ntrp: "3.5", city: "Atlanta", zipCode: "30309", preferredCourt: "Midtown Court", accountStatus: "active", profileStatus: "complete" },
];
export const SEED_PLAYERS = FALLBACK_MOCK_PLAYERS;

export const FALLBACK_MOCK_REGISTRATIONS: Registration[] = [];
export const SEED_REGISTRATIONS = FALLBACK_MOCK_REGISTRATIONS;

export const FALLBACK_MOCK_MATCHES: Match[] = [];

export const FALLBACK_MOCK_RESULTS: MatchResult[] = [
  {
    resultId: "res-1",
    matchId: "m-past-1",
    submittedBy: "p-demo-player",
    scoreData: "6-4, 7-5",
    winnerId: "p-demo-player",
    status: "accepted",
  },
];
