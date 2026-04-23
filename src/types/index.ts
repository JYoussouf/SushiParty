// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  createdAt: string; // ISO timestamp
  friendIds: string[];
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export type SushiSize = 'small' | 'medium' | 'large';

export interface SushiItem {
  id: string;
  name: string;
  category: 'nigiri' | 'sashimi' | 'roll' | 'special' | 'other';
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
  flagged?: boolean; // true if anomaly detection raised a flag
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
