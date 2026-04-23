import { useState } from 'react';
import { globalMenu } from '../lib/menus/globalMenu';
import type { Menu } from '../types';

export function useMenu(restaurantMenu?: Menu) {
  const [useRestaurantMenu, setUseRestaurantMenu] = useState(!!restaurantMenu);

  const activeMenu = useRestaurantMenu && restaurantMenu ? restaurantMenu : globalMenu;

  return { activeMenu, useRestaurantMenu, setUseRestaurantMenu };
}
