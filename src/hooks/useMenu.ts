import { useRestaurant } from '../contexts/RestaurantContext';

/**
 * Thin wrapper around RestaurantContext that exposes only the menu state.
 * Kept as a hook so non-restaurant-aware components stay decoupled.
 */
export function useMenu() {
  const { activeMenu, restaurantMenu, useGlobalMenu, setUseGlobalMenu, restaurant } =
    useRestaurant();
  // Show the toggle only when the restaurant actually has a non-global menu
  const canToggle = !!restaurant && restaurantMenu.id !== 'global-default';
  return { activeMenu, useGlobalMenu, setUseGlobalMenu, canToggle };
}
