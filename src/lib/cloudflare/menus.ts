import { globalMenu } from '../menus/globalMenu';
import type { Menu } from '../../types';
import { apiRequest } from './client';

export async function getMenu(menuId: string): Promise<Menu> {
  if (menuId === 'global-default') return globalMenu;

  try {
    const { menu } = await apiRequest<{ menu: Menu }>(`/menus/${encodeURIComponent(menuId)}`);
    return menu;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
      return globalMenu;
    }
    throw error;
  }
}
