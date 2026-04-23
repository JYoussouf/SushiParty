import { getFirestore } from 'firebase/firestore';
import { firebaseApp } from './config';

export const db = getFirestore(firebaseApp);

// Collection path constants — single source of truth
export const COLLECTIONS = {
  USERS: 'users',
  SESSIONS: 'sessions',
  RESTAURANTS: 'restaurants',
  MENUS: 'menus',
  GROUP_CODES: 'groupCodes',
} as const;
