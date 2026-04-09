import React, { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import BACKEND_URL from '../config';
import { getStoredToken } from '../config/auth';

const Page = lazy(() => import('SuperAdmin/Page'));

const formatDateForApi = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
};

// Helper to make authenticated API requests
const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getStoredToken();
  if (!token) {
    throw new Error('Authentication required. Please login again.');
  }
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers, credentials: 'include' });
  if (response.status === 401) {
    throw new Error('Your session has expired. Please login again.');
  }
  return response;
};

// Helper to safely get field value (supports snake_case and camelCase)
const getFieldValue = (item: any, fieldNames: string[]): number => {
  if (!item || typeof item !== 'object') return 0;
  for (const fieldName of fieldNames) {
    const value = item[fieldName];
    if (value !== undefined && value !== null && value !== '') {
      const parsed = parseFloat(value);
      return !isNaN(parsed) ? parsed : 0;
    }
  }
  return 0;
};

// Object lookup: metric → series config (replaces switch, O(1) lookup, easy to extend)
const METRIC_SERIES_CONFIG: Record<
  string,
  Array<{ name: string; fields: string[]; color?: string }>
> = {
  'kVA Import': [{ name: 'kVA Import', fields: ['kva', 'kVA'], color: '#163b7c' }],
  'kW Import': [{ name: 'kW Import', fields: ['kw', 'kW'], color: '#029447' }],
  Voltage: [
    { name: 'R-Phase Voltage', fields: ['voltage_r', 'voltageR'], color: '#dc272c' },
    { name: 'Y-Phase Voltage', fields: ['voltage_y', 'voltageY'], color: '#ed8c22' },
    { name: 'B-Phase Voltage', fields: ['voltage_b', 'voltageB'], color: '#163b7c' },
  ],
  Current: [
    { name: 'R-Phase Current', fields: ['current_r', 'currentR'], color: '#dc272c' },
    { name: 'Y-Phase Current', fields: ['current_y', 'currentY'], color: '#ed8c22' },
    { name: 'B-Phase Current', fields: ['current_b', 'currentB'], color: '#163b7c' },
  ],
};

const DEFAULT_SERIES_FALLBACK = [{ name: 'Data', fields: ['kva', 'kVA', 'kw', 'kW'] }];

const extractTimeFromBlockTime = (blockTime: string): string => {
  if (!blockTime || typeof blockTime !== 'string') return '';
  try {
    // Extract time directly from string format: "2026-01-23T10:30:00.000Z"
    // Remove date, "T", "Z", and milliseconds, show only HH:MM (e.g., "10:30")
    // This ensures x-axis shows exact same time as modal/tooltip
    const timeMatch = blockTime.match(/T(\d{2}):(\d{2}):/);
    if (timeMatch && timeMatch[1] && timeMatch[2]) {
      const hours = timeMatch[1];
      const minutes = timeMatch[2];
      return `${hours}:${minutes}`;
    }
    // Fallback: try to extract if format is slightly different
    const altMatch = blockTime.match(/(\d{2}):(\d{2}):/);
    if (altMatch && altMatch[1] && altMatch[2]) {
      return `${altMatch[1]}:${altMatch[2]}`;
    }
    return '';
  } catch (error) {
    console.error('Error extracting time from block_time:', blockTime, error);
    return '';
  }
};

// Convert time string (HH:MM) to minutes since midnight for comparison
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(':')) return -1;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return -1;
  return hours * 60 + minutes;
};

// Convert minutes since midnight to time string (HH:MM)
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// Generate time range from start time to end time (or 00:00 to 24:00)
// const generateTimeRange = (startTime: string, endTime: string): string[] => {
//   const startMinutes = timeToMinutes(startTime);
//   const endMinutes = timeToMinutes(endTime);
  
//   if (startMinutes === -1 || endMinutes === -1) {
//     // Fallback: generate full 24-hour range
//     const times: string[] = [];
//     for (let i = 0; i <= 24 * 60; i += 15) { // 15-minute intervals
//       if (i === 24 * 60) {
//         times.push('24:00');
//       } else {
//         times.push(minutesToTime(i));
//       }
//     }
//     return times;
//   }
  
//   // Generate from start time to end time (or extend to 24:00)
//   const times: string[] = [];
//   const maxMinutes = Math.max(endMinutes, 24 * 60);
  
//   for (let i = startMinutes; i <= maxMinutes; i += 15) { // 15-minute intervals
//     if (i === 24 * 60) {
//       times.push('24:00');
//     } else if (i <= 24 * 60) {
//       times.push(minutesToTime(i));
//     }
//   }
  
//   return times;
// };

// Map data values to time positions
// const mapDataToTimeRange = (
//   rawData: any[],
//   timeRange: string[],
//   getValue: (item: any) => number
// ): (number | undefined)[] => {
//   // Create a map of time -> value from raw data
//   // Also store the original time in minutes for better matching
//   const timeValueMap = new Map<string, number>();
//   const timeMinutesMap = new Map<number, number>(); // minutes -> value for flexible matching
  
//   rawData.forEach((item) => {
//     const time = extractTimeFromBlockTime(item.block_time || '');
//     if (time) {
//       const value = getValue(item);
//       const minutes = timeToMinutes(time);
//       timeValueMap.set(time, value);
//       if (minutes !== -1) {
//         timeMinutesMap.set(minutes, value);
//       }
//     }
//   });
  
//   // Map values to time range, using undefined for missing times (better for chart rendering)
//   return timeRange.map((time) => {
//     // Try exact match first
//     if (timeValueMap.has(time)) {
//       return timeValueMap.get(time)!;
//     }
    
//     // Try to find closest time (within 15 minutes for better matching)
//     let closestMinutes: number | null = null;
//     let minDiff = Infinity;
//     const targetMinutes = timeToMinutes(time);
    
//     if (targetMinutes !== -1) {
//       timeMinutesMap.forEach((_, dataMinutes) => {
//         const diff = Math.abs(dataMinutes - targetMinutes);
//         // Increase tolerance to 15 minutes to catch more data points
//         if (diff < minDiff && diff <= 15) {
//           minDiff = diff;
//           closestMinutes = dataMinutes;
//         }
//       });
//     }
    
//     return closestMinutes !== null ? timeMinutesMap.get(closestMinutes)! : undefined;
//   });
// };

type LsMetric = 'kW Import' | 'kVA Import' | 'Voltage' | 'Current' | 'Neutral Current';

const X_AXIS_LABELS: Record<LsMetric, string> = {
  'kW Import': 'kW',  
  'kVA Import': 'kVA',
  Voltage: 'Volts (V)',
  Current: 'Amps (A)',
  'Neutral Current': 'Neutral Amps (A)',
};

const DEFAULT_SERIES_COLORS = ['#163b7c', '#55b56c', '#dc272c', '#ed8c22'] as const;
const LS_METRICS: LsMetric[] = ['Current','kW Import', 'kVA Import', 'Voltage', ];

const LSDataIndividual    : React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const [freezeSearch, setFreezeSearch] = useState<boolean>(false);
  const [selectedMeterId, setSelectedMeterId] = useState<number | null>(null);

  const [isLsDataLoading, setIsLsDataLoading] = useState(false);
  const [lsDataRawData, setLsDataRawData] = useState<any[]>([]);
  const [lsSelectedMetric, setLsSelectedMetric] = useState<LsMetric>('Current');
  const [searchValue, setSearchValue] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Navigation state for day navigation
  const [currentDayIndex, setCurrentDayIndex] = useState(0); // 0 = today, 1 = yesterday, etc.
  const [dayDataMap, setDayDataMap] = useState<Map<number, any[]>>(new Map()); // Store data for multiple days
  const currentDayIndexRef = useRef(0); // Ref to track current day index for use in fetchLsData

  // Generate x-axis time range always from 00:00 to 24:00
  // Use actual data times for the chart, but ensure full range is available
  const getXAxisData = (): string[] => {
    if (lsDataRawData.length === 0) return [];
    
    // Use actual times from data - this ensures exact matching
    const actualTimes = lsDataRawData
      .map((item: any) => extractTimeFromBlockTime(item.block_time || ''))
      .filter((time: string) => time !== '');
    
    if (actualTimes.length === 0) return [];
    
    // Generate full 24-hour range from 00:00 to 24:00 with 30-minute intervals
    // This matches the typical data interval pattern (30 minutes)
    const times: string[] = [];
    for (let i = 0; i <= 24 * 60; i += 30) { // 30-minute intervals
      if (i === 24 * 60) {
        times.push('24:00');
      } else {
        times.push(minutesToTime(i));
      }
    }
    
    return times;
  };
  
  const xAxisData = getXAxisData();
  
  // Debug: Log x-axis data to verify extraction
  useEffect(() => {
    if (xAxisData.length > 0 && lsDataRawData.length > 0) {
      const actualTimes = lsDataRawData
        .map((item: any) => extractTimeFromBlockTime(item.block_time || ''))
        .filter((time: string) => time !== '');
      console.log('X-axis range:', xAxisData[0], 'to', xAxisData[xAxisData.length - 1]);
      console.log('Actual data times (first 3):', actualTimes.slice(0, 3));
      console.log('Actual data times (last 3):', actualTimes.slice(-3));
    }
  }, [xAxisData, lsDataRawData]);
  
  // Get series data and map to time range
  // Map data values to the x-axis time positions
  const getSeriesDataForTimeRange = (): Array<{ name: string; data: (number | null)[]; color?: string }> => {
    if (lsDataRawData.length === 0 || xAxisData.length === 0) return [];
    
    const config = METRIC_SERIES_CONFIG[lsSelectedMetric] ?? DEFAULT_SERIES_FALLBACK;
    
    // Create a map of time -> values from raw data
    const timeValueMap = new Map<string, number>();
    lsDataRawData.forEach((item: any) => {
      const time = extractTimeFromBlockTime(item.block_time || '');
      if (time) {
        // Store the time in minutes for flexible matching
        const minutes = timeToMinutes(time);
        if (minutes !== -1) {
          // We'll map by series later
          timeValueMap.set(time, minutes);
        }
      }
    });
    
    return config.map(({ name, fields, color }) => {
      // Create value map for this series
      const seriesValueMap = new Map<string, number>();
      lsDataRawData.forEach((item: any) => {
        const time = extractTimeFromBlockTime(item.block_time || '');
        if (time) {
          const value = getFieldValue(item, fields);
          seriesValueMap.set(time, value);
        }
      });
      
      // Map values to x-axis positions
      const mappedData = xAxisData.map((time) => {
        // Try exact match first
        if (seriesValueMap.has(time)) {
          return seriesValueMap.get(time)!;
        }
        
        // Try to find closest time (within 15 minutes for 30-min interval data)
        let closestTime: string | null = null;
        let minDiff = Infinity;
        const targetMinutes = timeToMinutes(time);
        
        if (targetMinutes !== -1) {
          seriesValueMap.forEach((_, dataTime) => {
            const dataMinutes = timeToMinutes(dataTime);
            if (dataMinutes !== -1) {
              const diff = Math.abs(dataMinutes - targetMinutes);
              // Use 15-minute tolerance (half of 30-minute interval)
              if (diff < minDiff && diff <= 15) {
                minDiff = diff;
                closestTime = dataTime;
              }
            }
          });
        }
        
        if (closestTime && seriesValueMap.has(closestTime)) {
          return seriesValueMap.get(closestTime)!;
        }
        
        // Use null for missing data points - chart should skip these for line continuity
        return null;
      });
      
      return {
        name,
        data: mappedData,
        ...(color != null && { color }),
      };
    });
  };
  
  const seriesDataKva = getSeriesDataForTimeRange();
  
  // Calculate max value from all series and round up for y-axis
  const calculateYAxisMax = () => {
    if (seriesDataKva.length === 0) return undefined;
    let maxValue = 0;
    seriesDataKva.forEach((series) => {
      const validValues = series.data.filter((v): v is number => v !== undefined && v !== null && !isNaN(v) && v > 0);
      if (validValues.length > 0) {
        const seriesMax = Math.max(...validValues);
        if (seriesMax > maxValue) {
          maxValue = seriesMax;
        }
      }
    });
    // Round up to nearest integer
    return maxValue > 0 ? Math.ceil(maxValue) : undefined;
  };
  
  const yAxisMax = calculateYAxisMax();
  
  // Format y-axis labels as integers (no decimals)
  const formatYAxisLabel = (value: number) => {
    return Math.ceil(value).toString();
  };
  
  // Debug: Log data to verify it's being processed
  useEffect(() => {
    if (lsDataRawData.length > 0) {
      seriesDataKva.forEach((series, idx) => {
        console.log(`Series ${idx} (${series.name}):`, {
          dataPoints: series.data.length,
          firstValue: series.data[0],
          lastValue: series.data[series.data.length - 1],
          hasData: series.data.some(v => v !== 0 && v !== null && v !== undefined)
        });
      });
    }
  }, [lsDataRawData, xAxisData, seriesDataKva]);
  // const seriesDataKwh = getSeriesDataForMetric(lsDataRawData, lsSelectedMetricKwh);

  const fetchLsData = useCallback(async (meterId: number, dayOffset: number = 0) => {
    if (!meterId) {
      setLsDataRawData([]);
      return;
    }
    setIsLsDataLoading(true);
    try {
      // Calculate date based on day offset (0 = today, 1 = yesterday, etc.)
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - dayOffset);
      const dateStr = formatDateForApi(targetDate);
      const endpoint = `${BACKEND_URL}/lsdata/consumption?meterId=${meterId}&startDate=${dateStr}&endDate=${dateStr}`;
      
      // Debug: Log endpoint and date information
      console.log('🔍 [Navigation Debug] Fetching LS Data:', {
        meterId,
        dayOffset,
        targetDate: targetDate.toISOString(),
        dateStr,
        endpoint,
        currentDayIndex,
      });
      
      const response = await authenticatedFetch(endpoint);
      
      console.log('📥 [Navigation Debug] API Response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      
      console.log('📦 [Navigation Debug] API Response Data:', {
        hasData: !!result.data,
        dataIsArray: Array.isArray(result.data),
        dataLength: Array.isArray(result.data) ? result.data.length : 0,
        firstDataPoint: Array.isArray(result.data) && result.data.length > 0 ? {
          block_time: result.data[0].block_time,
          date: result.data[0].block_time ? result.data[0].block_time.split('T')[0] : 'N/A',
        } : null,
      });
      
      // Directly extract data array
      const dataArray = Array.isArray(result.data) ? result.data : [];
      

      // Sort data by block_time to ensure proper chronological order
      const sortedData = [...dataArray].sort((a, b) => {
        const timeA = new Date(a.block_time || a.timestamp || 0).getTime();
        const timeB = new Date(b.block_time || b.timestamp || 0).getTime();
        return timeA - timeB;
      });
      
      // Store data in map for navigation
      setDayDataMap(prev => {
        const newMap = new Map(prev);
        newMap.set(dayOffset, sortedData);
        console.log('💾 [Navigation Debug] Stored data in map:', {
          dayOffset,
          dataPoints: sortedData.length,
          mapSize: newMap.size,
          mapKeys: Array.from(newMap.keys()),
          currentDayIndex: currentDayIndexRef.current,
        });
        
        // Update displayed data if this is the current day being viewed
        if (dayOffset === currentDayIndexRef.current) {
          console.log('✅ [Navigation Debug] Updating displayed data (fetch completed for current day)');
          setLsDataRawData(sortedData);
        }
        
        return newMap;
      });
    } catch (error: any) {
      console.error('Error fetching LS data:', error);
      // Don't update displayed data here either
    } finally {
      setIsLsDataLoading(false);
    }
  }, []); // Remove currentDayIndex from dependencies to prevent recreation

  // Fetch LS data for an explicit date string (dd/MM/yyyy)
  const fetchLsDataForDate = useCallback(async (meterId: number, dateStr: string) => {
    if (!meterId || !dateStr) return;
    setIsLsDataLoading(true);
    try {
      const endpoint = `${BACKEND_URL}/lsdata/consumption?meterId=${meterId}&startDate=${dateStr}&endDate=${dateStr}`;
      const response = await authenticatedFetch(endpoint);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      const dataArray = Array.isArray(result.data) ? result.data : [];
      const sortedData = [...dataArray].sort((a, b) => {
        const timeA = new Date(a.block_time || a.timestamp || 0).getTime();
        const timeB = new Date(b.block_time || b.timestamp || 0).getTime();
        return timeA - timeB;
      });

      // store and display
      setDayDataMap(prev => {
        const newMap = new Map(prev);
        // use 0 index for currently displayed date (keeps navigation intact)
        newMap.set(0, sortedData);
        return newMap;
      });
      setLsDataRawData(sortedData);
    } catch (error: any) {
      console.error('Error fetching LS data for date:', dateStr, error);
    } finally {
      setIsLsDataLoading(false);
    }
  }, []);

  // Initialize search value from URL params on mount (optional, for backward compatibility)
  useEffect(() => {
    const meterSerialFromUrl = searchParams.get('meterSerialNumber');
    const meterIdFromUrl = searchParams.get('meterId');
    const startDateFromUrl = searchParams.get('startDate');
    const endDateFromUrl = searchParams.get('endDate');
    // handle route param /lsdata-individual/:id
    const idFromRoute = (params as any)?.id ?? (params as any)?.meterId; // fallback for older route param name
    if (idFromRoute) {
      const parsed = parseInt(String(idFromRoute), 10);
      if (!isNaN(parsed) && parsed > 0) {
        setSelectedMeterId(parsed);
        setSearchValue(String(parsed));
        setFreezeSearch(true);
        // Prefer explicit start/end dates if provided; otherwise fall back to ?date or today
        const dateQuery =
          startDateFromUrl ||
          endDateFromUrl ||
          searchParams.get('date') ||
          (searchParams.get('block_time')
            ? searchParams.get('block_time')!.split('T')[0]
            : null);
        if (dateQuery) {
          fetchLsDataForDate(parsed, dateQuery);
        } else {
          const t = new Date();
          const todayStr = formatDateForApi(t);
          fetchLsDataForDate(parsed, todayStr);
        }
      }
    } else if (meterSerialFromUrl) {
      setSearchValue(meterSerialFromUrl);
    } else if (meterIdFromUrl) {
      setSearchValue(meterIdFromUrl);
      const parsedMeterId = parseInt(meterIdFromUrl, 10);
      if (!isNaN(parsedMeterId) && parsedMeterId > 0) {
        setSelectedMeterId(parsedMeterId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch data when selectedMeterId changes - fetch for multiple days (last 7 days)
  useEffect(() => {
    if (selectedMeterId) {
      console.log('🔄 [Navigation Debug] Meter ID changed, fetching data for 7 days');
      // Fetch data for last 7 days
      for (let i = 0; i < 7; i++) {
        fetchLsData(selectedMeterId, i);
      }
      // Reset day index to 0 (today) when meter changes
      setCurrentDayIndex(0);
    } else {
      setLsDataRawData([]);
      setDayDataMap(new Map());
    }
  }, [selectedMeterId]); // Remove fetchLsData from dependencies since it's now stable

  // Update ref when currentDayIndex changes
  useEffect(() => {
    currentDayIndexRef.current = currentDayIndex;
  }, [currentDayIndex]);

  // Update displayed data when day index changes - single effect to prevent double fetches
  useEffect(() => {
    if (!selectedMeterId) {
      return;
    }
    
    console.log('🔄 [Navigation Debug] Day index changed, checking data:', {
      currentDayIndex,
      selectedMeterId,
      hasDataInMap: dayDataMap.has(currentDayIndex),
      mapKeys: Array.from(dayDataMap.keys()),
    });
    
    // Check if data exists in map
    const dayData = dayDataMap.get(currentDayIndex);
    if (dayData && Array.isArray(dayData) && dayData.length > 0) {
      console.log('✅ [Navigation Debug] Using cached data for day index:', currentDayIndex, 'Data points:', dayData.length);
      setLsDataRawData(dayData);
    } else {
      // Only fetch if data doesn't exist in map
      console.log('📡 [Navigation Debug] Data not in cache, fetching for day index:', currentDayIndex);
      fetchLsData(selectedMeterId, currentDayIndex);
    }
  }, [currentDayIndex, selectedMeterId]); // Only watch currentDayIndex and selectedMeterId - NOT dayDataMap to prevent double triggers

  // Navigation handlers
  const handleNavigateLeft = () => {
    console.log('⬅️ [Navigation Debug] Left arrow clicked. Current index:', currentDayIndex);
    if (currentDayIndex < 6) { // Allow navigation up to 6 days back
      const newIndex = currentDayIndex + 1;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - newIndex);
      const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      console.log('⬅️ [Navigation Debug] Navigating to previous day:', {
        fromIndex: currentDayIndex,
        toIndex: newIndex,
        targetDate: dateStr,
        dateISO: targetDate.toISOString(),
      });
      setCurrentDayIndex(newIndex);
    } else {
      console.log('⬅️ [Navigation Debug] Cannot navigate left - already at max (6 days back)');
    }
  };

  const handleNavigateRight = () => {
    console.log('➡️ [Navigation Debug] Right arrow clicked. Current index:', currentDayIndex);
    if (currentDayIndex > 0) {
      const newIndex = currentDayIndex - 1;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - newIndex);
      const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      console.log('➡️ [Navigation Debug] Navigating to next day:', {
        fromIndex: currentDayIndex,
        toIndex: newIndex,
        targetDate: dateStr,
        dateISO: targetDate.toISOString(),
      });
      setCurrentDayIndex(newIndex);
    } else {
      console.log('➡️ [Navigation Debug] Cannot navigate right - already at today (index 0)');
    }
  };

  // Get current date label for navigation
  const getCurrentDateLabel = () => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - currentDayIndex);
    const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    return dateStr;
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Search for meters/DTRs with suggestions
  const searchMeters = async (query: string, limit: number = 10) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const trimmedQuery = query.trim();
      
      // First try DTR search for suggestions
      const fullUrl = `${BACKEND_URL}/dtrs/search?q=${encodeURIComponent(trimmedQuery)}&limit=${limit}`;
      const response = await fetch(fullUrl, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const result = await response.json();
        let dataArray: any[] = [];

        if (Array.isArray(result)) {
          dataArray = result;
        } else if (result?.status === 'success' && Array.isArray(result.data)) {
          dataArray = result.data;
        } else if (Array.isArray(result?.data)) {
          dataArray = result.data;
        } else if (result?.success && Array.isArray(result.data)) {
          dataArray = result.data;
        }

        if (dataArray.length > 0) {
          const mappedResults = dataArray.map((item: any, index: number) => {
            const dtrNum = item.dtrNumber || 'N/A';
            const meterNum = item.meter?.meterNumber || 'N/A';
            return {
              id: String(item.id || `dtr-${index}`),
              dtrNumber: item.dtrNumber,
              serialNumber: item.serialNumber,
              meterId: item.meter?.meterId, // Use meter.meterId only, don't fallback to item.id
              meterNumber: item.meter?.meterNumber,
              UID: item.dtrNumber || item.meter?.meterNumber || item.serialNumber || String(item.id || ''),
              UnitName: `${dtrNum} • ${meterNum}`,
              name: `${dtrNum} • ${meterNum} • ${item.location || 'N/A'}`,
              location: item.location,
              locationId: item.locationId,
            };
          });
          setSearchResults(mappedResults);
        } else {
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    } catch (error: any) {
      console.error('Search error:', error);
      setSearchResults([]);
    } 
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    // Search with debouncing (minimum 2 characters)
    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchMeters(value, 10);
      }, 300);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handleSearchResultClick = (result: any) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    // Display both dtrNumber and meterNumber
    const dtrNum = result.dtrNumber || 'N/A';
    const meterNum = result.meterNumber || 'N/A';
    const displayValue = `${dtrNum} • ${meterNum}`;
    setSearchValue(displayValue);
    setSearchResults([]);
    setIsSearching(false);

    // Use meter.meterId from the result to fetch data directly (no navigation)
    const meterId = result.meterId;
    if (meterId) {
      const parsedMeterId = parseInt(String(meterId), 10);
      if (!isNaN(parsedMeterId) && parsedMeterId > 0) {
        setSelectedMeterId(parsedMeterId);
        return;
      }
    }
  };

  const handleGlobalSearch = async (query?: string) => {
    // If there's already a selected meterId, just refetch the data
    if (selectedMeterId) {
      fetchLsData(selectedMeterId);
      return;
    }
    
    const searchQuery = query || searchValue.trim();
    if (!searchQuery || searchQuery.trim().length === 0) {
      return;
    }
    
    const trimmedQuery = searchQuery.trim();
    
    // Check if the query is a numeric meter ID
    const meterId = parseInt(trimmedQuery, 10);
    if (!isNaN(meterId) && meterId > 0) {
      // Set the meter ID directly (no navigation)
      setSelectedMeterId(meterId);
      setSearchValue(trimmedQuery);
      setSearchResults([]);
      return;
    }
    
    // If not a numeric meter ID, try DTR search
    if (trimmedQuery.length < 2) {
      return;
    }
    
    try {
      const fullUrl = `${BACKEND_URL}/dtrs/search?q=${encodeURIComponent(trimmedQuery)}`;
      const response = await fetch(fullUrl, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const result = await response.json();
        if ((result.status === "success" || result.success) && result.data && result.data.length > 0) {
          const firstResult = result.data[0];
          // Use the first result's meterId to fetch data directly (no navigation)
          if (firstResult.meter?.meterId) {
            const parsedMeterId = parseInt(String(firstResult.meter.meterId), 10);
            if (!isNaN(parsedMeterId) && parsedMeterId > 0) {
              setSelectedMeterId(parsedMeterId);
              const dtrNum = firstResult.dtrNumber || 'N/A';
              const meterNum = firstResult.meter?.meterNumber || 'N/A';
              setSearchValue(`${dtrNum} • ${meterNum}`);
              setSearchResults([]);
              return;
            }
          }
        }
      }
      // No results
      alert(
        `No results found for "${trimmedQuery}". Please check your search term.`
      );
    } catch (error) {
      alert(`Search failed. Please try again.`);
    }
  };


  
  return (
  
      <Suspense fallback={<div className="flex items-center justify-center min-h-[200px]">Loading...</div>}>
        <Page
          sections={[
            {
              layout: { type: 'grid' as const, columns: 1, className: '' },
              components: [
                {
                  name: 'PageHeader',
                  props: {
                    title: 'LS Data',
                    onBackClick: () => navigate('/dtr-dashboard'),
                    backButtonText: 'Back to Dashboard',

                  },
                },
              ],
            },
            {
              layout: {
                type: 'grid' as const,
                columns: 2,
                gap: 'gap-4',
                className: 'w-full border border-primary-border dark:border-dark-border rounded-lg p-4 bg-background-secondary dark:bg-primary-dark-light',
                rows: [
                  {
                    layout: 'row',
                    columns: [
                      {
                        name: 'PageHeader',
                        props: {
                          title: 'Search Meter Load Survey Data',
                          titleClassName: 'text-md font-semibold text-text-primary dark:text-white m-0',
                        },
                      },
                    ],
                    span: { col: 1, row: 1 },
                  },
                  {
                    layout: 'row',
                    columns: [
                      {
                        name: 'Search',
                        props: {
                          placeholder: 'Enter meter ID or serial number',
                          value: searchValue,
                          onChange: handleSearchChange,
                          results: searchResults,
                          isLoading: isSearching,
                          onResultClick: handleSearchResultClick,
                          showShortcut: false,
                          className: 'max-w-md',
                          disabled: freezeSearch,
                        },
                      },
                      {
                        name: 'Button',
                        props: {
                          label: 'Search',
                          variant: 'primary',
                          onClick: () => handleGlobalSearch(),
                          disabled: !searchValue.trim(),
                        },
                      },
                    ],
                    span: { col: 2, row: 1 },
                  },
                ],
              },
            },
            {
              layout: {
                type: 'column' as const,
                gap: 'gap-4',
                rows: [
                  // {
                  //   layout: 'row' as const,
                  //   gap: 'gap-4',
                  //   className:'w-full justify-between',
                  //   columns: [
                  //     {
                  //       name: 'Search',
                  //       props: {
                  //         placeholder: 'Search by Meter ID',
                  //         colSpan:2,
                  //         onSearch: handleGlobalSearch,
                  //        className: 'max-w-md',
                  //       },
                  //     },
                  //     {
                  //       name: 'Button',
                  //       props: {
                  //        label:"Export Data",

                  //        className: 'max-w-md',
                  //       },
                  //     },
                  //     // {
                  //     //   name: 'TimeRangeSelector',
                  //     //   props: {
                  //     //     availableTimeRanges: LS_METRICS,
                  //     //     selectedTimeRange: lsSelectedMetric,
                  //     //     handleTimeRangeChange: (range: string) => setLsSelectedMetric(range as LsMetric),
                  //     //     className: 'w-fit bg-background-secondary',

                  //     //   },
                  //     // },
                  //   ],
                  // },
                  {
                    layout: 'grid' as const,
                    gridColumns: 1,
                    columns: [
                      {
                        name: 'LineChart',
                        key: `kva-${lsSelectedMetric}`,
                        props: {
                          data: lsDataRawData || [],
                          xAxisData,
                          seriesData: seriesDataKva,
                          availableTimeRanges: LS_METRICS,
                          initialTimeRange: lsSelectedMetric,
                          seriesColors: seriesDataKva.map((s) => s.color ?? DEFAULT_SERIES_COLORS[0]),
                          onTimeRangeChange: (range: string) => {
                            setLsSelectedMetric(range as LsMetric);
                          },
                          height: '400px',
                          showHeader: true,
                          showDownloadButton: true,
                          showLegend: true,
                          headerTitle: `Daily ${lsSelectedMetric} Metrics (${getCurrentDateLabel()})`,
                          isLoading: isLsDataLoading,
                          showXAxisLabel: true,
                          xAxisLabel: X_AXIS_LABELS[lsSelectedMetric] ?? 'kVA',
                          showTooltip: true,
                          showTooltipTimestamp: true,
                          smooth: true,
                          yAxisMax: yAxisMax,
                          yAxisFormatter: formatYAxisLabel,
                          // Navigation arrows props
                          showNavigationArrows: true,
                          onNavigateLeft: handleNavigateLeft,
                          onNavigateRight: handleNavigateRight,
                          disableLeftArrow: currentDayIndex >= 6,
                          disableRightArrow: currentDayIndex === 0,
                        },
                      },
                    ],
                  },
                  
                ],
              },
            },
            // Daily kWh Consumption: own Dropdown + LineChart (no availableTimeRanges so chart does not derive/merge series)
          ]}
        />
      </Suspense>

  );
};

export default LSDataIndividual;