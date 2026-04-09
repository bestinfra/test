import { useEffect, useState, useMemo } from 'react';

export interface SVGColorOptions {
  fill?: string;
  stroke?: string;
  fillOpacity?: string;
  strokeOpacity?: string;
}

// Cache for processed SVGs to prevent re-processing
const svgCache = new Map<string, string>();

export const injectSVGColors = (svgContent: string, colors: SVGColorOptions): string => {
  let modifiedSVG = svgContent;

  // Check if this is a stroke-based icon (has stroke but no fill or fill="none")
  const isStrokeBased = modifiedSVG.includes('stroke=') && 
    (!modifiedSVG.includes('fill=') || modifiedSVG.includes('fill="none"'));

  // Replace fill colors
  if (colors.fill) {
    if (isStrokeBased) {
      // For stroke-based icons, set fill to "none" to avoid filling the shape
      modifiedSVG = modifiedSVG.replace(/fill="[^"]*"/g, `fill="none"`);
      modifiedSVG = modifiedSVG.replace(/fill=[^"\s>]+/g, `fill="none"`);
      // Add fill="none" to SVG root if no fill exists
      if (!modifiedSVG.includes('fill=')) {
        modifiedSVG = modifiedSVG.replace(/<svg([^>]*)>/, `<svg$1 fill="none">`);
      }
    } else {
      modifiedSVG = modifiedSVG.replace(/fill="[^"]*"/g, `fill="${colors.fill}"`);
      modifiedSVG = modifiedSVG.replace(/fill=[^"\s>]+/g, `fill="${colors.fill}"`);
      // Add fill to SVG root if no fill exists anywhere
      if (!modifiedSVG.includes('fill=')) {
        modifiedSVG = modifiedSVG.replace(/<svg([^>]*)>/, `<svg$1 fill="${colors.fill}">`);
      }
    }
  }

  // Replace stroke colors
  if (colors.stroke) {
    modifiedSVG = modifiedSVG.replace(/stroke="[^"]*"/g, `stroke="${colors.stroke}"`);
    modifiedSVG = modifiedSVG.replace(/stroke=[^"\s>]+/g, `stroke="${colors.stroke}"`);
  }

  // Replace fill opacity
  if (colors.fillOpacity) {
    modifiedSVG = modifiedSVG.replace(
      /fill-opacity="[^"]*"/g,
      `fill-opacity="${colors.fillOpacity}"`
    );
    modifiedSVG = modifiedSVG.replace(
      /fill-opacity=[^"\s>]+/g,
      `fill-opacity="${colors.fillOpacity}"`
    );
  }

  // Replace stroke opacity
  if (colors.strokeOpacity) {
    modifiedSVG = modifiedSVG.replace(
      /stroke-opacity="[^"]*"/g,
      `stroke-opacity="${colors.strokeOpacity}"`
    );
    modifiedSVG = modifiedSVG.replace(
      /stroke-opacity=[^"\s>]+/g,
      `stroke-opacity="${colors.strokeOpacity}"`
    );
  }

  return modifiedSVG;
};

export const fetchAndInjectSVGColors = async (
  svgPath: string,
  colors: SVGColorOptions
): Promise<string> => {
  try {
    const response = await fetch(svgPath);
    const svgContent = await response.text();
    return injectSVGColors(svgContent, colors);
  } catch (error) {
    console.error('Error fetching SVG:', error);
    return '';
  }
};

export const createColoredSVGDataURL = (svgContent: string, colors: SVGColorOptions): string => {
  const modifiedSVG = injectSVGColors(svgContent, colors);
  const encodedSVG = encodeURIComponent(modifiedSVG);
  return `data:image/svg+xml,${encodedSVG}`;
};

export const useColoredSVG = (svgPath: string, colors: SVGColorOptions) => {
  const [coloredSVG, setColoredSVG] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Create a cache key from svgPath and colors
  const cacheKey = useMemo(() => {
    return `${svgPath}_${colors.fill || ''}_${colors.stroke || ''}_${colors.fillOpacity || ''}_${colors.strokeOpacity || ''}`;
  }, [svgPath, colors.fill, colors.stroke, colors.fillOpacity, colors.strokeOpacity]);

  useEffect(() => {
    // Check cache first
    const cached = svgCache.get(cacheKey);
    if (cached) {
      setColoredSVG(cached);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const loadColoredSVG = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(svgPath);
        if (!response.ok) {
          throw new Error(`Failed to fetch SVG: ${response.statusText}`);
        }
        const svgContent = await response.text();
        const dataURL = createColoredSVGDataURL(svgContent, colors);

        // Don't update state if component unmounted or cacheKey changed
        if (!isCancelled) {
          // Cache the result
          svgCache.set(cacheKey, dataURL);
          setColoredSVG(dataURL);
          setIsLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setError('Failed to load SVG');
          console.error('Error loading colored SVG:', err);
          setIsLoading(false);
        }
      }
    };

    loadColoredSVG();

    return () => {
      isCancelled = true;
    };
  }, [cacheKey, svgPath, colors.fill, colors.stroke, colors.fillOpacity, colors.strokeOpacity]);

  return { coloredSVG, isLoading, error };
};
