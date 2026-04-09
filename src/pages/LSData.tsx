import React, { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BACKEND_URL from '../config';

const Page = lazy(() => import('SuperAdmin/Page'));

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

const parseBlockTimeToEpoch = (blockTime: string): number => {
  if (!blockTime || typeof blockTime !== 'string') return NaN;
  try {
    const ddmmyyyyMatch = blockTime.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})/);
    if (ddmmyyyyMatch) {
      const [, day, month, year, hour, min, sec] = ddmmyyyyMatch;
      const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min), Number(sec || 0));
      return d.getTime();
    }
    const t = new Date(blockTime).getTime();
    return Number.isFinite(t) ? t : NaN;
  } catch {
    return NaN;
  }
};

const extractTimeFromBlockTime = (blockTime: string): string => {
  if (!blockTime || typeof blockTime !== 'string') return '';
  try {
    const afterComma = blockTime.includes(',') ? blockTime.split(',')[1]?.trim() : '';
    if (afterComma) {
      const timeMatch = afterComma.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (timeMatch && timeMatch[1] != null && timeMatch[2] != null) {
        const h = String(Number(timeMatch[1])).padStart(2, '0');
        const m = String(Number(timeMatch[2])).padStart(2, '0');
        return `${h}:${m}`;
      }
    }

    const isoMatch = blockTime.match(/T(\d{2}):(\d{2}):/);
    if (isoMatch && isoMatch[1] && isoMatch[2]) {
      return `${isoMatch[1]}:${isoMatch[2]}`;
    }

    const withSecondsMatch = blockTime.match(/(\d{2}):(\d{2}):/);
    if (withSecondsMatch && withSecondsMatch[1] && withSecondsMatch[2]) {
      return `${withSecondsMatch[1]}:${withSecondsMatch[2]}`;
    }

    const withoutSecondsMatch = blockTime.match(/(\d{2}):(\d{2})(?!:)/);
    if (withoutSecondsMatch && withoutSecondsMatch[1] && withoutSecondsMatch[2]) {
      return `${withoutSecondsMatch[1]}:${withoutSecondsMatch[2]}`;
    }

    return '';
  } catch (error) {
    console.error('Error extracting time from block_time:', blockTime, error);
    return '';
  }
};

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(':')) return -1;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return -1;
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const formatDateForApi = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
};

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

const LSData: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedMeterId, setSelectedMeterId] = useState<number | null>(null);

  const [isLsDataLoading, setIsLsDataLoading] = useState(false);
  const [lsDataRawData, setLsDataRawData] = useState<any[]>([]);
  const [lsSelectedMetric, setLsSelectedMetric] = useState<LsMetric>('Current');
  const [searchValue, setSearchValue] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);   
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [dayDataMap, setDayDataMap] = useState<Map<number, any[]>>(new Map());
  const currentDayIndexRef = useRef(0);
  const [viewAll, setViewAll] = useState<boolean>(false);
  const [dateToggleValue, setDateToggleValue] = useState<'today' | 'yesterday'>('today');
  const fetchingOffsetsRef = useRef<Set<number>>(new Set());
  const [tableRows, setTableRows] = useState<
    Array<{
      'S.No'?: number;
      date: string;
      kva?: number | null;
      kw?: number | null;
      voltage_r?: number | null;
      voltage_y?: number | null;
      voltage_b?: number | null;
      current_r?: number | null;
      current_y?: number | null;
      current_b?: number | null;
    }>
  >([]);

 
 
  

  
  
  
  const getXAxisData = (): string[] => {
    if (lsDataRawData.length === 0) return [];

    const actualTimes = lsDataRawData
      .map((item: any) => extractTimeFromBlockTime(item.block_time || ''))
      .filter((time: string) => time !== '');

    if (actualTimes.length === 0) return [];

    const times: string[] = [];
    for (let i = 0; i <= 24 * 60; i += 30) {
      if (i === 24 * 60) {
        times.push('24:00');
      } else {
        times.push(minutesToTime(i));
      }
    }

    return times;
  };

  const xAxisData = getXAxisData();
 
  const getSeriesDataForTimeRange = (): Array<{ name: string; data: (number | null)[]; color?: string }> => {
    if (lsDataRawData.length === 0 || xAxisData.length === 0) return [];
      
    const config = METRIC_SERIES_CONFIG[lsSelectedMetric] ?? DEFAULT_SERIES_FALLBACK;
    
    const timeValueMap = new Map<string, number>();
    lsDataRawData.forEach((item: any) => {
      const time = extractTimeFromBlockTime(item.block_time || '');
      if (time) {
        const minutes = timeToMinutes(time);
        if (minutes !== -1) {
          timeValueMap.set(time, minutes);
        }
      }
    });
    
    return config.map(({ name, fields, color }) => {
      const seriesValueMap = new Map<string, number>();
      lsDataRawData.forEach((item: any) => {
        const time = extractTimeFromBlockTime(item.block_time || '');
        if (time) {
          const value = getFieldValue(item, fields);
          seriesValueMap.set(time, value);
        }
      });
      
      const mappedData = xAxisData.map((time: string) => {
        if (seriesValueMap.has(time)) {
          return seriesValueMap.get(time)!;
        }
        
        let closestTime: string | null = null;
        let minDiff = Infinity;
        const targetMinutes = timeToMinutes(time);
        
        if (targetMinutes !== -1) {
          seriesValueMap.forEach((_, dataTime) => {
              const dataMinutes = timeToMinutes(dataTime);
              if (dataMinutes !== -1) {
                const diff = Math.abs(dataMinutes - targetMinutes);
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
    return maxValue > 0 ? Math.ceil(maxValue) : undefined;
  };
  
  const yAxisMax = calculateYAxisMax();
  
  const formatYAxisLabel = (value: number) => {
    return Math.ceil(value).toString();
  };
  
  const fetchLsData = useCallback(async (meterId: number, dayOffset: number = 0) => {
    if (!meterId) {
      setLsDataRawData([]);
      return;
    }
    if (fetchingOffsetsRef.current.has(dayOffset)) return;
    fetchingOffsetsRef.current.add(dayOffset);
    setIsLsDataLoading(true);
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - dayOffset);
      const dateStr = formatDateForApi(targetDate);

      const endpoint = `${BACKEND_URL}/lsdata/consumption?meterId=${meterId}&startDate=${dateStr}&endDate=${dateStr}`;
      console.log('LSData fetchLsData:', { meterId, dayOffset, dateStr, endpoint });
      const response = await fetch(endpoint, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        fetchingOffsetsRef.current.delete(dayOffset);
        setIsLsDataLoading(false);
        return;
      }
      const result = await response.json();
      const dataArray = Array.isArray(result.data) ? result.data : [];
      console.log('LSData fetchLsData result:', {
        meterId,
        dayOffset,
        dateStr,
        count: dataArray.length,
      });

      const sortedData = [...dataArray].sort((a, b) => {
        const timeA = parseBlockTimeToEpoch(a.block_time || a.timestamp || '') || new Date(a.block_time || 0).getTime();
        const timeB = parseBlockTimeToEpoch(b.block_time || b.timestamp || '') || new Date(b.block_time || 0).getTime();
        return timeA - timeB;
      });

      setDayDataMap(prev => {
        const newMap = new Map(prev);
        newMap.set(dayOffset, sortedData);
        if (dayOffset === currentDayIndexRef.current) {
          setLsDataRawData(sortedData);
        }
        return newMap;
      });
    } finally {
      fetchingOffsetsRef.current.delete(dayOffset);
      setIsLsDataLoading(false);
    }
  }, []);

  const fetchLsDataForDate = useCallback(async (meterId: number, dateStr: string) => {
    if (!meterId || !dateStr) return;
    const offset = 0;
    if (fetchingOffsetsRef.current.has(offset)) return;
    fetchingOffsetsRef.current.add(offset);
    setIsLsDataLoading(true);
    try {
      const endpoint = `${BACKEND_URL}/lsdata/consumption?meterId=${meterId}&startDate=${dateStr}&endDate=${dateStr}`;
      console.log('LSData fetchLsDataForDate:', { meterId, dateStr, endpoint });
      const response = await fetch(endpoint, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        fetchingOffsetsRef.current.delete(offset);
        setIsLsDataLoading(false);
        return;
      }
      const result = await response.json();
      const dataArray = Array.isArray(result.data) ? result.data : [];
      console.log('LSData fetchLsDataForDate result:', {
        meterId,
        dateStr,
        count: dataArray.length,
      });

      const sortedData = [...dataArray].sort((a, b) => {
        const timeA = parseBlockTimeToEpoch(a.block_time || a.timestamp || '') || new Date(a.block_time || 0).getTime();
        const timeB = parseBlockTimeToEpoch(b.block_time || b.timestamp || '') || new Date(b.block_time || 0).getTime();
        return timeA - timeB;
      });

      setDayDataMap(prev => {
        const newMap = new Map(prev);
        newMap.set(0, sortedData);
        return newMap;
      });
      setLsDataRawData(sortedData);
    } finally {
      fetchingOffsetsRef.current.delete(0);
      setIsLsDataLoading(false);
    }
  }, []);

  const fetchViewAllTable = useCallback(async (page = 1, limit = 10) => {
    setIsLsDataLoading(true);
    try {
      const rows = Array.from({ length: limit }).map((_, idx) => ({
        ['S.No']: (page - 1) * limit + idx + 1,
        date: formatDateForApi(new Date()),
        id: idx + 1,
        meterId: idx + 1,
        CIRCLE: 'CIRCLE-' + ((idx % 3) + 1),
        DIVISION: 'DIV-' + ((idx % 5) + 1),
        'SUB-DIVISION': 'SUB-DIV-' + ((idx % 4) + 1),
        SECTION: 'SEC-' + ((idx % 6) + 1),
        'Meter SI No': `MTR-${1000 + idx}`,
        'Consumer Name': `Consumer ${idx + 1}`,
        'USC No': `USC-${2000 + idx}`,
      }));

      setTableRows(rows);
    } finally {
      setIsLsDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewAll) {
      fetchViewAllTable(1, 10);
    }
  }, [viewAll, fetchViewAllTable]);

  useEffect(() => {
    if (!selectedMeterId) return;
    const targetDate = new Date();
    if (dateToggleValue === 'yesterday') {
      targetDate.setDate(targetDate.getDate() - 1);
    }
    const dateStr = formatDateForApi(targetDate);
    setCurrentDayIndex(dateToggleValue === 'yesterday' ? 1 : 0);
    fetchLsDataForDate(selectedMeterId, dateStr);
  }, [dateToggleValue, selectedMeterId, fetchLsDataForDate]);

  useEffect(() => {
    const meterSerialFromUrl = searchParams.get('meterSerialNumber');
    const meterIdFromUrl = searchParams.get('meterId');
    if (meterSerialFromUrl) {
      setSearchValue(meterSerialFromUrl);
    } else if (meterIdFromUrl) {
      setSearchValue(meterIdFromUrl);
      const parsedMeterId = parseInt(meterIdFromUrl, 10);
      if (!isNaN(parsedMeterId) && parsedMeterId > 0) {
        setSelectedMeterId(parsedMeterId);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedMeterId) {
      const today = new Date();
      const todayStr = formatDateForApi(today);
      fetchLsDataForDate(selectedMeterId, todayStr);
      setCurrentDayIndex(0);
    } else {
      setLsDataRawData([]);
      setDayDataMap(new Map());
    }
  }, [selectedMeterId]);

  useEffect(() => {
    currentDayIndexRef.current = currentDayIndex;
  }, [currentDayIndex]);

  useEffect(() => {
    const dataForDay = dayDataMap.get(currentDayIndex) ?? lsDataRawData ?? [];

    const getDateStringFromItem = (item: any) => {
      if (!item) return getCurrentDateLabel();
      if (item.block_time && typeof item.block_time === 'string') {
        return item.block_time.split('T')[0];
      }
      if (item.timestamp) {
        try {
          return new Date(item.timestamp).toISOString().split('T')[0];
        } catch {
          return getCurrentDateLabel();
        }
      }
      return getCurrentDateLabel();
    };

    const rows = Array.isArray(dataForDay)
      ? dataForDay.map((item: any, idx: number) => ({
          ['S.No']: idx + 1,
          date: getDateStringFromItem(item),
          block_time: item.block_time || item.timestamp || '',
          kva: item.kva ?? null,
          kw: item.kw ?? null,
          voltage_r: item.voltage_r ?? item.voltageR ?? null,
          voltage_y: item.voltage_y ?? item.voltageY ?? null,
          voltage_b: item.voltage_b ?? item.voltageB ?? null,
          current_r: item.current_r ?? item.currentR ?? null,
          current_y: item.current_y ?? item.currentY ?? null,
          current_b: item.current_b ?? item.currentB ?? null,
        }))
      : [];

    setTableRows(rows);
  }, [dayDataMap, lsDataRawData, lsSelectedMetric, currentDayIndex]);

  useEffect(() => {
    if (!selectedMeterId) {
      return;
    }
    const dayData = dayDataMap.get(currentDayIndex);
    if (dayData && Array.isArray(dayData) && dayData.length > 0) {
      setLsDataRawData(dayData);
    } else {
      fetchLsData(selectedMeterId, currentDayIndex);
    }
  }, [currentDayIndex, selectedMeterId]);

  const getCurrentDateLabel = () => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - currentDayIndex);
    return formatDateForApi(targetDate);
  };

  const handleNavigateLeft = () => {
    if (currentDayIndex < 6) {
      setCurrentDayIndex((prev) => {
        const next = prev + 1;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - next);
        const dateStr = formatDateForApi(targetDate);
        console.log('LSData navigate left to dayOffset:', next, 'date:', dateStr);
        return next;
      });
    }
  };

  const handleNavigateRight = () => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex((prev) => {
        const next = prev - 1;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - next);
        const dateStr = formatDateForApi(targetDate);
        console.log('LSData navigate right to dayOffset:', next, 'date:', dateStr);
        return next;
      });
    }
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const searchMeters = async (query: string, limit: number = 10) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const trimmedQuery = query.trim();
      const fullUrl = `${BACKEND_URL}/consumers/search?query=${encodeURIComponent(
        trimmedQuery
      )}&limit=${limit}`;

      const response = await fetch(fullUrl, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        setSearchResults([]);
        return;
      }

      const result = await response.json();
      if (!(result && result.success && Array.isArray(result.data) && result.data.length > 0)) {
        setSearchResults([]);
        return;
      }

      const mappedResults = result.data.map((item: any, index: number) => {
        const consumerNumber = item.consumerNumber || 'N/A';
        const meterNumber = item.meterNumber || 'N/A';

        return {
          id: `consumer-${index}`,
          name: `${consumerNumber} • ${meterNumber}`,
          consumerNumber,
          meterNumber,
          uid: item.uid || consumerNumber,
          meterId: item.meterId || item.meter?.meterId || null,
          _originalData: item,
        };
      });

      setSearchResults(mappedResults);
    } catch (error: any) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

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

    const displayValue =
      result.name ||
      `${result.consumerNumber || 'N/A'} • ${result.meterNumber || 'N/A'}`;
    setSearchValue(displayValue);
    setSearchResults([]);
    setIsSearching(false);

    const meterId = result.meterId;
    if (meterId) {
      const parsedMeterId = parseInt(String(meterId), 10);
      if (!isNaN(parsedMeterId) && parsedMeterId > 0) {
        setSelectedMeterId(parsedMeterId);
        setViewAll(false);
        setDateToggleValue('today');
        setCurrentDayIndex(0);
        return;
      }
    }
  };

  const handleGlobalSearch = async (query?: string) => {
    const searchQuery = (query || searchValue).trim();
    if (!searchQuery || searchQuery.length < 2) return;

    try {
      const fullUrl = `${BACKEND_URL}/consumers/search?query=${encodeURIComponent(
        searchQuery
      )}`;
      const response = await fetch(fullUrl, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        alert(
          `No results found for "${searchQuery}". Please check your search term.`
        );
        return;
      }

      const result = await response.json();
      if (!(result && result.success && Array.isArray(result.data) && result.data.length > 0)) {
        alert(
          `No results found for "${searchQuery}". Please check your search term.`
        );
        return;
      }

      const first = result.data[0];
      const meterId = first.meterId || first.meter?.meterId;
      const consumerNumber = first.consumerNumber || '';
      const meterNumber = first.meterNumber || first.meter?.meterNumber || '';

      if (meterId) {
        const parsedMeterId = parseInt(String(meterId), 10);
        if (!isNaN(parsedMeterId) && parsedMeterId > 0) {
          setSelectedMeterId(parsedMeterId);
          setViewAll(false);
          setDateToggleValue('today');
          setCurrentDayIndex(0);
          setSearchValue(
            consumerNumber || meterNumber
              ? `${consumerNumber || 'N/A'} • ${meterNumber || 'N/A'}`
              : searchQuery
          );
          setSearchResults([]);
          return;
        }
      }

      alert(
        `No meter mapping found for "${searchQuery}". Please refine your search.`
      );
    } catch (error) {
      console.error('Global search error:', error);
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
                type: 'column' as const,
                gap: 'gap-4',
                className: 'w-full border border-primary-border dark:border-dark-border rounded-lg p-4 bg-background-secondary dark:bg-primary-dark-light justify-between',
                rows: [
                  {
                    layout: 'row' ,
                    className: ' w-full items-center justify-between',
                    columns: [
                      {
                        name: 'PageHeader',
                        props: {
                          title: 'Search Meter Load Survey Data',
                          titleClassName: 'text-md font-semibold text-text-primary dark:text-white m-0',
                        },
                      },
                      {
                        name: 'DateToggle',
                        props: {
                          value: dateToggleValue,
                          selectedClassName: 'bg-background-secondary dark:bg-primary-dark-light',
                          className: 'bg-background-secondary dark:bg-primary-dark-light',
                          onChange: (v: 'today' | 'yesterday') => {
                            setDateToggleValue(v);
                          },
                        
                          options: [
                            { value: 'today', label: 'Today', icon: 'icons/calendar_v2.svg' },
                            { value: 'yesterday', label: 'Yesterday', icon: 'icons/calendar_v2.svg' },
                          ],
                        },
                      },
                    ],
                    span: { col: 1, row: 1 },
                  },
                  {
                    layout: 'row',
                    className: 'items-center',
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
                type: 'column',
                gap: 'gap-4',
                rows: [
                  {
                    layout: 'row',
                    className: 'flex items-center gap-4',
                    columns: [
                      {
                        name: 'CheckboxInput',
                        props: {
                          label: 'View All',
                          id: 'viewAll',
                          name: 'viewAll',
                          value: viewAll,
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                            setViewAll(e.target.checked);
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
            viewAll
              ? {
                  layout: {
                    type: 'column',
                    gap: 'gap-4',
                    rows: [
                      {
                        layout: 'row',
                        className: 'flex items-center gap-4',
                        columns: [
                          {
                            name: 'Table',
                            props: {
                              showHeader: true,
                              headerTitle: 'LS Data',
                              className:'mb-3',
                              showSearchBar: true,
                              showDownload: true,
                              columns: [
                                { key: 'S.No', label: 'S.No' },
                                { key: 'CIRCLE', label: 'CIRCLE' },
                                { key: 'DIVISION', label: 'DIVISION' },
                                { key: 'SUB-DIVISION', label: 'SUB-DIVISION' },
                                { key: 'SECTION', label: 'SECTION' },                
                                { key: 'Meter SI No', label: 'Meter SI No' },
                                { key: 'Consumer Name', label: 'Consumer Name' },
                                { key: 'USC No', label: 'USC No' },
                              ],
                              data: tableRows,
                              onView: (row: any) => {
                                const id = row.id ?? row.meterId;
                                if (!id) return;

                                const t = new Date();
                                const todayStr = formatDateForApi(t);
                                navigate(
                                  `/lsdata-individual/${encodeURIComponent(String(id))}?startDate=${encodeURIComponent(todayStr)}&endDate=${encodeURIComponent(todayStr)}`
                                );
                              },
                              onRowClick: (row: any) => {
                                const id = row.id ?? row.meterId;
                                if (!id) return;

                                const t = new Date();
                                const todayStr = formatDateForApi(t);
                                const url = `/lsdata-individual/${encodeURIComponent(String(id))}?startDate=${encodeURIComponent(todayStr)}&endDate=${encodeURIComponent(todayStr)}`;
                                window.open(url, '_blank', 'noopener,noreferrer');
                              },
                            },
                          },
                        ],
                      },
                    ],
                  },
                }
              : null,
            ,
            !viewAll
              ? {
                  layout: {
                    type: 'column' as const,
                    gap: 'gap-4',
                    rows: [
                      {
                        layout: 'grid' as const,
                        gridColumns: 1,
                        columns: [
                          {
                        name: 'LineChart',
                        key: `kva-${lsSelectedMetric}-main-${currentDayIndex}`,
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
                              headerTitle: `Daily LS Data (${getCurrentDateLabel()})`,
                              isLoading: isLsDataLoading,
                              showXAxisLabel: true,
                              xAxisLabel: X_AXIS_LABELS[lsSelectedMetric] ?? 'kVA',
                              showTooltip: true,
                              showTooltipTimestamp: true,
                              smooth: true,
                              yAxisMax: yAxisMax,
                              yAxisFormatter: formatYAxisLabel,
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
                }
              : null
          ].filter(Boolean)}
        />
      </Suspense>

  );
};

export default LSData;