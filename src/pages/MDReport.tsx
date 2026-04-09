import React, {
  lazy,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';

import BACKEND_URL from '../config';

const Page = lazy(() => import('SuperAdmin/Page'));

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};



// Static columns definition for MD Report
const MD_REPORT_COLUMNS = [
  {
    key: "serialNo",
    label: "S.No",

    render: (_value: any, row: any) =>
        row && row.sNo !== undefined && row.sNo !== null ? row.sNo : "",
   
  },
  // { key: 'dtrCode', label: 'DTR Code' },
  // { key: 'dtrName', label: 'DTR Name' },
  { key: 'meterNumber', label: 'Meter Sl.No' },
  // { key: 'meterId', label: 'Meter Id' },
  { key: 'mdkw', label: 'Mdkw' },
  { key: 'mdkwTimestamp', label: 'Occured On (Mdkw)' },
  { key: 'mdkva', label: 'Mdkva' },
  { key: 'mdkvaTimestamp', label: 'Occured On (Mdkva)' },
  { key: 'date', label: 'Selected Date' },
];

const MDReport: React.FC = () => {
  const [date, setDate] = useState<string>(() => formatDate(new Date()));
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  const navigate = useNavigate();

  // API caps at 100 per request; fetch multiple pages and combine so table can show full pageSize (e.g. 500)
  const API_PAGE_SIZE = 100;

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const extractRecordsFromResult = (result: any): any[] => {
        if (Array.isArray(result)) return result;
        if (Array.isArray(result?.data?.records)) return result.data.records;
        if (Array.isArray(result?.records)) return result.records;
        if (Array.isArray(result?.data)) return result.data;
        return [];
      };
      const extractTotalFromResult = (result: any): number => {
        if (result?.meta?.pagination?.totalCount != null) return result.meta.pagination.totalCount;
        if (typeof result?.total === 'number') return result.total;
        if (typeof result?.data?.total === 'number') return result.data.total;
        return 0;
      };

      const paramsFirst = new URLSearchParams({
        date,
        page: '1',
        pageSize: String(API_PAGE_SIZE),
      });
      const urlFirst = `${BACKEND_URL}/reports/md-report?${paramsFirst.toString()}`;
      const responseFirst = await fetch(urlFirst, { credentials: 'include' });

      if (!responseFirst.ok) {
        throw new Error(`Failed to fetch MD report (status ${responseFirst.status})`);
      }

      const resultFirst = await responseFirst.json();
      const firstRecords = extractRecordsFromResult(resultFirst);
      const totalCount = extractTotalFromResult(resultFirst);
      setTotalRecords(totalCount);

      const startIdx = (page - 1) * pageSize;
      const endIdx = Math.min(page * pageSize, totalCount);
      const firstApiPage = Math.floor(startIdx / API_PAGE_SIZE) + 1;
      const lastApiPage = totalCount > 0 ? Math.ceil(endIdx / API_PAGE_SIZE) : 0;

      let recordsForView: any[];
      if (totalCount === 0 || lastApiPage < 1) {
        recordsForView = [];
      } else if (lastApiPage === 1) {
        recordsForView = firstRecords.slice(startIdx, endIdx);
      } else {
        let allRecords = [...firstRecords];
        for (let apiPage = 2; apiPage <= lastApiPage; apiPage++) {
          const params = new URLSearchParams({
            date,
            page: String(apiPage),
            pageSize: String(API_PAGE_SIZE),
          });
          const url = `${BACKEND_URL}/reports/md-report?${params.toString()}`;
          const res = await fetch(url, { credentials: 'include' });
          if (!res.ok) throw new Error(`Failed to fetch MD report (status ${res.status})`);
          const result = await res.json();
          const records = extractRecordsFromResult(result);
          allRecords = allRecords.concat(records);
        }
        const sliceStart = startIdx - (firstApiPage - 1) * API_PAGE_SIZE;
        const sliceEnd = endIdx - (firstApiPage - 1) * API_PAGE_SIZE;
        recordsForView = allRecords.slice(sliceStart, sliceEnd);
      }

      const mapped = recordsForView.map((item: any, idx: number) => {
        const { slNo, ...rest } = item || {};
        return {
          ...rest,
          sNo: slNo ?? item?.sNo ?? startIdx + idx + 1,
        };
      });

      setData(mapped);
    } catch (err: any) {
      setError(
        err?.message || 'Failed to fetch MD report. Please try again.'
      );
      setData([]);
      setTotalRecords(0);
    } finally {
      setIsLoading(false);
    }
  }, [date, page, pageSize]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePageChange = useCallback(
    (newPage: number, newPageSize?: number) => {
      if (newPageSize && newPageSize !== pageSize) {
        setPageSize(newPageSize);
        setPage(1);
      } else {
        setPage(newPage);
      }
    },
    [pageSize]
  );

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handleRetry = () => {
    fetchReport();
  };

  // Navigate to Feeders page when a row or "view" action is clicked
  // MD Report API returns: { meterId, meterNumber, dtrNumber, date, mdkva, mdkw, ... }
  const handleView = (row: any) => {
    if (!row) return;

    // Extract meter number from MD report response
    const meterNumber = row.meterNumber || row.meter?.meterNumber || '';

    // Extract DTR number from MD report response (directly available, not nested)
    const dtrNumber = row.dtrNumber || '';

    // Primary identifier: prefer meterNumber, fallback to dtrNumber or meterId
    const primaryId = meterNumber || dtrNumber || row.meterId || '';

    if (!primaryId) {
      console.warn('MD Report: No valid identifier found for navigation', row);
      return;
    }

    // Build navigation state matching Instantaneous.tsx pattern
    const navigationState = {
      feederData: {
        sNo: row.sNo || row.slNo || row.serialNo || '',
        feederName: meterNumber || dtrNumber || '',
        loadStatus: row.loadStatus || row.communicationStatus || 'N/A',
        rating: row.capacity || row.rating || 'N/A',
        address: row.location || 'N/A',
        dtrId: row.dtrId || null,
        dtrNumber: dtrNumber || null,
        meterNumber: meterNumber || null,
      },
      dtrId: row.dtrId || null,
      dtrNumber: dtrNumber || null,
      meterNumber: meterNumber || null,
    };

    // Navigate to Feeders page with meter number or DTR number as the route param
    navigate(`/feeder/${encodeURIComponent(primaryId)}`, { state: navigationState });
  };

  const handleDownload = async () => {
    try {
      // Backend caps pageSize at 100, so fetch all pages (like Instantaneous uses totalCount for limit)
      const totalToFetch = totalRecords;
      if (!totalToFetch || totalToFetch === 0) {
        alert('No MD report data available to download for the selected date.');
        return;
      }

      const pageSizeForDownload = 500; // API max per request
      let allRecords: any[] = [];
      let page = 1;

      while (allRecords.length < totalToFetch) {
        const params = new URLSearchParams({
          date,
          page: String(page),
          pageSize: String(pageSizeForDownload),
        });
        const fullUrl = `${BACKEND_URL}/reports/md-report?${params.toString()}`;
        const response = await fetch(fullUrl, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch MD report for download (status ${response.status})`);
        }

        const result = await response.json();

        let records: any[] = [];
        if (Array.isArray(result)) {
          records = result;
        } else if (Array.isArray(result?.data?.records)) {
          records = result.data.records;
        } else if (Array.isArray(result?.records)) {
          records = result.records;
        } else if (Array.isArray(result?.data)) {
          records = result.data;
        }

        if (!records || records.length === 0) break;
        allRecords = allRecords.concat(records);
        if (records.length < pageSizeForDownload) break;
        page += 1;
      }

      if (!allRecords || allRecords.length === 0) {
        alert('No MD report data available to download for the selected date.');
        return;
      }

      // Add serial numbers if not present
      const mappedRecords = allRecords.map((item: any, idx: number) => {
        const { slNo, ...rest } = item || {};
        return {
          ...rest,
          sNo: slNo || item?.sNo || idx + 1,
        };
      });

      // Use static columns for download
      const downloadColumns = MD_REPORT_COLUMNS;

      // Helper to safely get nested values like "latestReading.kW"
      const getNestedValue = (obj: any, path: string) => {
        return path.split('.').reduce((acc, key) => {
          if (acc && typeof acc === 'object' && key in acc) {
            return acc[key];
          }
          return '';
        }, obj);
      };

      // Build headers from columns
      const headers =
        downloadColumns && downloadColumns.length > 0
          ? downloadColumns.map((col: any) => col.label || col.key)
          : Object.keys(mappedRecords[0] || {});

      const columnKeys =
        downloadColumns && downloadColumns.length > 0
          ? downloadColumns.map((col: any) => col.key)
          : Object.keys(mappedRecords[0] || {});

      const formatDateLikeValue = (val: any) => {
        if (!val) return '';
        // If it's already a well-formatted string, return as-is
        if (typeof val === 'string' && val.trim()) {
          // Check if it's already in a readable format (not ISO)
          if (!val.includes('T') && !val.includes('Z')) {
            return val.trim();
          }
        }
        
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          // If date parsing fails, return original value as string
          return String(val);
        }
        
        // Format as DD/MM/YYYY HH:MM (Excel-friendly format)
        // Using slash separator which Excel handles better
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        const secs = String(d.getSeconds()).padStart(2, '0');
        
        // Return in format: DD/MM/YYYY HH:MM:SS (Excel will display this correctly)
        return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
      };

      const escapeCsv = (value: any, key?: string) => {
        if (value === null || value === undefined) return '';
        let str = String(value);

        const keyLower = (key || '').toLowerCase();
        if (
          keyLower.includes('date') ||
          keyLower.includes('time') ||
          keyLower.includes('timestamp')
        ) {
          str = formatDateLikeValue(value);
          // Force Excel to treat as text by wrapping in quotes and prefixing with tab
          // This prevents Excel from auto-formatting and showing ####
          return `"\t${str}"`;
        }

        if (/[",\n]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows: string[] = [];
      csvRows.push(headers.map((h) => escapeCsv(h)).join(','));

      mappedRecords.forEach((row: any) => {
        const values = columnKeys.map((key) => {
          const v = key.includes('.') ? getNestedValue(row, key) : row[key];
          return escapeCsv(v, key);
        });
        csvRows.push(values.join(','));
      });

      const csvContent = csvRows.join('\n');

      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `md-report-${date}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error downloading MD report:', err);
      alert('Failed to download MD report. Please try again.');
    }
  };

  return (

      <Page
        sections={[
          ...(error
            ? [
                {
                  layout: {
                    type: 'column' as const,
                    gap: 'gap-4',
                  },
                  components: [
                    {
                      name: 'Error',
                      props: {
                        visibleErrors: [error],
                        onRetry: handleRetry,
                        showRetry: true,
                        maxVisibleErrors: 1,
                      },
                    },
                  ],
                },
              ]
            : []),
          {
            layout: {
              type: 'grid' as const,
              columns: 1,
              className: '',
            },
            components: [
              {
                name: 'PageHeader',
                props: {
                  title: 'MD Report',
                  onBackClick: () => window.history.back(),
                  backButtonText: 'Back to Dashboard',
                },
              },
            ],
          },
          {
            layout: {
              type: 'column' as const,
              gap: 'gap-4',
              className: 'w-full bg-background-secondary dark:bg-primary-dark-light rounded-3xl p-4 ',
              rows: [
                {
                  layout: 'row',
                  gap: 'gap-2',
                  className: ' flex items-center justify-between max-w-md',
                  columns: [  
                    {
                      name: 'PageHeader',
                      props: {
                        title: 'Select Date',
                        titleClassName: 'text-md font-semibold text-text-primary dark:text-white m-0 max-w-md',
                      },
                    },
                  ],
                },
                {
                  layout: 'row',
                  gap: 'gap-2',
                  className: ' flex items-center  w-full',
                  columns: [  
                    {
                      name: 'Calendar',
                      props: {
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          const newDate = e.target.value;
                          if (newDate && newDate !== date) {
                            setDate(newDate);
                          }
                        },
                        value: date, 
                        placeholder: 'Select Date',
                        className: 'max-w-md',
                        selectionMode: 'day',
                        name: 'date',
                      },
                    },
                    {
                      name: 'Button',
                     props: {
                      label: 'Search',
                      variant: 'primary',
                      onClick: () => fetchReport(),
                      disabled: !date.trim(),
                    },
                    },
                    {
                      name: 'Button',
                     props: {
                      label: 'Download',
                        variant: 'secondary',
                        onClick: () => handleDownload(),
                        disabled: !date.trim(),
                      },
                    },
                   
                  ],
                },
              ],
            },
          },
          {
            layout: {
              type: 'grid' as const,
              columns: 1,
              className: '',
            },
            components: [
              {
                name: 'Table',
                props: {
                  data,
                  columns: MD_REPORT_COLUMNS,
                  showHeader: false,
                  headerTitle: 'MD Report',
                  searchable: false,
                  sortable: true,
                  pagination: true,
                  showPagination: true,
                  initialRowsPerPage: pageSize,
                  rowsPerPageOptions: [10, 25, 50, 100, 500],
                  itemsPerPage: pageSize,
                  pageSize,
                  showActions: true,
                  onView: handleView,
                  onRowClick: handleView,
                  serverPagination: {
                    currentPage: page,
                    totalPages:
                      pageSize > 0
                        ? Math.max(1, Math.ceil(totalRecords / pageSize))
                        : 1,
                    totalCount: totalRecords,
                    limit: pageSize,
                    hasNextPage: page * pageSize < totalRecords,
                    hasPrevPage: page > 1,
                  },
                  onPageChange: handlePageChange,
                  onPageSizeChange: handlePageSizeChange,
                  onRowsPerPageChange: handlePageSizeChange,
                  loading: isLoading,
                  emptyMessage:
                    'No MD report data found for the selected date',
                },
              },
            ],
          },
        ]}
      />
  );
};

export default MDReport;
