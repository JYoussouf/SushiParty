import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firestore';
import type { SushiSession, SessionMode, SessionParticipant, GeoPoint } from '../../types';

interface SubmitSessionParams {
  ownerUid: string;
  mode: SessionMode;
  restaurantId: string;
  restaurantName: string;
  menuId: string;
  menuVersion: number;
  location: GeoPoint;
  participants: SessionParticipant[];
}

export async function submitSession(params: SubmitSessionParams): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.SESSIONS), {
    ...params,
    startedAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
    groupCode: null,
    flagged: false,
  });
  return ref.id;
}

const PAGE_SIZE = 20;

export async function getUserSessions(
  uid: string,
  cursor?: QueryDocumentSnapshot<DocumentData>,
): Promise<{ sessions: SushiSession[]; nextCursor: QueryDocumentSnapshot<DocumentData> | null }> {
  let q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where('ownerUid', '==', uid),
    orderBy('submittedAt', 'desc'),
    limit(PAGE_SIZE),
  );
  if (cursor) q = query(q, startAfter(cursor));

  const snap = await getDocs(q);
  const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SushiSession);
  const nextCursor = snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] ?? null : null;
  return { sessions, nextCursor };
}
