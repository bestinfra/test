import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

// Define the filter style interface
export interface IconFilterStyle {
  filter: string;
}

// Define available filter styles
export const FILTER_STYLES = {
  BRAND_GREEN: {
    filter:
      'brightness(0) saturate(100%) invert(52%) sepia(60%) saturate(497%) hue-rotate(105deg) brightness(95%) contrast(90%)',
  },
  WHITE: {
    filter:
      'brightness(0) saturate(100%) invert(100%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%)',
  },
  BLUE: {
    filter:
      'brightness(0) saturate(100%) invert(15%) sepia(80%) saturate(1705%) hue-rotate(190deg) brightness(90%) contrast(105%)',
  },
  RED: {
    filter:
      'brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)',
  },
} as const;

export type FilterStyleType = keyof typeof FILTER_STYLES;

// Define the context interface
interface FilterStyleContextType {
  currentFilterStyle: IconFilterStyle;
  setFilterStyle: (style: FilterStyleType) => void;
  availableStyles: typeof FILTER_STYLES;
}

// Create the context
const FilterStyleContext = createContext<FilterStyleContextType | undefined>(undefined);

// Provider component
interface FilterStyleProviderProps {
  children: ReactNode;
  initialStyle?: FilterStyleType;
}

export const FilterStyleProvider: React.FC<FilterStyleProviderProps> = ({
  children,
  initialStyle = 'BRAND_GREEN',
}) => {
  const [currentFilterStyle, setCurrentFilterStyle] = useState<IconFilterStyle>(
    FILTER_STYLES[initialStyle]
  );

  const setFilterStyle = (style: FilterStyleType) => {
    setCurrentFilterStyle(FILTER_STYLES[style]);
  };

  const value: FilterStyleContextType = {
    currentFilterStyle,
    setFilterStyle,
    availableStyles: FILTER_STYLES,
  };

  return <FilterStyleContext.Provider value={value}>{children}</FilterStyleContext.Provider>;
};

export const useFilterStyle = (): FilterStyleContextType => {
  const context = useContext(FilterStyleContext);
  if (context === undefined) {
    throw new Error('useFilterStyle must be used within a FilterStyleProvider');
  }
  return context;
};

// Safe version for federated modules
export const useFilterStyleSafe = (): FilterStyleContextType => {
  const context = useContext(FilterStyleContext);
  if (context === undefined) {
    // Return a default context for federated modules
    return {
      currentFilterStyle: FILTER_STYLES.BRAND_GREEN,
      setFilterStyle: () => {}, // No-op function
      availableStyles: FILTER_STYLES,
    };
  }
  return context;
};
