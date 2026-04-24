import { doc, getDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from './firestore';
import { globalMenu } from '../menus/globalMenu';
import type { Menu } from '../../types';

/**
 * Loads a menu by id. If the id is 'global-default' or the doc is missing,
 * returns the in-app global menu instead.
 */
export async function getMenu(menuId: string): Promise<Menu> {
  if (menuId === 'global-default') return globalMenu;
  const snap = await getDoc(doc(db, COLLECTIONS.MENUS, menuId));
  if (!snap.exists()) return globalMenu;
  return { id: snap.id, ...snap.data() } as Menu;
}
