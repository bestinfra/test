import { lazy, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BACKEND_URL from '../config';
const Page = lazy(() => import('SuperAdmin/Page'));

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const Instantaneous = () => {
  const [searchValue, setSearchValue] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [meterDetails, setMeterDetails] = useState<any[]>([]);
  const [highestValue, setHighestValue] = useState<string>('');
  const [serverPagination, setServerPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();




  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Search consumers using the same `/consumers/search` API pattern as AppLayout
  const searchConsumers = async (query: string, limit: number = 10) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const fullUrl = `${BACKEND_URL}/consumers/search?query=${encodeURIComponent(trimmed)}&limit=${limit}`;
      const response = await fetch(fullUrl, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        setSearchResults([]);
        return;
      }

      const result = await response.json();
      if (result?.success && Array.isArray(result.data) && result.data.length > 0) {
        const suggestions = result.data.map((item: any, index: number) => {
          return {
            id: `consumer-${index}`,
            // Display: Consumer No • Meter No • Name
            name: `${item.consumerNumber || 'N/A'} • ${item.meterNumber || 'N/A'} • ${item.name || ''}`,
            consumerNumber: item.consumerNumber,
            meterNumber: item.meterNumber,
            uid: item.uid || item.consumerNumber,
            // Preserve originals for navigation compatibility with AppLayout behaviour
            originalConsumerNumber: item.consumerNumber,
            originalName: item.name,
            originalMeterNumber: item.meterNumber,
            _originalData: item,
            _searchType: 'consumer',
          };
        });
        setSearchResults(suggestions);
      } else {
        setSearchResults([]);
      }
    } catch (error: any) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e: any) => {
    const value = e?.target?.value ?? '';
    setSearchValue(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchConsumers(value, 10);
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
    // Build a readable label similar to AppLayout header search
    const consumerNumber =
      result.originalConsumerNumber ??
      result.consumerNumber ??
      result._originalData?.consumerNumber;
    const meterNumber = result.originalMeterNumber ?? result.meterNumber;
    const name = result.originalName ?? result.name;

    const displayValue = [
      consumerNumber || 'N/A',
      meterNumber || 'N/A',
      name || '',
    ]
      .filter(Boolean)
      .join(' • ');

    setSearchValue(displayValue);
    setSearchResults([]);
    setIsSearching(false);

    // Do NOT navigate – instead, use the selected consumer / meter to filter instantaneous data
    const meterNumberToSearch =
      result.originalMeterNumber ??
      result.meterNumber ??
      result._originalData?.meterNumber ??
      null;

    if (meterNumberToSearch) {
      fetchMeterDetails(1, serverPagination.limit, String(meterNumberToSearch));
    }
  };

  // Global search using `/consumers/search` API same as AppLayout header search
  const handleGlobalSearch = async (query?: string) => {
    const searchQuery = query || searchValue.trim();
    if (!searchQuery || searchQuery.length < 2) {
      return;
    }

    const trimmedQuery = searchQuery.trim();
    try {
      const fullUrl = `${BACKEND_URL}/consumers/search?query=${encodeURIComponent(trimmedQuery)}`;
      const response = await fetch(fullUrl, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          const firstResult = result.data[0];
          const consumerNumber = firstResult.consumerNumber;
          const meterNumber = firstResult.meterNumber;
          const name = firstResult.name;

          // Update search box label based on first result
          const displayValue = [
            consumerNumber || 'N/A',
            meterNumber || 'N/A',
            name || '',
          ]
            .filter(Boolean)
            .join(' • ');

          setSearchValue(displayValue);
          setSearchResults([]);

          // Do NOT navigate – instead filter instantaneous data using meter number (if available)
          if (meterNumber) {
            await fetchMeterDetails(1, serverPagination.limit, String(meterNumber));
          }
          return;
        }
      }

      alert(`No results found for "${trimmedQuery}". Please check your search term.`);
    } catch (error) {
      console.error('Global search error:', error);
      alert('Search failed. Please try again.');
    }
  };

  // Fetch meter details from backend API: /api/meters/details?page=1&limit=10[&search=...]
  const fetchMeterDetails = async (page: number = 1, limit: number = 10, search?: string) => {
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const fullUrl = `${BACKEND_URL}/meters/details?page=${page}&limit=${limit}${searchParam}`;
      const response = await fetch(fullUrl, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },  
      });
      if (response.ok) {
        const result = await response.json();
        // result may be { data: [...] } or an array directly
        let dataArray: any[] = [];
        if (Array.isArray(result)) {
          dataArray = result;
        } else if (Array.isArray(result?.data)) {
          dataArray = result.data;
        } else if (result?.status === 'success' && Array.isArray(result.data)) {
          dataArray = result.data;
        }
        setMeterDetails(dataArray);

        // Extract pagination metadata - always set so currentPage updates (S.No depends on it)
        const paginationMeta = result.meta?.pagination;
        const totalCount = paginationMeta?.totalCount ?? result.meta?.totalCount ?? dataArray.length;
        const totalPages = paginationMeta?.totalPages ?? result.meta?.totalPages ?? (limit > 0 ? Math.max(1, Math.ceil(totalCount / limit)) : 1);
        const currentPage = paginationMeta?.currentPage ?? paginationMeta?.page ?? result.meta?.currentPage ?? result.meta?.page ?? page;
        const pageLimit = paginationMeta?.pageSize ?? paginationMeta?.limit ?? result.meta?.pageSize ?? result.meta?.limit ?? limit;

        setServerPagination({
          currentPage,
          totalPages,
          totalCount,
          limit: pageLimit,
          hasNextPage: paginationMeta?.hasNextPage ?? result.meta?.hasNextPage ?? (page < totalPages),
          hasPrevPage: paginationMeta?.hasPrevPage ?? result.meta?.hasPrevPage ?? page > 1,
        });
      } else {
        setMeterDetails([]);
      }
    } catch (err) {
      console.error('Failed to fetch meter details:', err);
      setMeterDetails([]);
    } finally {
    }
  };
  // Load initial meter details on mount (page 1, limit 10)
  useEffect(() => {
    fetchMeterDetails(1, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
 
  // Format readingDate without incorrect timezone shifting.
  // - If backend already sends "DD/MM/YYYY, HH:mm:ss" (or without seconds), keep that local time and show AM/PM.
  // - If backend sends ISO (e.g. "2026-01-27T10:30:01.000Z"), format it in Asia/Kolkata.
  // Returns 'N/A' for invalid or masked values (e.g. "XXXXXXXXXXXXXX")
  const formatReadingDate = (dateStr: any): string => {
    if (!dateStr || dateStr === null || dateStr === undefined) return 'N/A';
    
    const dateString = String(dateStr).trim();
    if (dateString === '' || dateString === '-' || dateString === 'N/A') return 'N/A';
    // Treat mask-like strings (e.g. "XXXXXXXXXXXXXX") as invalid
    if (/^X+$/i.test(dateString) || (dateString.match(/X/gi) || []).length >= 3) return 'N/A';
    
    try {
      // Handle "DD/MM/YYYY, HH:mm:ss" (or "DD/MM/YYYY HH:mm")
      const dmyMatch = dateString.match(
        /^(\d{2})\/(\d{2})\/(\d{4})(?:,)?\s+(\d{2}):(\d{2})(?::(\d{2}))?$/
      );
      if (dmyMatch) {
        const [, dd, mm, yyyy, HH, MM] = dmyMatch;
        const hour24 = Number(HH);
        const minute = Number(MM);
        if (
          Number.isFinite(hour24) &&
          Number.isFinite(minute) &&
          hour24 >= 0 &&
          hour24 <= 23 &&
          minute >= 0 &&
          minute <= 59
        ) {
          const ampm = hour24 >= 12 ? 'PM' : 'AM';
          let hour12 = hour24 % 12;
          hour12 = hour12 ? hour12 : 12;
          const pad2 = (n: number) => String(n).padStart(2, '0');
          return `${dd}/${mm}/${yyyy} ${hour12}:${pad2(minute)} ${ampm}`;
        }
      }

      // Fallback: parse as Date and format in Asia/Kolkata (prevents UTC forcing)
      const date = new Date(dateString);
      
      // Check if date is valid; do not return raw string for invalid dates
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      
      const formatted = date
        .toLocaleString('en-GB', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
        .replace(',', '');
      
      return formatted;
    } catch (error) {
      console.warn('Failed to format date:', dateStr, error);
      return 'N/A';
    }
  };

  // Prepare display data: flatten latestReading fields and format values.
  // Special formatting rule:
  // - Missing / empty => "N/A"
  // - If numeric has exactly 1 decimal digit (e.g. 14.7) => show as "14.07"
  // - Otherwise show with two decimals (e.g. 22.90)
  const formatDisplay = (v: any) => {
    if (v === null || v === undefined) return 'N/A';
    if (typeof v === 'string') {
      const s = v.trim();
      if (s === '' || s.toLowerCase() === 'n/a') return 'N/A';
    }
    const n = Number(v);
    if (!isNaN(n)) {
      const raw = typeof v === 'string' ? v.trim() : String(v);
      if (raw.includes('.')) {
        const parts = raw.split('.');
        // If exactly 1 decimal digit, prepend a 0 to make it two digits (14.7 -> 14.07)
        if (parts[1].length === 1) {
          return `${parts[0]}.${parts[1].padStart(2, '0')}`;
        }
        // Otherwise format to two decimals (handles >2 decimals as well)
        return n.toFixed(2);
      }
      // No decimal in original input -> show two decimals
      return n.toFixed(2);
    }
    return String(v);
  };

  // Map dropdown "Highest Value" to column key for Excel download sort only (no table sort)
  // highestVoltage / highestCurrent = max of R,Y,B per row, then sort by that; others = single column
  const highestValueToKey: Record<string, string> = {
    highestVoltage: 'maxVoltage',
    highestCurrent: 'maxCurrent',
    highestCurrentN: 'neutralcurrent',
    highestkW: 'kW',
    highestkVA: 'kVA',
    highestkVAR: 'kVAR',
  };

  // Filename suffix when a "Highest Value" is selected (default name used when none selected)
  const highestValueToFilename: Record<string, string> = {
    highestVoltage: 'Highest-Voltage',
    highestCurrent: 'Highest-Current',
    highestCurrentN: 'Highest-Current-N',
    highestkW: 'Highest-kW',
    highestkVA: 'Highest-kVA',
    highestkVAR: 'Highest-kVAR',
  };

  const parseNumeric = (v: any): number => {
    if (v == null || v === '' || String(v).trim().toLowerCase() === 'n/a') return -Infinity;
    const n = Number(String(v).replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? -Infinity : n;
  };

  /** Max of Voltage R, Y, B for a row; used to sort by "Highest Voltage" (highest phase voltage first). */
  const maxVoltageRYB = (r: any, y: any, b: any): number =>
    Math.max(parseNumeric(r), parseNumeric(y), parseNumeric(b));



  /** Max of Current R, Y, B for a row; used to sort by "Highest Current" (highest phase current first). */
  const maxCurrentRYB = (r: any, y: any, b: any): number =>
    Math.max(parseNumeric(r), parseNumeric(y), parseNumeric(b));


  const processedMeterDetails = meterDetails.map((item: any, index: number) => {
    const obj: any = { ...item };
    const lr = { ...(item.latestReading || {}) };

    // S.No that continues across pages: page 1 → 1–10, page 2 → 11–20, page 3 → 21–30
    const rowSNo = (serverPagination.currentPage - 1) * serverPagination.limit + index + 1;
    obj.sNo = rowSNo;
    obj.slNo = rowSNo;
    obj.serialNumberDisplay = rowSNo; // used by column so Table cannot override with index

    // Format readingDate by removing T, seconds, and Z
    lr.readingDate = formatReadingDate(lr.readingDate);
    lr.voltageR = formatDisplay(lr.voltageR);
    lr.voltageY = formatDisplay(lr.voltageY);
    lr.voltageB = formatDisplay(lr.voltageB);
    lr.currentR = formatDisplay(lr.currentR);
    lr.currentY = formatDisplay(lr.currentY);
    lr.currentB = formatDisplay(lr.currentB);
    lr.kVA = formatDisplay(lr.kVA);
    lr.mdkva = formatDisplay(lr.mdkva);
    lr.kW = formatDisplay(lr.kW);
    lr.kVAR = formatDisplay(lr.kVAR);
    lr.neutralcurrent = formatDisplay(lr.neutralcurrent);
    lr.frequency = formatDisplay(lr.frequency);
    lr.rphPowerFactor = formatDisplay(lr.rphPowerFactor);
    lr.yphPowerFactor = formatDisplay(lr.yphPowerFactor);
    lr.bphPowerFactor = formatDisplay(lr.bphPowerFactor);
    lr.averagePF = formatDisplay(lr.averagePF);

    obj.latestReading = lr;
    // Ensure lastCommunicationDate exists (fallback to empty string)
    obj.lastCommunicationDate = item.readingDate || item.lastCommunication || '';
    obj.usc = item.uscNo ?? item['USC No'] ?? item.use ?? '0';

    return obj;
  });

  const handleDownload = async () => {
    try {
      const searchParam = searchValue.trim();
      const searchQuery = searchParam.length > 0 ? `&search=${encodeURIComponent(searchParam)}` : '';
      const totalToDownload = serverPagination.totalCount || 0;
      if (!totalToDownload) {
        alert('No data available to download.');
        return;
      }
      const fullUrl = `${BACKEND_URL}/meters/details?page=1&limit=${totalToDownload}${searchQuery}`;

      const response = await fetch(fullUrl, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        alert('Failed to download data. Please try again.');
        return;
      }

      const result = await response.json();

      let dataArray: any[] = [];
      if (Array.isArray(result)) {
        dataArray = result;
      } else if (Array.isArray(result?.data)) {
        dataArray = result.data;
      } else if (result?.status === 'success' && Array.isArray(result.data)) {
        dataArray = result.data;
      }

      if (!dataArray.length) {
        alert('No data available to download.');
        return;
      }

      // Prepare and format data similar to table view (uses shared highestValueToKey & parseNumeric)
      // _sortIndex preserves original order for stable sort (tie-breaker) and is stripped before CSV output
      let formattedRows = dataArray.map((item: any, index: number) => {
        const lr = { ...(item.latestReading || {}) };

        const readingDate = lr.readingDate
          ? (() => {
              const str = String(lr.readingDate).replace(/[tTzZ]/g, ' ').replace(/sec/g, '').replace(/\s+/g, ' ').trim();
              const dt = new Date(str);
              if (!isNaN(dt.getTime())) {
                const pad = (n: number) => n.toString().padStart(2, '0');
                let hours = dt.getHours();
                const minutes = pad(dt.getMinutes());
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12;
                const day = pad(dt.getDate());
                const month = pad(dt.getMonth() + 1);
                const year = dt.getFullYear();
                return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
              }
              return 'N/A';
            })()
          : 'N/A';

        const voltageR = formatDisplay(lr.voltageR);
        const voltageY = formatDisplay(lr.voltageY);
        const voltageB = formatDisplay(lr.voltageB);
        const currentR = formatDisplay(lr.currentR);
        const currentY = formatDisplay(lr.currentY);
        const currentB = formatDisplay(lr.currentB);
        return {
          _sortIndex: index,
          sNo: index + 1,
          dtrSerialNumber: item.dtrSerialNumber || item.dtr?.dtrSerialNumber || '',
          dtrCode: item.dtrCode || item.dtr?.dtrCode || '',
          meterNumber: item.meterNumber || item.meter?.meterNumber || '',
          voltageR,
          voltageY,
          voltageB,
          currentR,
          currentY,
          currentB,
          maxVoltage: maxVoltageRYB(lr.voltageR, lr.voltageY, lr.voltageB),
          maxCurrent: maxCurrentRYB(lr.currentR, lr.currentY, lr.currentB),
          neutralcurrent: formatDisplay(lr.neutralcurrent),
          kW: formatDisplay(lr.kW),
          kVA: formatDisplay(lr.kVA),
          kVAR: formatDisplay(lr.kVAR),
          averagePF: formatDisplay(lr.averagePF),
          readingDate,
        };
      });

      // When "Highest Value" is selected (e.g. Highest Voltage, Highest Current), sort by that column (descending), then re-number S.No 1,2,3... to match final order
      const sortKey = highestValue ? highestValueToKey[highestValue] : null;
      const firstRow = formattedRows[0];
      if (sortKey && firstRow && sortKey in firstRow) {
        formattedRows = [...formattedRows].sort((a: any, b: any) => {
          const numA = parseNumeric(a[sortKey]);
          const numB = parseNumeric(b[sortKey]);
          if (numB !== numA) return numB - numA; // descending: highest first
          return (a._sortIndex ?? 0) - (b._sortIndex ?? 0); // stable tie-break by original index
        });
        formattedRows = formattedRows.map((row: any, idx: number) => {
          const { _sortIndex, ...rest } = row;
          return { ...rest, sNo: idx + 1 };
        });
      }

      const headers = [
        'S.No',
        'DTR Code',
        'DTR Name',
        'Meter SI No',
        'Voltage(R)',
        'Voltage(Y)',
        'Voltage(B)',
        'Current(R)',
        'Current(Y)',
        'Current(B)',
        'Current(N)',
        'kW',
        'kVA',
        'kVAR',
        'Average PF',
        'Last Communication',
      ];

      const escapeCsv = (value: any) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (/[",\n]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = [
        headers.join(','),
        ...formattedRows.map((row) =>
          [
            row.sNo,
            row.dtrSerialNumber,
            row.dtrCode,
            row.meterNumber,
            row.voltageR,
            row.voltageY,
            row.voltageB,
            row.currentR,
            row.currentY,
            row.currentB,
            row.neutralcurrent,
            row.kW,
            row.kVA,
            row.kVAR,
            row.averagePF,
            row.readingDate,
          ]
            .map(escapeCsv)
            .join(',')
        ),
      ];

      const downloadFilename = highestValue && highestValueToFilename[highestValue]
        ? `instantaneous-data-${highestValueToFilename[highestValue]}.csv`
        : 'instantaneous-data.csv';

      const blob = new Blob([csvRows.join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download data. Please try again.');
    }
  };

  const handleView = (row: any) => {
    if (!row) return;

    // Navigate to Consumer Detail View with ONLY consumer number.
    // Support multiple possible backend field names for consumer number.
    const consumerNo =
      row.consumerNumber ??
      row.consumerNo ??
      row.consumer_number ??
      row.serviceNumber ??
      row.scNo ??
      row.scno ??
      row.consumer?.consumerNumber ??
      row.consumer?.consumerNo;

    const consumerNoStr = consumerNo != null ? String(consumerNo).trim() : '';
    if (!consumerNoStr) {
      alert('Consumer number not found for this record.');
      return;
    }

    navigate(`/consumers/${encodeURIComponent(consumerNoStr)}`);
  };

  const handlePageChange = (page: number, limit?: number) => {
    const pageSize = limit ?? serverPagination.limit;
    // Update currentPage immediately so S.No (1-10, 11-20, 21-30...) recomputes right away
    setServerPagination((prev) => ({ ...prev, currentPage: page, limit: pageSize }));
    fetchMeterDetails(page, pageSize, searchValue.trim() || undefined);
  };

  const handleRowsPerPageChange = (limit: number) => {
    fetchMeterDetails(1, limit, searchValue.trim() || undefined);
  };


  return (

    <Page
      sections={[
        {
          layout: {
            type: 'row',
            gap: 'gap-4',
            rows: [
              {
                layout: 'column',
                gap: 'gap-4',
                columns: [
                  {
                    name: 'PageHeader',
                    props: { 
                        title: 'Instantaneous Data',
                        onBackClick: () => window.history.back(),
                        backButtonText: 'Back to Dashboard',
                    },
                  },
                ],
              },
              
            ],
          },
        },
        {
            layout: {
              type: 'column',
              gap: 'gap-2',
              className: 'w-full border border-primary-border dark:border-dark-border rounded-lg p-4 bg-background-secondary dark:bg-primary-dark-light',
              rows: [
                {
                    layout: 'column',
                    gap: 'gap-4',
                    columns: [
                      {
                        name: 'PageHeader',
                        props: { 
                            title: 'Search Meter',
                            titleClassName: 'text-md font-semibold text-text-primary dark:text-white m-0',

                         },
                      },
                    ],
                },
                {
                  layout: 'row',
                  gap: 'gap-4',
              
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
                          className: 'max-w-md',
                       },
                      },
                      {
                        name:'Dropdown',
                        props: {
                          options: [
                            { label: 'Highest Voltage', value: 'highestVoltage' },
                            { label: 'Highest Current', value: 'highestCurrent' },
                            { label: 'Highest Current(N)', value: 'highestCurrentN' },
                            { label: 'Highest kW', value: 'highestkW' },
                            { label: 'Highest kVA', value: 'highestkVA' },
                            // { label: 'Highest kVAR', value: 'highestkVAR' },
                          ],
                          value: highestValue,
                          onChange: (v: any) => {
                            const val = v?.target?.value ?? v;
                            setHighestValue(val ?? '');
                          },
                          placeholder: 'Select Highest Value',
                          searchable: false,
                          className: 'max-w-sm',
                        },
                      },
                      {
                        name: 'Button',
                        props: { 
                          label: 'Download',
                          variant: 'secondary',
                          onClick: () => { handleDownload(); },
                          className: 'max-w-md',
                       },
                      },
                     
                  ],
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
                  gap: 'gap-4',
                  columns: [
                    {
                      name: 'Table',
                      props: { 
                        data: processedMeterDetails,
                        columns: [
                          {
                            key: "serialNumberDisplay",
                            label: "S.No",
                            render: (_value: any, row: any) =>
                              row?.serialNumberDisplay ?? row?.sNo ?? row?.slNo ?? "",
                          },
                          // { key: 'dtrCode', label: 'DTR Code' },
                          // { key: 'dtrSerialNumber', label: 'DTR Name' },
                          { key: 'meterNumber', label: 'Meter SI No' },
                          { key: 'usc', label: 'USC No' },
                          { key: 'latestReading.voltageR', label: 'Voltage(R)' ,align: 'right'},
                          { key: 'latestReading.voltageY', label: 'Voltage(Y)' ,align: 'right'},
                          { key: 'latestReading.voltageB', label: 'Voltage(B)' ,align: 'right'},
                          { key: 'latestReading.currentR', label: 'Current(R)' ,align: 'right'},
                          { key: 'latestReading.currentY', label: 'Current(Y)' ,align: 'right'},
                          { key: 'latestReading.currentB', label: 'Current(B)' ,align: 'right'},
                          { key: 'latestReading.neutralcurrent', label: 'Current(N)',align: 'right' },                      
                          { key: 'latestReading.kW', label: 'kW' ,align: 'right'},
                          { key: 'latestReading.kVA', label: 'kVA' ,align: 'right'},
                          { key: 'latestReading.kVAR', label: 'kVAR' ,align: 'right'},
                          { key: 'latestReading.averagePF', label: 'Average PF' ,align: 'right'},
                          {key:'latestReading.readingDate', label: 'Last Communication '
                          },

                        //   { key: 'latestReading.mdkva', label: 'MD kVA' },
                        //   { key: 'latestReading.frequency', label: 'Frequency' },
                        //   { key: 'latestReading.rphPowerFactor', label: 'R Phase PF' },
                        //   { key: 'latestReading.yphPowerFactor', label: 'Y Phase PF' },
                        //   { key: 'latestReading.bphPowerFactor', label: 'B Phase PF' },
                        //   { key: 'latestReading.averagePF', label: 'Average PF' },
                        ],
                        showHeader: false,
                        showActions: true,
                        searchable: false,
                        headerTitle: 'Instantaneous Data',
                        onView: handleView,
                        onRowClick: handleView,
                        pagination: true,
                        serverPagination: serverPagination,
                        showPagination: true,
                        pageSize: serverPagination.limit,
                        totalCount: serverPagination.totalCount,
                        currentPage: serverPagination.currentPage,
                        totalPages: serverPagination.totalPages,
                        itemsPerPage: serverPagination.limit,
                        rowsPerPageOptions: [10, 25, 50, 100, 500],
                        initialRowsPerPage: 10,
                        onPageChange: handlePageChange,
                        onRowsPerPageChange: handleRowsPerPageChange,
                      },
                    },
                  ],
                },
                
              ],
            },
          },
          
        
        
      ]}
    />
  );
};

export default Instantaneous;