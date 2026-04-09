import { lazy } from 'react';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import BACKEND_URL from '../config';
import { apiClient, getAuthHeaders } from '../api/apiUtils';
import type { Column, TableData } from '../types/module';
const Page = lazy(() => import('SuperAdmin/Page'));


const meterConsumptionColumns: Column[] = [
  { key: 'S.No', label: 'S.No' },
  { key: 'Meter SI No', label: 'Meter Number' },
  { key: 'Consumer Name', label: 'Consumer Name' },
  { key: 'Last Communication Date', label: 'Last Communication Date' },
  // { key: "Consumption(kWh)", label: "Consumption (kWh)", align: "right" },
  { key: 'Consumption(kVAh)', label: 'Consumption (kVAh)' },
  { key: 'date', label: 'Date' },
  { key: 'timeRange', label: 'Period' },
];

const Consumers: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState('');
  const [menuValue, setMenuValue] = useState('');
  const [consumers, setConsumers] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessages, setErrors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFiltered, setIsSearchFiltered] = useState(false);
  const [_searchValue, _setSearchValue] = useState<string>('');
  const [_searchResults, _setSearchResults] = useState<any[]>([]);
  const [_isSearching, _setIsSearching] = useState<boolean>(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isMeterConsumptionView] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<'occupied' | 'vacant'>('occupied');
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [selectedEndDate, setSelectedEndDate] = useState('');
  const [serverPagination, setServerPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  const [appliedFilters, setAppliedFilters] = useState<string[]>([]);

  const transformConsumerData = (row: any) => {
    return {
      ...row,
      'S.No': row['Sl.No'] || row['S.No'] || row.sNo,
      UID: row.uid || row.UID,
      'Consumer Number': row.consumerNumber || row['Consumer Number'] || row.consumer_number,
      'Consumer Name': row.name || row['Consumer Name'],
      'Meter SI No': row.meterNumber || row['Meter SI No'] || row.meter,
      'Last Communication Date': row.lastCommunicationDate || row['Last Communication Date'],
      'Consumption(KVAh)':
        row['Consumption(kVAh)'] || row['Consumption(KVAh)'] || row.kvahConsumption || '0.000',
      cmd: row.cmd || '0',
      Location: row.location || row['Location'] || row.location,
      'USC No': row['USC No'] ?? row.use ?? '0',
      rmd: row.rmd || '0.00',
      'Occurred Timestamp': row['Occurred Timestamp'] || 'No Data',
      Phase: 'Phase' in row ? row.Phase : (row.phase ?? row.meterPhase ?? 1),
    };
  };

  const defaultColumns: Column[] = [
    { key: 'S.No', label: 'S.No' },
    // { key: 'DISCOM', label: 'DISCOM' },
    { key: 'Consumer Name', label: 'Consumer Name' },
    { key: 'Meter SI No', label: 'Meter SI No' },
    { key: 'USC No', label: 'USC No' },
    { key: 'CIRCLE', label: 'Circle' },
    { key: 'DIVISION', label: 'DIvision' },
    { key: 'SUB-DIVISION', label: 'Sub-Division' },
    { key: 'SECTION', label: 'Section' },
    { key: 'cmd', label: 'CMD' },
    
    // { key: 'UID', label: 'UID' },
    {
        key: "Secondary Consumption(kWh)",
        label: "Consumption(kWh)",
        align: "right",
    },
    {
      key: 'Consumption(kVAh)',
      label: 'Consumption(kVAh)',
      align: 'center',
    },
    {
      key: 'Phase',
      label: 'Phase',
      align: 'right',
      // className: 'text-nowrap',
      render: (value: string | number | boolean | null | undefined) => {
        const phase = value != null && value !== '' ? Number(value) : null;
        const label =
          phase === 1 ? 'Single' : phase === 3 ? 'Three' : '-';
        const statusBg =
          phase === 3
            ? 'bg-primary text-white'
            : currentStatus === 'occupied'
              ? 'bg-positive text-white'
              : 'bg-danger-light text-danger';
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBg}`}>
            {label}
          </span>
        );
      },
    },
    {
      key: 'Last Communication Date',
      label: 'Last Communication Date',
      autoDateFormat: true,
    },
  ];
  const params = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const filterDate = searchParams.get('date') || '';
  const filterConsumptionValue = searchParams.get('consumptionValue') || '';
  const isFiltered = searchParams.get('filtered') === 'true';


  let navigate: any;
  try {
    navigate = useNavigate();
  } catch (error) {
    console.warn('useNavigate not available in federated context, using fallback');
    navigate = (path: string) => {
      if (window.location.pathname !== path) {
        window.location.href = path;
      }
    };
  }

  const fetchConsumers = (
    page = 1,
    limit = 10,
    status: 'occupied' | 'vacant' = currentStatus,
    search = ''
  ) => {
    setLoading(true);

    const useByDateRoute =
      !!(selectedDate && selectedDate.trim()) && !(selectedStartDate && selectedEndDate);

    if (useByDateRoute) {
      const params = new URLSearchParams();

      if (selectedDate && selectedDate.trim()) {
        params.append('date', selectedDate.trim());
        params.append('timeRange', 'Daily');
      } else if (selectedStartDate && selectedEndDate) {
        params.append('date', selectedStartDate);
        params.append('timeRange', 'Monthly');
      }

      apiClient
        .get(`/consumers/by-date?${params.toString()}`)
        .then((data) => {
          if (data.status === 'success' || data.success) {
            const resultData = data.data || data;
            const pagination = data.meta?.pagination || data.pagination || {};
            const currentPage = pagination.currentPage || 1;
            const pageLimit = pagination.limit || limit;
            const offsetStart = (currentPage - 1) * pageLimit;
            const rows = (Array.isArray(resultData) ? resultData : resultData?.data || []).map(
              (row: any, idx: number) => {
                const transformed = transformConsumerData(row);
                return {
                  ...transformed,
                  ['S.No']: offsetStart + idx + 1,
                };
              }
            );
            setConsumers(rows);
            setServerPagination({
              currentPage: pagination.currentPage || 1,
              totalPages: pagination.totalPages || 1,
              totalCount: pagination.totalCount || data.data.length,
              limit: pagination.limit || limit,
              hasNextPage: pagination.hasNextPage || false,
              hasPrevPage: pagination.hasPrevPage || false,
            });
            setSelectedRows([]);
          } else {
            throw new Error(
              data.meta?.message ||
                data.error?.message ||
                data.message ||
                'Failed to fetch consumers'
            );
          }
        })
        .catch((err) => {
          console.error(err.message || 'Failed to fetch consumers');
          setConsumers([]);
          setServerPagination({
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            limit: 10,
            hasNextPage: false,
            hasPrevPage: false,
          });
          setErrors((prev) => {
            if (!prev.includes('Failed to fetch consumers')) {
              const updated = [...prev, 'Failed to fetch consumers'];
              return updated;
            }
            return prev;
          });
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }

    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(limit));

    if (status) {
      params.append('status', status);
    }

    if (search && search.trim() !== '') {
      params.append('search', search.trim());
    }

    if (selectedStartDate && selectedEndDate) {
      params.append('startDate', selectedStartDate);
      params.append('endDate', selectedEndDate);
    }

    apiClient
      .get(`/consumers?${params.toString()}`)
      .then((data) => {
        if (data.status === 'success' || data.success) {
          const resultData = data.data || data;
          const pagination = data.meta?.pagination || data.pagination || {};
          const currentPage = pagination.currentPage || page;
          const pageLimit = pagination.limit || limit;
          const offsetStart = (currentPage - 1) * pageLimit;
          const rows = (Array.isArray(resultData) ? resultData : resultData?.data || []).map(
            (row: any, idx: number) => {
              const transformed = transformConsumerData(row);
              return {
                ...transformed,
                ['S.No']: offsetStart + idx + 1,
              };
            }
          );
          setConsumers(rows);
          setServerPagination({
            currentPage: pagination.currentPage || page,
            totalPages: pagination.totalPages || 1,
            totalCount: pagination.totalCount || data.data.length,
            limit: pagination.limit || limit,
            hasNextPage: pagination.hasNextPage || false,
            hasPrevPage: pagination.hasPrevPage || false,
          });
          setSelectedRows([]);
        } else {
          throw new Error(data.meta?.message || data.error?.message || 'Failed to fetch consumers');
        }
      })
      .catch((err) => {
        console.error(err.message || 'Failed to fetch consumers');
        setConsumers([]);
        setServerPagination({
          currentPage: 1,
          totalPages: 1,
          totalCount: 0,
          limit: 10,
          hasNextPage: false,
          hasPrevPage: false,
        });
        setErrors((prev) => {
          if (!prev.includes('Failed to fetch consumers')) {
            const updated = [...prev, 'Failed to fetch consumers'];
            return updated;
          }
          return prev;
        });
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const fetchConsumersWithDateRange = (startDate: string, endDate: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.append('page', '1');
    params.append('limit', '10');
    params.append('status', currentStatus);
    params.append('startDate', startDate);
    params.append('endDate', endDate);

    if (searchQuery.trim()) {
      params.append('search', searchQuery.trim());
    }

    fetch(`${BACKEND_URL}/consumers?${params.toString()}`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success') {
          const pagination = data.meta?.pagination || {};
          const currentPage = pagination.currentPage || 1;
          const pageLimit = pagination.limit || 10;
          const offsetStart = (currentPage - 1) * pageLimit;
          const rows = (data.data || []).map((row: any, idx: number) => {
            const transformed = transformConsumerData(row);
            return {
              ...transformed,
              ['S.No']: offsetStart + idx + 1,
            };
          });
          setConsumers(rows);
          setServerPagination({
            currentPage: 1,
            totalPages: pagination.totalPages || 1,
            totalCount: pagination.totalCount || data.data.length,
            limit: 10,
            hasNextPage: pagination.hasNextPage || false,
            hasPrevPage: false,
          });
          setSelectedRows([]);
        } else {
          throw new Error(data.meta?.message || data.error?.message || 'Failed to fetch consumers');
        }
      })
      .catch((err) => {
        console.error(err.message || 'Failed to fetch consumers');
        setConsumers([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };
  const handleExportToExcel = async () => {
    try {
      setIsExporting(true);

      const allSourceRows: any[] = [];
      const limitPerPage = 100;
      let page = 1;
      let hasMoreData = true;

      while (hasMoreData) {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limitPerPage));
        params.append('status', currentStatus);
        if (searchQuery && searchQuery.trim() !== '') {
          params.append('search', searchQuery.trim());
        }
        if (selectedStartDate && selectedEndDate) {
          params.append('startDate', selectedStartDate);
          params.append('endDate', selectedEndDate);
        } else if (selectedDate && selectedDate.trim()) {
          params.append('date', selectedDate.trim());
        }

        const endpoint = `/consumers?${params.toString()}`;
        const data = await apiClient.get(endpoint);

        if (data.status === 'success' || data.success) {
          const resultData = data.data || data;
          const pageRows = (
            Array.isArray(resultData) ? resultData : resultData?.data || []
          ).map(transformConsumerData);
          
          allSourceRows.push(...pageRows);
          if (pageRows.length < limitPerPage) {
            hasMoreData = false;
          } else {
            page++;
          }
        } else {
          throw new Error(
            data.meta?.message ||
              data.error?.message ||
              data.message ||
              'Failed to fetch consumers for export'
          );
        }
      }

      if (allSourceRows.length > 0) {
        let sourceRows: any[] = allSourceRows;
        if (menuValue === 'high-usage') {
          sourceRows = sourceRows.filter((consumer: any) => {
            const reading = consumer['Consumption(kWh)'] || consumer.reading;
            return reading && typeof reading === 'string' && parseFloat(reading) > 1000;
          });
        }

        const excelData = sourceRows.map((consumer: any, index: number) => ({
          'S.No': index + 1,
          'Consumer Number':
            consumer['Consumer Number'] || consumer.consumerNumber || consumer.consumer_number,
          UID: consumer['UID'] || consumer.uid,
          'Consumer Name': consumer['Consumer Name'] || consumer.name,
          'Meter SI No': consumer['Meter SI No'] || consumer.meter || consumer.meterNumber,
          'Consumption(kWh)': consumer['Consumption(kWh)'] || consumer.reading || '0',
          'Consumption(KVAh)': consumer['Consumption(KVAh)'] || consumer.kvahConsumption || '0',
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        worksheet['!cols'] = [
          { wch: 8 },
          { wch: 15 },
          { wch: 15 },
          { wch: 25 },
          { wch: 15 },
          { wch: 18 },
          { wch: 18 },
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Consumers List');

        const excelBuffer = XLSX.write(workbook, {
          type: 'array',
          bookType: 'xlsx',
        });
        const blob = new Blob([excelBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;

        let filename = 'consumers_list';
        if (selectedStartDate && selectedEndDate) {
          filename += `_${selectedStartDate}_to_${selectedEndDate}`;
        } else if (selectedDate) {
          filename += `_${selectedDate}`;
        }
        if (menuValue === 'high-usage') {
          filename += '_high_usage';
        }
        filename += `.xlsx`;

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('No consumers found to export');
      }
    } catch (error) {
      console.error('Error exporting consumers:', error);
      setErrors((prev) => {
        if (!prev.includes('Failed to export consumers')) {
          const updated = [...prev, 'Failed to export consumers'];
          return updated;
        }
        return prev;
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportEmptyExcel = async () => {
    try {
      setLoading(true);

      const templateData = [
        {
          'S.No': 1,
          'Consumer Number': '',
          UID: '',
          'Consumer Name': '',
          'Meter SI No': '',
          'Consumption(kWh)': '',
          'Consumption(KVAh)': '',
        },
      ];

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(templateData);

      worksheet['!cols'] = [
        { wch: 8 },
        { wch: 15 },
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 18 },
        { wch: 18 },
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Consumer Template');

      const excelBuffer = XLSX.write(workbook, {
        type: 'array',
        bookType: 'xlsx',
      });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'consumer_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting empty template:', error);
      setErrors((prev) => {
        if (!prev.includes('Failed to export template')) {
          const updated = [...prev, 'Failed to export template'];
          return updated;
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const statusParam = (searchParams.get('status') as 'occupied' | 'vacant') || 'occupied';
    const dateParam = searchParams.get('date') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    setSearchQuery(search);
    setIsSearchFiltered(search.trim() !== '');
    setServerPagination((prev) => ({ ...prev, currentPage: page, limit }));
    setCurrentStatus(statusParam);
    if (dateParam) setSelectedDate(dateParam);

    if (startDate) {
      setSelectedStartDate(startDate);
    }
    if (endDate) {
      setSelectedEndDate(endDate);
    }

    if (startDate && endDate) {
      fetchConsumersWithDateRange(startDate, endDate);
    } else {
      fetchConsumers(page, limit, statusParam, search);
    }
  }, []);

  const updateURL = (
    page: number,
    limit: number,
    search: string,
    startDate?: string,
    endDate?: string
  ) => {
    const newSearchParams = new URLSearchParams();
    if (page > 1) newSearchParams.set('page', page.toString());
    if (limit !== 10) newSearchParams.set('limit', limit.toString());
    if (search.trim()) newSearchParams.set('search', search.trim());
    if (currentStatus !== 'occupied') newSearchParams.set('status', currentStatus);
    if (selectedDate && selectedDate.trim()) newSearchParams.set('date', selectedDate.trim());
    if (startDate && startDate.trim()) newSearchParams.set('startDate', startDate.trim());
    if (endDate && endDate.trim()) newSearchParams.set('endDate', endDate.trim());

    setSearchParams(newSearchParams, { replace: true });
  };

  useEffect(() => {
    if (selectedDate) {
      updateURL(1, serverPagination.limit, searchQuery);
      fetchConsumers(1, serverPagination.limit, currentStatus, searchQuery);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedStartDate && selectedEndDate) {
      updateURL(1, serverPagination.limit, searchQuery, selectedStartDate, selectedEndDate);
      fetchConsumersWithDateRange(selectedStartDate, selectedEndDate);
    }
  }, [selectedStartDate, selectedEndDate]);

  useEffect(() => {
    if (location.pathname === '/consumers/high-usage') {
      setMenuValue('high-usage');
    } else if (params.consumerNumber && params.consumerNumber !== 'high-usage') {
    }
  }, [location.pathname, params.consumerNumber]);

  const filteredConsumers =
    menuValue === 'high-usage'
      ? consumers.filter((consumer) => {
          const reading = consumer['Consumption(kWh)'] || consumer.reading;
          return reading && typeof reading === 'string' && parseFloat(reading) > 1000;
        })
      : consumers;

  const handlePageChange = (page: number, limit?: number) => {
    const newLimit = limit || serverPagination.limit;
    updateURL(page, newLimit, searchQuery, selectedStartDate, selectedEndDate);
    fetchConsumers(page, newLimit, currentStatus, searchQuery);
  };

  // Cleanup search debounce on unmount (same as LSData)
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Search consumers for dropdown using same API pattern as LSData
  // const searchConsumers = async (query: string, limit: number = 10) => {
  //   if (!query.trim() || query.trim().length < 2) {
  //     setSearchResults([]);
  //     return;
  //   }
  //   setIsSearching(true);
  //   try {
  //     const trimmedQuery = query.trim();
  //     const data = await apiClient.get(
  //       `/consumers/search?query=${encodeURIComponent(trimmedQuery)}&limit=${limit}`
  //     );
  //     if (!(data && (data.success || data.status === 'success') && Array.isArray(data.data) && data.data.length > 0)) {
  //       setSearchResults([]);
  //       return;
  //     }
  //     const mappedResults = data.data.map((item: any, index: number) => {
  //       const consumerNumber = item.consumerNumber ?? item.consumer_number ?? 'N/A';
  //       const meterNumber = item.meterNumber ?? item.meter?.meterNumber ?? 'N/A';
  //       return {
  //         id: `consumer-${index}`,
  //         name: `${consumerNumber} • ${meterNumber}`,
  //         consumerNumber,
  //         meterNumber,
  //         uid: item.uid || consumerNumber,
  //         meterId: item.meterId ?? item.meter?.meterId ?? null,
  //         _originalData: item,
  //       };
  //     });
  //     setSearchResults(mappedResults);
  //   } catch (error) {
  //     console.error('Search error:', error);
  //     setSearchResults([]);
  //   } finally {
  //     setIsSearching(false);
  //   }
  // };

  // const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value;
  //   setSearchValue(value);
  //   if (searchTimeoutRef.current) {
  //     clearTimeout(searchTimeoutRef.current);
  //     searchTimeoutRef.current = null;
  //   }
  //   if (value.trim().length >= 2) {
  //     searchTimeoutRef.current = setTimeout(() => {
  //       searchConsumers(value, 10);
  //     }, 300);
  //   } else {
  //     setSearchResults([]);
  //     setIsSearching(false);
  //   }
  // };

  // const handleSearchResultClick = (result: any) => {
  //   if (searchTimeoutRef.current) {
  //     clearTimeout(searchTimeoutRef.current);
  //     searchTimeoutRef.current = null;
  //   }
  //   const displayValue =
  //     result.name ||
  //     `${result.consumerNumber || 'N/A'} • ${result.meterNumber || 'N/A'}`;
  //   setSearchValue(displayValue);
  //   setSearchResults([]);
  //   setIsSearching(false);
  //   const consumerNumber = result.consumerNumber ?? result._originalData?.consumerNumber ?? result._originalData?.consumer_number;
  //   if (consumerNumber) {
  //     navigate(`/consumers/${consumerNumber}`);
  //   }
  // };

  // const handleGlobalSearch = async (query?: string) => {
  //   const q = (query ?? searchValue).trim();
  //   if (!q || q.length < 2) return;
  //   try {
  //     const data = await apiClient.get(
  //       `/consumers/search?query=${encodeURIComponent(q)}`
  //     );
  //     if (!(data && (data.success || data.status === 'success') && Array.isArray(data.data) && data.data.length > 0)) {
  //       alert(`No results found for "${q}". Please check your search term.`);
  //       return;
  //     }
  //     const first = data.data[0];
  //     const consumerNumber = first.consumerNumber ?? first.consumer_number;
  //     if (consumerNumber) {
  //       navigate(`/consumers/${consumerNumber}`);
  //       setSearchValue(
  //         first.consumerNumber && first.meterNumber
  //           ? `${first.consumerNumber} • ${first.meterNumber}`
  //           : first.consumerNumber || first.meterNumber || q
  //       );
  //       setSearchResults([]);
  //       return;
  //     }
  //     alert(`No consumer mapping found for "${q}". Please refine your search.`);
  //   } catch (error) {
  //     console.error('Global search error:', error);
  //     alert('Search failed. Please try again.');
  //   }
  // };

  const handleSearch = (searchTerm: string) => {
    setSearchQuery(searchTerm);
    setIsSearchFiltered(searchTerm.trim() !== '');
    updateURL(1, serverPagination.limit, searchTerm, selectedStartDate, selectedEndDate);
    fetchConsumers(1, serverPagination.limit, currentStatus, searchTerm);
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const removeError = (indexToRemove: number) => {
    setErrors((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const retryAllAPIs = () => {
    clearErrors();
    window.location.reload();
  };

  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedRows(selectedIds);
  };

  const statusOptions = [
    { value: '', label: 'Select Status' },
    { value: 'occupied', label: 'Occupied' },
    { value: 'vacant', label: 'Vacant' },
  ];

  const handleStatusSubmit = async (selectedIds: string[], status: string) => {
    if (selectedIds.length === 0) {
      alert('Please select at least one consumer to update status');
      return;
    }

    if (!status) {
      alert('Please select a status to update');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to update ${selectedIds.length} consumer(s) to ${status}?`
    );

    if (confirmed) {
      try {
        const result = await apiClient.post('/consumers/update-status', {
          ids: selectedIds,
          status,
        });

        alert(
          `Successfully updated ${
            result.data?.updatedCount || selectedIds.length
          } consumer(s) to ${status}!`
        );

        setSelectedRows([]);
        fetchConsumers(1, serverPagination.limit, currentStatus, searchQuery);
      } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status. Please try again.');
      }
    }
  };

  const handleYearRangeChange = (_dates: any, dateStrings: [string, string]) => {
    if (dateStrings && dateStrings[0] && dateStrings[1]) {
      setSelectedStartDate(dateStrings[0]);
      setSelectedEndDate(dateStrings[1]);

      updateURL(1, serverPagination.limit, searchQuery, dateStrings[0], dateStrings[1]);
      fetchConsumersWithDateRange(dateStrings[0], dateStrings[1]);
    }
  };

  const handleBulkUploadSubmit = (formData: any) => {
    const { uploadFile } = formData;

    if (!uploadFile) {
      setErrors((prev) => [...prev, 'Please upload a file']);
      return;
    }

    if (uploadFile instanceof File) {
      const allowedTypes = ['.xlsx', '.xls', '.csv'];
      const fileExtension = '.' + uploadFile.name.split('.').pop()?.toLowerCase();

      if (!allowedTypes.includes(fileExtension)) {
        setErrors((prev) => [
          ...prev,
          'Please upload Excel (.xlsx, .xls) or CSV (.csv) files only',
        ]);
        return;
      }

      setErrors((prev) => [...prev, 'Bulk upload functionality not yet implemented']);
    }

    setIsBulkUploadModalOpen(false);
  };

  const handleCloseBulkUploadModal = () => {
    setIsBulkUploadModalOpen(false);
  };

  const headerConfig = {
    title: 'Consumers',
    subtitle: isSearchFiltered ? `Search results for "${searchQuery}"` : '',
    onBackClick: () => navigate('/dashboard'),
    backButtonText: 'Back to Dashboard',
    buttonsLabel: 'Export',
    // onClick: handleExportToExcel,
    variant: 'primary',
    buttons: [
      {
        label: 'Bulk Upload',
        variant: 'secondary',
        onClick: () => setIsBulkUploadModalOpen(true),
      },
      // {
      //   label: 'Add Consumer',
      //   variant: 'secondary',
      //   onClick: () => navigate('/consumers/add'),
      // },
      {
        label: isExporting ? 'Exporting...' : 'Export',
        variant: 'primary',
        onClick: handleExportToExcel,
        loading: isExporting,
      },
    ],
    // onClick: () => navigate('/consumers/add'),
    showMenu: true,
    showDropdown: true,
    datePickerWidth: 'w-48',
    // datePickers: [
    //     {
    //         id: 'monthRange1',
    //         type: 'month-range',
    //         value: '',
    //         startDate: monthRange1Start,
    //         endDate: monthRange1End,
    //         onRangeChange: (start: string, end: string) => {
    //             setMonthRange1Start(start);
    //             setMonthRange1End(end);
    //         },
    //         onChange: () => {}, // Required but not used for month-range
    //         placeholder: 'Select month range',
    //         className: 'w-56'
    //     },
    // ],
    menuItems: [
      { id: 'occupied', label: 'Occupied' },
      { id: 'vacant', label: 'Vacant' },
      //   { id: 'bulkUpload', label: 'Bulk Upload' },
      ...(selectedDate ? [{ id: 'clearDate', label: 'Clear Date' }] : []),
    ],
    // RangePicker configuration
    showRangePicker: true,
    rangePicker: {
      onChange: handleYearRangeChange,
      dateFormat: 'YYYY-MM-DD',
      picker: 'date',
    },
    onMenuItemClick: (itemId: string) => {
      if (itemId === 'exportData') {
        handleExportToExcel();
        return;
      }

      if (itemId === 'exportEmpty') {
        handleExportEmptyExcel();
        return;
      }

      //   if (itemId === 'bulkUpload') {
      //   setIsBulkUploadModalOpen(true);
      //   return;
      // }

      if (itemId === 'clearDate') {
        setSelectedDate('');
        return;
      }

      setMenuValue(itemId);
      const newStatus = itemId === 'vacant' ? 'vacant' : 'occupied';
      setCurrentStatus(newStatus);

     fetchConsumers(1, 10, newStatus, searchQuery);
      updateURL(1, 10, searchQuery, selectedStartDate, selectedEndDate);
    },
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="min-h-screen">
        <Page
          sections={[
            ...(errorMessages.length > 0
              ? [
                  {
                    layout: {
                      type: 'column',
                      gap: 'gap-4',
                      rows: [
                        {
                          layout: 'column',
                          gap: 'gap-4',
                          columns: [
                            {
                              name: 'Error',
                              props: {
                                visibleErrors: errorMessages,
                                onRetry: retryAllAPIs,
                                onClose: () => removeError(0),
                                showRetry: true,
                                maxVisibleErrors: 3,
                              },
                            },
                          ],
                        },
                      ],
                    },
                  },
                ]
              : []),
            {
              layout: {
                type: 'column',
                gap: 'gap-4',
                rows: [
                  {
                    layout: 'column',
                    gap: 'gap-4',
                    columns: [
                      {
                        name: 'PageHeader',
                        props: headerConfig,
                      },
                    ],
                  },
                  // {
                  //   layout: 'column',
                  //   gap: 'gap-4',
                  //   className: 'w-full border border-primary-border dark:border-dark-border rounded-lg p-4 bg-background-secondary dark:bg-primary-dark-light justify-between',
                  //   rows: [
                  //     {
                  //       layout: 'row',
                  //       className: 'w-full items-center justify-between',
                  //       columns: [
                  //         {
                  //           name: 'PageHeader',
                  //           props: {
                  //             title: 'Search Consumer',
                  //             titleClassName: 'text-md font-semibold text-text-primary dark:text-white m-0',
                  //           },
                  //         },
                  //       ],
                  //     },
                  //     {
                  //       layout: 'row',
                  //       className: 'items-center',
                  //       columns: [
                  //         {
                  //           name: 'Search',
                  //           props: {
                  //             placeholder: 'Enter consumer number or meter number',
                  //             value: searchValue,
                  //             onChange: handleSearchChange,
                  //             results: searchResults,
                  //             isLoading: isSearching,
                  //             onResultClick: handleSearchResultClick,
                  //             showShortcut: false,
                  //             className: 'max-w-md',
                  //           },
                  //         },
                  //         {
                  //           name: 'Button',
                  //           props: {
                  //             label: 'Search',
                  //             variant: 'primary',
                  //             onClick: () => handleGlobalSearch(),
                  //             disabled: !searchValue.trim(),
                  //           },
                  //         },
                  //       ],
                  //     },
                  //   ],
                  // },
                  {
                    layout: 'column',
                    gap: 'gap-4',
                    className: 'w-full',
                    columns: [
                      {
                        name: 'Modal',
                        props: {
                          isOpen: isBulkUploadModalOpen,
                          onClose: handleCloseBulkUploadModal,
                          title: 'Upload Consumers',
                          size: 'sm',
                          showCloseIcon: true,
                          backdropClosable: true,
                          centered: true,
                          showForm: true,
                          formFields: [
                            {
                              type: 'chosenfile' as const,
                              // label: "Upload Excel File",
                              name: 'uploadFile',
                              required: true,
                              accept: '.xlsx,.xls,.csv',
                              placeholder: 'Choose Excel or CSV file',
                              onChange: () => {
                                // Handle file selection
                              },
                              downloadLink: {
                                text: 'Download Template',
                                icon: 'download',
                                onClick: handleExportEmptyExcel,
                              },
                            },
                          ],
                          onSave: handleBulkUploadSubmit,
                          saveButtonLabel: 'Submit',
                          cancelButtonLabel: 'Cancel',
                          gridLayout: {
                            gridRows: 2,
                            gridColumns: 1,
                            gap: 'gap-4',
                          },
                        },
                      },
                    ],
                  },
                  {
                    layout: 'column',
                    gap: 'gap-4',
                    columns: [
                      {
                        name: 'Table',
                        props: {
                          data: filteredConsumers,
                          columns: isMeterConsumptionView
                            ? meterConsumptionColumns
                            : defaultColumns,
                          loading: loading,
                          searchable: true,
                          sortable: true,
                          pagination: true,
                          showActions: true,
                          showHeader: true,
                          headerTitle: 'Consumer List',
                          showFilterButton: true,
                          serverPagination: serverPagination,
                          onPageChange: handlePageChange,
                          onSearch: handleSearch,
                          onView: (row: TableData) =>
                            navigate(`/consumers/${row['Consumer Number']}`),
                          onRowClick: (row: TableData) => {
                            navigate(`/consumers/${row['Consumer Number']}`);
                          },
                          dateRange: isMeterConsumptionView
                            ? `Meters with ${filterConsumptionValue} kWh consumption on ${filterDate}`
                            : isFiltered
                            ? `Filtered by: ${filterDate} (${filterConsumptionValue} kWh)`
                            : selectedStartDate && selectedEndDate
                            ? `Date Range: ${selectedStartDate} to ${selectedEndDate}`
                            : '',
                          text: 'Consumer Management Table',
                          className: 'w-full',
                          emptyMessage: loading ? 'Loading consumers...' : 'No consumers found',
                          initialRowsPerPage: 10,
                          itemsPerPage: 10,
                          showPagination: true,
                          pageSize: 10,
                          totalCount: serverPagination.totalCount,
                          currentPage: serverPagination.currentPage,
                          totalPages: serverPagination.totalPages,
                          selectable: true,
                          selectedRows: selectedRows,
                          onSelectionChange: handleSelectionChange,
                          statusOptions: statusOptions,
                          onStatusSubmit: handleStatusSubmit,
                          statusDropdownPlaceholder: 'Select Status for Bulk Update',
                          onFilterApply: (selectedIds: string[]) => {
                            setAppliedFilters(selectedIds);
                          },
                          appliedFilters: appliedFilters,
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ]}
        />
      </div>
    </Suspense>
  );
};

export default Consumers;
