// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  createdAt: string; // ISO timestamp
  friendIds: string[];
  avatar?: string;
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export type SushiSize = 'small' | 'medium' | 'large';

export interface SushiItem {
  id: string;
  name: string;
  category: 'nigiri' | 'sashimi' | 'roll' | 'handroll' | 'special_roll' | 'soup' | 'salad' | 'special' | 'dessert' | 'rice' | 'noodles' | 'teriyaki' | 'skewers' | 'spring_roll' | 'other';
  sizes?: SushiSize[]; // undefined = no size variant (one-size)
  imageKey?: string; // filename stem in assets/images/sushi/
}

export interface Menu {
  id: string;
  restaurantId?: string; // undefined = global default menu
  version: number;
  items: SushiItem[];
}

// ─── Session ──────────────────────────────────────────────────────────────────

export type SessionMode = 'single' | 'individual' | 'group';

export interface SessionParticipant {
  userId: string;
  displayName: string;
  avatar?: string;
  counts: Record<string, number>; // itemId → count (or itemId:size → count)
}

export interface SushiSession {
  id: string;
  mode: SessionMode;
  restaurantId: string;
  restaurantName: string;
  menuId: string;
  menuVersion: number;
  location: GeoPoint;
  startedAt: string; // ISO
  submittedAt?: string; // ISO, set when session is closed
  participants: SessionParticipant[];
  groupCode?: string; // present for group-linked sessions
  note?: string;
  flagged?: boolean; // true if anomaly detection raised a flag
}

export type GroupPhase = 'lobby' | 'active' | 'ended';

// Host-initiated "end party" vote. The host starts it; every participant accepts.
// Once acceptedUserIds covers all participants (or the host overrides via /end),
// the party moves to phase='ended'. Optional so non-voting drafts stay valid.
export interface GroupEndVote {
  active: boolean;
  startedBy: string; // owner uid that opened the vote (implicitly accepts)
  acceptedUserIds: string[]; // participants who have accepted (deduped)
  startedAt: string; // ISO
}

export interface GroupSessionDraft {
  id: string;
  code: string;
  ownerUid: string;
  phase: GroupPhase; // 'lobby' until the host starts, then 'active'; 'ended' closes it
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  participants: SessionParticipant[];
  // Host-initiated end-party vote state (issue #31). Absent unless a vote is/was open.
  endVote?: GroupEndVote;
  // Shared session context the host populates when the party starts (phase='active').
  // Optional so lobby/legacy drafts stay valid. Lets guests reconstruct results at end.
  restaurantId?: string;
  restaurantName?: string;
  location?: GeoPoint;
  menuId?: string;
  menuVersion?: number;
  startedAt?: string; // ISO
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

// ─── Restaurant ───────────────────────────────────────────────────────────────

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  location: GeoPoint;
  menuId: string; // points to location-specific or global menu
  stats: RestaurantStats;
  // Optional Google Places metadata (populated for `google-*` results).
  rating?: number; // 0..5 average review score
  userRatingCount?: number; // number of Google reviews
  priceLevel?: number; // 0..4 ($ .. $$$$)
  openNow?: boolean; // current open state, when known
  googleMapsUri?: string; // canonical Google Maps place URL
  // A restaurant that has paid for premium placement in the near-me feed.
  featured?: boolean;
  // Photos come only from a restaurant's own partner profile (see app/partner.tsx).
  // Restaurants without a profile have none and render without images.
  photos?: string[];
}

export interface RestaurantStats {
  totalSessions: number;
  meanPiecesPerSession: number;
  stdDevPiecesPerSession: number;
  updatedAt: string;
}

// ─── Friend Activity ──────────────────────────────────────────────────────────

export interface FriendActivity {
  sessionId: string;
  userId: string;
  displayName: string;
  restaurantName: string;
  totalPieces: number;
  submittedAt: string;
}

export interface SessionTemplate {
  id: string;
  name: string;
  mode: SessionMode;
  restaurantId?: string;
  restaurantName?: string;
  useGlobalMenu: boolean;
  createdAt: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  xp: number;
  earned: boolean;
  hidden?: boolean;
  earnedAt?: string;
  earnedAtRestaurant?: string;
}

export interface FriendChallengeProgress {
  id: string;
  title: string;
  description: string;
  target: number;
  currentUserProgress: number;
  friendAverageProgress: number;
  unit: string;
}
