import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Restaurant, Menu } from '../types';
import { globalMenu } from '../lib/menus/globalMenu';
import { getMenu } from '../lib/cloudflare/menus';

interface RestaurantContextValue {
  restaurant: Restaurant | null;
  restaurantMenu: Menu; // always defined — falls back to globalMenu
  useGlobalMenu: boolean;
  activeMenu: Menu;
  setRestaurant: (r: Restaurant | null) => void;
  setUseGlobalMenu: (v: boolean) => void;
  clearRestaurant: () => void;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [restaurant, setRestaurantState] = useState<Restaurant | null>(null);
  const [restaurantMenu, setRestaurantMenu] = useState<Menu>(globalMenu);
  const [useGlobalMenu, setUseGlobalMenu] = useState(true);

  useEffect(() => {
    if (!restaurant) {
      setRestaurantMenu(globalMenu);
      setUseGlobalMenu(true);
      return;
    }
    // Load restaurant-specific menu; fall back to global if not found
    let active = true;
    void getMenu(restaurant.menuId).then((menu) => {
      if (active) {
        setRestaurantMenu(menu);
        // Default to restaurant menu whenever a new one is loaded, unless it IS the global
        setUseGlobalMenu(menu.id === globalMenu.id);
      }
    });
    return () => {
      active = false;
    };
  }, [restaurant]);

  const setRestaurant = (r: Restaurant | null) => setRestaurantState(r);
  const clearRestaurant = () => setRestaurantState(null);

  const activeMenu = useGlobalMenu ? globalMenu : restaurantMenu;

  return (
    <RestaurantContext.Provider
      value={{
        restaurant,
        restaurantMenu,
        useGlobalMenu,
        activeMenu,
        setRestaurant,
        setUseGlobalMenu,
        clearRestaurant,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant(): RestaurantContextValue {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error('useRestaurant must be used within RestaurantProvider');
  return ctx;
}
