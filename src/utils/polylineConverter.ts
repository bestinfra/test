/**
 * Utility functions for converting PolylineData from CSV to FeederPath format
 */

export interface PolylineData {
  sourceLat: number;
  sourceLon: number;
  lat: number;
  lon: number;
  feederCode: string;
  ssCode: string;
}

export interface FeederPath {
  feederId: string;
  name: string;
  color?: string;
  type?: string;
  path: google.maps.LatLngLiteral[];
  pathIcons?: any[];
}

/**
 * Check if two points are approximately equal (within tolerance)
 */
const pointsEqual = (
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
  tolerance: number = 0.0001
): boolean => {
  return Math.abs(p1.lat - p2.lat) < tolerance && Math.abs(p1.lng - p2.lng) < tolerance;
};

/**
 * Convert PolylineData[] to FeederPath[] format
 * Groups segments by feeder code and connects them into continuous paths
 * 
 * @param polylineData - Array of polyline segments from CSV
 * @param getFeederColor - Function to get color for a feeder code
 * @param connectSegments - Whether to connect segments into continuous paths (default: true)
 * @param feedersToConnect - Set of feeder codes that should have segments connected
 * @returns Array of FeederPath objects ready for Google Maps
 */
export const convertPolylineDataToFeederPaths = (
  polylineData: PolylineData[],
  getFeederColor?: (feederCode: string) => string,
  connectSegments: boolean = true,
  feedersToConnect?: Set<string>
): FeederPath[] => {
  if (!polylineData || polylineData.length === 0) return [];

  // Group segments by feeder code
  const segmentsByFeeder = new Map<string, PolylineData[]>();
  polylineData.forEach((row) => {
    const feederCode = row.feederCode.trim();
    if (!segmentsByFeeder.has(feederCode)) {
      segmentsByFeeder.set(feederCode, []);
    }
    segmentsByFeeder.get(feederCode)!.push(row);
  });

  const feederPaths: FeederPath[] = [];

  segmentsByFeeder.forEach((segments, feederCode) => {
    const color = getFeederColor ? getFeederColor(feederCode) : undefined;
    const shouldConnect = connectSegments && (
      !feedersToConnect || feedersToConnect.has(feederCode.trim())
    );

    if (shouldConnect) {
      // Build continuous paths by connecting segments that share endpoints
      const paths: google.maps.LatLngLiteral[][] = [];
      const usedSegments = new Set<number>();

      // Try to build paths starting from each unused segment
      for (let i = 0; i < segments.length; i++) {
        if (usedSegments.has(i)) continue;

        const startSegment = segments[i];
        const path: google.maps.LatLngLiteral[] = [
          { lat: startSegment.sourceLat, lng: startSegment.sourceLon },
          { lat: startSegment.lat, lng: startSegment.lon },
        ];
        usedSegments.add(i);

        // Try to extend the path forward (from end point)
        let currentEnd = { lat: startSegment.lat, lng: startSegment.lon };
        let foundNext = true;

        while (foundNext) {
          foundNext = false;
          for (let j = 0; j < segments.length; j++) {
            if (usedSegments.has(j)) continue;

            const segment = segments[j];
            const segmentStart = { lat: segment.sourceLat, lng: segment.sourceLon };
            const segmentEnd = { lat: segment.lat, lng: segment.lon };

            // Check if segment starts at current end point
            if (pointsEqual(currentEnd, segmentStart)) {
              path.push({ lat: segment.lat, lng: segment.lon });
              currentEnd = segmentEnd;
              usedSegments.add(j);
              foundNext = true;
              break;
            }
            // Check if segment ends at current end point (reverse direction)
            if (pointsEqual(currentEnd, segmentEnd)) {
              path.push({ lat: segment.sourceLat, lng: segment.sourceLon });
              currentEnd = segmentStart;
              usedSegments.add(j);
              foundNext = true;
              break;
            }
          }
        }

        // Try to extend the path backward (from start point)
        let currentStart = { lat: startSegment.sourceLat, lng: startSegment.sourceLon };
        foundNext = true;

        while (foundNext) {
          foundNext = false;
          for (let j = 0; j < segments.length; j++) {
            if (usedSegments.has(j)) continue;

            const segment = segments[j];
            const segmentStart = { lat: segment.sourceLat, lng: segment.sourceLon };
            const segmentEnd = { lat: segment.lat, lng: segment.lon };

            // Check if segment ends at current start point
            if (pointsEqual(currentStart, segmentEnd)) {
              path.unshift({ lat: segment.sourceLat, lng: segment.sourceLon });
              currentStart = segmentStart;
              usedSegments.add(j);
              foundNext = true;
              break;
            }
            // Check if segment starts at current start point (reverse direction)
            if (pointsEqual(currentStart, segmentStart)) {
              path.unshift({ lat: segment.lat, lng: segment.lon });
              currentStart = segmentEnd;
              usedSegments.add(j);
              foundNext = true;
              break;
            }
          }
        }

        if (path.length >= 2) {
          paths.push(path);
        }
      }

      // Create FeederPath for each continuous path
      paths.forEach((path, index) => {
        feederPaths.push({
          feederId: feederCode,
          name: paths.length > 1 ? `${feederCode} (Path ${index + 1})` : feederCode,
          color,
          path,
        });
      });
    } else {
      // Render each segment individually
      segments.forEach((row) => {
        feederPaths.push({
          feederId: feederCode,
          name: feederCode,
          color,
          path: [
            { lat: row.sourceLat, lng: row.sourceLon },
            { lat: row.lat, lng: row.lon },
          ],
        });
      });
    }
  });

  return feederPaths;
};
