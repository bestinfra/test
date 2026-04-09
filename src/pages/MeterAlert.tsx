import React, { useState, useEffect, lazy } from "react";
// import { useNavigate } from "react-router-dom";
const Page = lazy(() => import("SuperAdmin/Page"));
import { apiClient } from "../api/apiUtils";
// import dayjs from "dayjs";
// Dummy data for fallback
type AlertTypeOption = {
    value: string;
    label: string;
};

const dummyFilterOptions: {
    statusOptions: { value: string; label: string }[];
    alertTypeOptions: AlertTypeOption[];
} = {
    statusOptions: [
        { value: "all", label: "All Status" },
        { value: "active", label: "Active" },
        { value: "resolved", label: "Resolved" },
    ],
    // No default "Select" option; alert types will come from API
    alertTypeOptions: [],
};
const disableDate = (current: any) => {
    if (!current) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDate = new Date(current.valueOf());
    currentDate.setHours(0, 0, 0, 0);
    return currentDate > today;
  };

// Helper to get today's date as YYYY-MM-DD (for default filters)
const getTodayStr = () => {
    const t = new Date();
    const year = t.getFullYear();
    const month = String(t.getMonth() + 1).padStart(2, "0");
    const day = String(t.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const MeterAlert: React.FC = () => {


    // Filter states - Initialize with empty values (user must select both tamper type and date range)
    const [filterValues, setFilterValues] = useState({
        meterId: "",
        status: "all",
        dateRange: {
            start: getTodayStr(),
            end: getTodayStr(),
        },
        alertType: "all", // User must select a tamper type
    });
    // Track date toggle selection separately so alertType defaults can respect it
    const [dateToggleSelection, setDateToggleSelection] = useState<'today' | 'yesterday'>('today');

    // Data states
    const [alertTableData, setAlertTableData] = useState<any[]>([]);
    const [alertTableColumns, setAlertTableColumns] = useState<any[]>([]);
    const [filterOptions, setFilterOptions] = useState(dummyFilterOptions);
    const [isTamperOptionsLoading, setIsTamperOptionsLoading] = useState(false);

    const handleExportData = () => {
        import('xlsx').then((XLSX) => {
            // Format data using dynamic columns
            const excelData = alertTableData.map((alert: any, _index: number) => {
                const row: any = {};
                alertTableColumns.forEach((col) => {
                    const value = alert[col.key];
                    row[col.label] = value !== undefined && value !== null ? value : 'N/A';
                });
                return row;
            });

            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(excelData);

            // Set column widths for better readability
            const colWidths = alertTableColumns.map(() => ({ wch: 15 }));
            worksheet['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(workbook, worksheet, 'Meter Events Report');

            // Generate Excel file
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

            // Generate filename based on selected report type and date range
            const reportLabel =
                filterOptions.alertTypeOptions.find((o) => o.value === filterValues.alertType)?.label ||
                filterValues.alertType ||
                'report';
            const safeReport = String(reportLabel).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
            let filename = safeReport || 'report';
            if (filterValues.dateRange.start && filterValues.dateRange.end) {
                filename += `_${filterValues.dateRange.start}_to_${filterValues.dateRange.end}`;
            } else if (filterValues.dateRange.start) {
                filename += `_from_${filterValues.dateRange.start}`;
            } else if (filterValues.dateRange.end) {
                filename += `_until_${filterValues.dateRange.end}`;
            }
            filename += '.xlsx';

            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        });
    };


    // Pagination states for table
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(100);
    const [totalRecords, setTotalRecords] = useState(0);

    // Loading states
    const [isTableLoading, setIsTableLoading] = useState(false);

    // Function to generate table columns dynamically based on data
    const generateColumnsFromData = (data: any[]): any[] => {
        if (!data || data.length === 0) {
            return [];
        }

        // Get all unique keys from the data
        const allKeys = new Set<string>();
        data.forEach((item) => {
            Object.keys(item).forEach((key) => allKeys.add(key));
        });

        // Convert keys to column definitions
        const columns = Array.from(allKeys).map((key) => {
            // Special handling for serial number columns - prefer sNo and skip slNo if sNo exists
            if (key === 'slNo' || key === 'slno') {
                // Skip slNo if sNo exists
                if (allKeys.has('sNo')) {
                    return null; // Skip this column, sNo will be used instead
                }
                return {
                    key,
                    label: 'S.No',
                };
            }

            if (key === 'sNo' || key === 'sno') {
                return {
                    key,
                    label: 'S.No',
                };
            }

            // Format key to label: use as-is if backend already sent a spaced label (e.g. "USC No", "Meter SLNo")
            // Otherwise convert camelCase/snake_case to Title Case
            let label: string;
            if (key.includes(' ')) {
                // Backend sent a pre-formatted label; use as-is to avoid "U S C No" etc.
                label = key.trim();
            } else {
                label = key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, (str) => str.toUpperCase())
                    .trim();
            }

            // Special label mappings (for camelCase keys that weren't caught above)
            const keyLower = key.toLowerCase();
            if (keyLower === 'dtrcode' || key === 'dtrCode' || key === 'DtrCode' || key === 'DTRCode') {
                label = 'DTR Code';
            } else if (keyLower === 'landmark' || key === 'landMark' || label === 'Land Mark') {
                label = 'Landmark';
            } else if (keyLower === 'cap') {
                label = 'Capacity';
            } else if (keyLower === 'meterslno' || keyLower === 'meterserialno' || label === 'Meter S L No' || label === 'Meter Sl No') {
                label = 'Meter SL No';
            } else if (keyLower === 'uscno' || keyLower === 'usc' || label === 'U S C No' || label === 'Usc No') {
                label = 'USC No';
            } else if (label.match(/Number\s+Of/i) || label.match(/Number\s+of/i)) {
                label = label.replace(/Number\s+Of/gi, 'No: of').replace(/Number\s+of/gi, 'No: of');
            }

            // Special handling for status column
            if (key.toLowerCase() === 'status') {
                return {
                    key,
                    label,
                    statusIndicator: {
                        activeColor: 'bg-secondary',
                        inactiveColor: 'bg-danger',
                    },
                    isActive: (value: string) => {
                        const v = (value || '').toString().toLowerCase();
                        return v === 'resolved';
                    },
                };
            }

            return {
                key,
                label,
            };
        }).filter((col) => col !== null) as any[]; // Remove null entries

        // Sort columns to have common fields first
        const columnOrder = ['slNo', 'sNo', 'dtrCode', 'dtrId', 'meterId', 'meter', 'landMark', 'status', 'duration', 'dtTime', 'date', 'occurredOn'];
        const orderedColumns: any[] = [];
        const remainingColumns: any[] = [];

        columnOrder.forEach((orderKey) => {
            const found = columns.find((col) => col.key === orderKey);
            if (found) {
                orderedColumns.push(found);
            }
        });

        columns.forEach((col) => {
            if (!columnOrder.includes(col.key)) {
                remainingColumns.push(col);
            }
        });

        return [...orderedColumns, ...remainingColumns];
    };

    // Helper function to ensure date is in YYYY-MM-DD format
    const formatDateForAPI = (dateValue: any): string => {
        if (!dateValue) return "";
        
        // If already in YYYY-MM-DD format, return as is
        if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return dateValue;
        }
        
        // Handle dayjs objects (common in date pickers)
        if (dateValue && typeof dateValue.format === 'function') {
            return dateValue.format('YYYY-MM-DD');
        }
        
        // Handle Date objects
        if (dateValue instanceof Date) {
            const year = dateValue.getFullYear();
            const month = String(dateValue.getMonth() + 1).padStart(2, '0');
            const day = String(dateValue.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        // Handle string dates - try to parse various iformats
        if (typeof dateValue === 'string') {
            // Try parsing as Date
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            
            // Try parsing DD/MM/YYYY format
            const ddmmyyyyMatch = dateValue.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (ddmmyyyyMatch) {
                const [, day, month, year] = ddmmyyyyMatch;
                return `${year}-${month}-${day}`;
            }
            const yyyymmddMatch = dateValue.match(/(\d{4})\/(\d{2})\/(\d{2})/);
            if (yyyymmddMatch) {
                const [, year, month, day] = yyyymmddMatch;
                return `${year}-${month}-${day}`;
            }
        }
        
        // If all parsing fails, return empty string
        return "";
    };
    const fetchTableData = async (_page: number = 1, size: number = 25, updatePageSize: boolean = false) => {
        // Only fetch if both date range and tamper type are selected (alertType must not be "all")
        if (!filterValues.dateRange.start || !filterValues.dateRange.end || !filterValues.alertType || filterValues.alertType === "all") {
            setAlertTableData([]);
            setAlertTableColumns([]);
            setTotalRecords(0);
            return;
        }

        setIsTableLoading(true);
        try {
            const params = new URLSearchParams();
            // Ensure dates are in correct format before passing to API (YYYY-MM-DD)
            const startDate = formatDateForAPI(filterValues.dateRange.start);
            const endDate = formatDateForAPI(filterValues.dateRange.end);
            
            // Validate dates are in correct format before making API call
            if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
                setAlertTableData([]);
                setAlertTableColumns([]);
                setTotalRecords(0);
                setIsTableLoading(false);
                return;
            }
            
            params.append("startDate", startDate);
            params.append("endDate", endDate);
            params.append("alertType", String(filterValues.alertType));

            const endpoint = `/alerts/tamper-events?${params.toString()}`;
            const response = await apiClient.get(endpoint);

            // API response format:
            // { success: boolean, data: [...], pagination: {...}, message: string }
            const events = Array.isArray(response?.data)
                ? response.data
                : Array.isArray(response?.events)
                    ? response.events
                    : [];

            // Prefer backend totalCount if provided, otherwise fall back to array length
            const totalCount =
                typeof response?.pagination?.totalCount === 'number'
                    ? response.pagination.totalCount
                    : events.length;
            setTotalRecords(totalCount);

            const mappedData = events.map((item: any, idx: number) => ({
                ...item,
                sNo: item?.sNo ?? idx + 1,
            }));

            setAlertTableData(mappedData);
            setAlertTableColumns(generateColumnsFromData(mappedData));

            if (updatePageSize) {
                const totalCount = mappedData.length;
                setPageSize(totalCount > 0 ? (totalCount <= 100 ? totalCount : 100) : size);
            }
        } catch (err: any) {
            setAlertTableData([]);
            setAlertTableColumns([]);
            setTotalRecords(0);
        } finally {
            setIsTableLoading(false);
        }
    };

    // Filter change handlers
    const handleFilterChange = (filterName: string, value: any) => {
        const actualValue =
            typeof value === "string" ? value : value?.target?.value || value;

        // If an alertType (other than 'all') is selected and no date range is set,
        // default to the current date toggle selection (today/yesterday) and let useEffect trigger the API fetch.
        if (filterName === 'alertType') {
            if (actualValue && actualValue !== 'all' && (!filterValues.dateRange.start || !filterValues.dateRange.end)) {
                const t = new Date();
                const target = new Date(t);
                if (dateToggleSelection === 'yesterday') {
                    target.setDate(t.getDate() - 1);
                }
                const dateStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
                setFilterValues((prev) => ({
                    ...prev,
                    alertType: actualValue,
                    dateRange: { start: dateStr, end: dateStr },
                }));
                return;
            }

            setFilterValues((prev) => ({
                ...prev,
                alertType: actualValue,
            }));
            return;
        }

        // Default setter for other filters
        setFilterValues((prev) => ({
            ...prev,
            [filterName]: actualValue,
        }));
    };

    // Wrapper for PageHeader RangePicker - handles multiple callback formats
    const handlePageHeaderDateRangeChange = (datesOrStart: any, dateStringsOrEnd?: [string, string] | string | null) => {
        let startDate = "";
        let endDate = "";
        
        // Handle different input formats from RangePicker
        // Case 1: Called with (dates, dateStrings) - dateStrings array (most common format from antd/date pickers)
        if (dateStringsOrEnd && Array.isArray(dateStringsOrEnd) && dateStringsOrEnd.length === 2 && dateStringsOrEnd[0] && dateStringsOrEnd[1]) {
            startDate = formatDateForAPI(dateStringsOrEnd[0]);
            endDate = formatDateForAPI(dateStringsOrEnd[1]);
        } 
        // Case 2: Called with (start, end) as separate string parameters
        else if (typeof datesOrStart === 'string' && typeof dateStringsOrEnd === 'string') {
            startDate = formatDateForAPI(datesOrStart);
            endDate = formatDateForAPI(dateStringsOrEnd);
        }
        // Case 3: dates array [start, end]
        else if (datesOrStart && Array.isArray(datesOrStart) && datesOrStart.length === 2 && datesOrStart[0] && datesOrStart[1]) {
            startDate = formatDateForAPI(datesOrStart[0]);
            endDate = formatDateForAPI(datesOrStart[1]);
        } 
        // Case 4: object format { start, end }
        else if (datesOrStart && typeof datesOrStart === 'object' && datesOrStart.start && datesOrStart.end) {
            startDate = formatDateForAPI(datesOrStart.start);
            endDate = formatDateForAPI(datesOrStart.end);
        }
        // Case 5: dates might be null/undefined (cleared)
        else if (!datesOrStart || (Array.isArray(datesOrStart) && datesOrStart.length === 0)) {
            // Don't update if dates are cleared
            return;
        }
        
        // Update filter values with formatted dates - this will trigger useEffect to call API
        if (startDate && endDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            setFilterValues((prev) => ({
                ...prev,
                dateRange: { 
                    start: startDate, 
                    end: endDate 
                },
            }));
        }
    };

    // Wrapper for customFilterOptions RangePicker
    const handleCustomFilterDateRangeChange = (dates: any, dateStrings: [string, string] | null) => {
        let startDate = "";
        let endDate = "";
        
        // Handle different input formats from RangePicker
        if (dateStrings && Array.isArray(dateStrings) && dateStrings.length === 2) {
            // Prefer dateStrings if available (already formatted strings from date picker)
            startDate = formatDateForAPI(dateStrings[0]);
            endDate = formatDateForAPI(dateStrings[1]);
        } else if (dates && Array.isArray(dates) && dates.length === 2) {
            // Fallback to dates array (dayjs objects or Date objects)
            startDate = formatDateForAPI(dates[0]);
            endDate = formatDateForAPI(dates[1]);
        } else if (dates && dates.start && dates.end) {
            // Handle object format { start, end }
            startDate = formatDateForAPI(dates.start);
            endDate = formatDateForAPI(dates.end);
        }
        
        // Update filter values with formatted dates - this will trigger useEffect to call API
        if (startDate && endDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            setFilterValues((prev) => ({
                ...prev,
                dateRange: { 
                    start: startDate, 
                    end: endDate 
                },
            }));
        }
    };

    // Track previous filter values to detect changes and avoid infinite loops
    const prevDateRangeRef = React.useRef({ start: filterValues.dateRange.start, end: filterValues.dateRange.end });
    const prevAlertTypeRef = React.useRef(filterValues.alertType);
    const isInitialMount = React.useRef(true);

    // Fetch data when date range, alertType, or pagination changes
    useEffect(() => {
        const dateRangeChanged = 
            prevDateRangeRef.current.start !== filterValues.dateRange.start ||
            prevDateRangeRef.current.end !== filterValues.dateRange.end;
        const alertTypeChanged = prevAlertTypeRef.current !== filterValues.alertType;

        // Check if both date range and alertType are selected
        const hasDateRange = filterValues.dateRange.start && filterValues.dateRange.end;
        const hasAlertType = filterValues.alertType && filterValues.alertType !== "all";

        // On initial mount, don't fetch (wait for user to select filters)
        if (isInitialMount.current) {
            isInitialMount.current = false;
            prevDateRangeRef.current = { 
                start: filterValues.dateRange.start, 
                end: filterValues.dateRange.end 
            };
            prevAlertTypeRef.current = filterValues.alertType;
            // Clear table on initial mount since no filters are selected
            setAlertTableData([]);
            setAlertTableColumns([]);
            setTotalRecords(0);
            return;
        }

        // If date range or alertType changed, reset to page 1
        if (dateRangeChanged || alertTypeChanged) {
            setCurrentPage(1);
            prevDateRangeRef.current = { 
                start: filterValues.dateRange.start, 
                end: filterValues.dateRange.end 
            };
            prevAlertTypeRef.current = filterValues.alertType;
        }

        // Only fetch if both date range and alertType are selected
        if (hasDateRange && hasAlertType) {
            if (dateRangeChanged || alertTypeChanged) {
                fetchTableData(1, pageSize, true); // Update pageSize when filters change
            } else {
                // Only pagination changed, fetch with current page
                fetchTableData(currentPage, pageSize, false); // Don't update pageSize on page change
            }
        } else {
            // Clear table if filters are not complete
            setAlertTableData([]);
            setAlertTableColumns([]);
            setTotalRecords(0);
        }
    }, [filterValues.dateRange.start, filterValues.dateRange.end, filterValues.alertType, currentPage, pageSize]);

    // Load tamper type dropdown options on mount
    useEffect(() => {
        let cancelled = false;
        const loadTamperTypeOptions = async () => {
            setIsTamperOptionsLoading(true);
            try {
                const options = await apiClient.get("/alerts/tamper-type-options");
                const apiOptions = Array.isArray(options) ? options : (options?.data || options?.options || []);
                const normalized = (Array.isArray(apiOptions) ? apiOptions : [])
                    .filter((o: any) => o && (o.value !== undefined && o.value !== null) && o.label)
                    .map((o: any) => ({ value: String(o.value), label: String(o.label) }));

                if (cancelled) return;
                // Use only API-provided alert types; no extra "Select" option in the dropdown
                setFilterOptions((prev) => ({
                    ...prev,
                    alertTypeOptions: normalized as AlertTypeOption[],
                }));
            } catch (_e) {
                // keep dummy fallback
            } finally {
                if (!cancelled) setIsTamperOptionsLoading(false);
            }
        };
        loadTamperTypeOptions();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <Page
                sections={[
                    // Error section - following pattern from MetersList.tsx
                    ...(false
                        ? [
                              {
                                  layout: {
                                      type: "column" as const,
                                      gap: "gap-6",
                                  },
                                  components: [
                                      {
                                          name: "Error",
                                          props: {
                                              visibleErrors: [''],
                                              onRetry: () => {},
                                              showRetry: true,
                                              maxVisibleErrors: 1,
                                          },
                                      },
                                  ],
                              },
                          ]
                        : []),
                    // Header section
                    {
                        layout: {
                            type: "grid" as const,
                            columns: 1,
                            className: "",
                        },
                        components: [
                            {
                                name: "PageHeader",
                                props: {
                                    title: "Reports",
                                    onBackClick: () => window.history.back(),
                                   
                                      variant: 'primary',
                                      backButtonText: 'Back to Dashboard',
                                      buttons: [
                                      
                                        {
                                            label: "Generate Report",
                                            variant: "secondary",
                                            onClick: () => {
                                                // Validate that both date range and alertType are selected
                                                if (!filterValues.dateRange.start || !filterValues.dateRange.end || !filterValues.alertType || filterValues.alertType === "all") {
                                                    // You can add a toast/notification here if needed
                                                    return;
                                                }
                                                // Reset to page 1 and fetch data with current filter values
                                                setCurrentPage(1);
                                                fetchTableData(1, pageSize, true); // Update pageSize when manually loading
                                            },
                                        },
                                        {
                                            label: "Download",
                                            variant: "primary",
                                            onClick: handleExportData,
                                        },
                                    ],

                                    showDateToggle: true,
                                    dateToggleProps: {
                                        value: dateToggleSelection,
                                        onChange: (value: 'today' | 'yesterday') => {
                                            // update toggle state so other logic can reference it
                                            setDateToggleSelection(value);
                                            // compute the selected date (YYYY-MM-DD) and update dateRange
                                            const t = new Date();
                                            const target = new Date(t);
                                            if (value === 'yesterday') {
                                                target.setDate(t.getDate() - 1);
                                            }
                                            const dateStr = `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(target.getDate()).padStart(2,'0')}`;
                                            console.log('Date toggle selected (YYYY-MM-DD):', dateStr);
                                            setFilterValues((prev) => ({
                                                ...prev,
                                                dateRange: { start: dateStr, end: dateStr },
                                            }));
                                        },
                                        options: [
                                            { value: 'today', label: 'Today' },
                                            { value: 'yesterday', label: 'Yesterday' },
                                        ],
                                        selectedClassName: 'bg-white dark:bg-primary-dark-light',
                                        className: 'bg-background-secondary dark:bg-primary-dark-light',
                                    },
                                    

                                      showRightDropdowns:true,
                                        rightDropdownsClassName : 'w-max-lg',
                                      rightDropdowns : [
                                       {
                                        type:'dropdown',
                                        options: filterOptions.alertTypeOptions,
                                    value: filterValues.alertType,
                                    searchable: true,
                                    onChange: (value: string) =>
                                        handleFilterChange("alertType", value),
                                    placeholder: "Select Alert Type",
                                    className: "w-max-xl",
                                    loading: isTamperOptionsLoading,
                                       }
                                      ],
                                      showRangePicker: true,
                                      rangePicker: {
                                          onChange: handlePageHeaderDateRangeChange,
                                          dateFormat: "YYYY-MM-DD",
                                          picker: "date",
                                          startDate: filterValues.dateRange.start,
                                          endDate: filterValues.dateRange.end,
                                          disabledDate:disableDate,
                                          id:{
                                            start: 'startInput',
                                            end: 'endInput',
                                          },
                                      },
                                    
                                },
                            },
                        ],
                    },


                    // Alert Table Section
                    {
                        layout: {
                            type: "grid" as const,
                            className:['height-2.5rem'],
                            columns: 1,

                        },
                        components: [
                            {
                                name: "Table",
                                props: {
                                    data: alertTableData,
                                    columns: alertTableColumns,
                                    showHeader: false,
                                    headerTitle: "Current Month Event Details",
                                    searchable: false,
                                    sortable: true,
                                    useStatusDurationMapping: true,
                                    initialRowsPerPage: pageSize,
                                    rowsPerPageOptions: [10, 20, 25, 50, 100],
                                    itemsPerPage: pageSize,
                                    showActions: true,
                                    
                                    text: "Events Management Table",
                                    customFilterOptions:[
                                       {
                                        label:'Tamper Type',
                                        type:"dropdown",
                                        options: filterOptions.alertTypeOptions,
                                        value: filterValues.alertType,
                                        onChange: (value: string) => {
                                            handleFilterChange("alertType", value);
                                        },
                                       },
                                        {
    
                                            label:'Date Range',
                                            type:'rangePicker',
                                            placeholder:'Select Date Range',
                                            startDate: filterValues.dateRange.start,
                                            endDate: filterValues.dateRange.end,
                                            onChange: handleCustomFilterDateRangeChange,
                                        },
                                    ],
                                    onRowClick: undefined,
                                    onView: undefined,
                                    showPagination: true,
                                    currentPage: currentPage,
                                    totalRecords: totalRecords,
                                    pageSize: pageSize,
                                    onPageChange: (page: number) => setCurrentPage(page),
                                    onPageSizeChange: (size: number) => {
                                        setPageSize(size);
                                        setCurrentPage(1);
                                    },
                                    loading: isTableLoading,
                                    emptyMessage: (() => {
                                        const hasDateRange = filterValues.dateRange.start && filterValues.dateRange.end;
                                        const hasAlertType = filterValues.alertType && filterValues.alertType !== "all";
                                        
                                        if (!hasDateRange && !hasAlertType) {
                                            return "Please select a tamper type and date range to view events";
                                        } else if (!hasDateRange) {
                                            return "Please select a date range to view events";
                                        } else if (!hasAlertType) {
                                            return "Please select a tamper type to view events";
                                        } else {
                                            return "No events found for the selected filters";
                                        }
                                    })(),
                                },
                                span: { col: 1, row: 1 },
                            },
                        ],
                    },
                ]}
            />
        </div>
    );
};

export default MeterAlert;
