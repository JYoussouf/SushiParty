import {
  doc,
  getDoc,
  setDoc,
  query,
  collection,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firestore';
import type { User } from '../../types';

export async function createUserDoc(
  uid: string,
  email: string,
  displayName: string,
  username: string,
): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.USERS, uid), {
    uid,
    email,
    displayName,
    username: username.toLowerCase().trim(),
    createdAt: serverTimestamp(),
    friendIds: [],
  });
}

export async function getUserDoc(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  return snap.exists() ? (snap.data() as User) : null;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const q = query(
    collection(db, COLLECTIONS.USERS),
    where('username', '==', username.toLowerCase().trim()),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
