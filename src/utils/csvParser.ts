/**
 * CSV Parser for Polyline Data
 * Parses CSV files containing feeder line segment data
 */

import type { PolylineData } from './polylineConverter';

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
};

const parseFloatSafe = (value: string): number | null => {
  if (!value || value.trim() === '') return null;
  const parsed = parseFloat(value.trim());
  return isNaN(parsed) ? null : parsed;
};

/**
 * Parse CSV content into PolylineData array
 * Expected CSV format:
 * SOURCE_LAT,SOURCE_LON,LAT,LON,FEEDER_CODE,SS_CODE
 * 
 * @param csvContent - Raw CSV string content
 * @returns Array of PolylineData objects
 * @throws Error if required columns are not found
 */
export const parseCSV = async (csvContent: string): Promise<PolylineData[]> => {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    return [];
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  const sourceLatIndex = headers.indexOf('SOURCE_LAT');
  const sourceLonIndex = headers.indexOf('SOURCE_LON');
  const latIndex = headers.indexOf('LAT');
  const lonIndex = headers.indexOf('LON');
  const feederCodeIndex = headers.indexOf('FEEDER_CODE');
  const ssCodeIndex = headers.indexOf('SS_CODE');

  if (
    sourceLatIndex === -1 ||
    sourceLonIndex === -1 ||
    latIndex === -1 ||
    lonIndex === -1 ||
    feederCodeIndex === -1 ||
    ssCodeIndex === -1
  ) {
    throw new Error('Required columns not found in CSV. Expected: SOURCE_LAT, SOURCE_LON, LAT, LON, FEEDER_CODE, SS_CODE');
  }

  const polylineData: PolylineData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length <= Math.max(sourceLatIndex, sourceLonIndex, latIndex, lonIndex, feederCodeIndex, ssCodeIndex)) {
      continue;
    }

    const sourceLat = parseFloatSafe(values[sourceLatIndex]);
    const sourceLon = parseFloatSafe(values[sourceLonIndex]);
    const lat = parseFloatSafe(values[latIndex]);
    const lon = parseFloatSafe(values[lonIndex]);
    const feederCode = values[feederCodeIndex]?.trim() || '';
    const ssCode = values[ssCodeIndex]?.trim() || '';

    // If SOURCE_LAT/SOURCE_LON are empty but LAT/LON exist, use LAT/LON as both source and destination
    // This handles rows where the source coordinates are missing
    const finalSourceLat = sourceLat !== null ? sourceLat : lat;
    const finalSourceLon = sourceLon !== null ? sourceLon : lon;

    if (
      finalSourceLat !== null &&
      finalSourceLon !== null &&
      lat !== null &&
      lon !== null &&
      feederCode !== '' &&
      ssCode !== ''
    ) {
      polylineData.push({
        sourceLat: finalSourceLat,
        sourceLon: finalSourceLon,
        lat,
        lon,
        feederCode,
        ssCode,
      });
    }
  }

  return polylineData;
};

/**
 * Load CSV file from a URL or file path
 * 
 * @param filePath - URL or path to CSV file
 * @returns Promise resolving to PolylineData array
 * @throws Error if file cannot be loaded
 */
export const loadCSVFromFile = async (filePath: string): Promise<PolylineData[]> => {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load CSV: ${response.statusText}`);
    }
    const csvContent = await response.text();
    return parseCSV(csvContent);
  } catch (error) {
    console.error('Error loading CSV file:', error);
    throw error;
  }
};

/**
 * Parse CSV from a File object (for file uploads)
 * 
 * @param file - File object from file input
 * @returns Promise resolving to PolylineData array
 */
export const parseCSVFromFile = async (file: File): Promise<PolylineData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const csvContent = e.target?.result as string;
        const data = await parseCSV(csvContent);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
};
