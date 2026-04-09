import { useFilterStyleSafe } from '@/contexts/FilterStyleContext';

/**
 * Simple hook to get the current global icon filter style
 * Use this for components that need the current global style
 * Falls back to BRAND_GREEN if context is not available (e.g., in federated modules)
 *
 * @returns The current icon filter style object
 *
 * @example
 * const iconStyle = useIconFilterStyle();
 * return <img src="/icon.svg" style={iconStyle} />;
 */
export const useIconFilterStyle = () => {
  const { currentFilterStyle } = useFilterStyleSafe();
  return currentFilterStyle;
};
