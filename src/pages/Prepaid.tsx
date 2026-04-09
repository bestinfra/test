import { lazy } from 'react';
import { useState, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
const Page = lazy(() => import('SuperAdmin/Page'));
import BACKEND_URL from '../config';
const tableColumns = [
    { key: 'sNo', label: 'SI.No' },
    { key: 'meterNumber', label: 'Meter Number' },
    { key: 'uscNo', label: 'USC No' },
    { key: 'consumerName', label: 'Consumer Name' },
    { key: 'amount', label: 'Amount' },
    { key: 'date', label: 'Date' },
    {
        key: 'status',
        label: 'Status',
        render: (value: string) => (
            <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                    value === 'COMPLETED'
                        ? 'bg-positive text-white'
                        : 'bg-danger-light text-danger'
                }`}>
                {value}
            </span>
        ),
    },
];

const consumptionTableColumns = [
    { key: 's.no', label: 'S.No' },
    { key: 'meterNumber', label: 'Meter Number' },
    { key: 'uscNo', label: 'USC No' },
    { key: 'consumerName', label: 'Consumer Name' },
    {
        key: 'consumption',
        label: 'Consumption (kWh)',
        align: 'right' as const,
        render: (v: any) =>
            v != null && Number.isFinite(Number(v)) ? Number(v).toFixed(3) : '-',
    },
    {
        key: 'amount',
        label: 'Amount',
        align: 'right' as const,
        render: (v: any) => {
            const n = typeof v === 'number' ? v : Number(v);
            return Number.isFinite(n)
                ? new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                      maximumFractionDigits: 2,
                  }).format(n)
                : '-';
        },
    },
    { key: 'dateTime', label: 'Date & Time' },
];

export default function Prepaid() {
    const navigate = useNavigate();
    const [selectedTimeRange, setSelectedTimeRange] = useState('Daily');

    const isApiSuccess = (result: any) =>
        result?.success === true || result?.status === 'success';

    const toFiniteNumber = (value: any, fallback = 0) => {
        const n =
            typeof value === 'number'
                ? value
                : typeof value === 'string'
                  ? Number(value)
                  : NaN;
        return Number.isFinite(n) ? n : fallback;
    };

    const formatINR = (amount: number) => {
        const safe = Number.isFinite(amount) ? amount : 0;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(safe);
    };
    
    // Enhanced API state management (same pattern as Users page)
    const [failedApis, setFailedApis] = useState<
        Array<{
            id: string;
            name: string;
            retryFunction: () => Promise<void>;
            errorMessage: string;
        }>
    >([]);

    // ⬇ State for API data with smart fallbacks
    const [prepaidStats, setPrepaidStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    // ⬇ Recharge & usage stats (Today) comes from separate API
    const [rechargeStats, setRechargeStats] = useState<any>(null);
    const [rechargeLoading, setRechargeLoading] = useState(true);
    
    // Widget type mapping for card click navigation
    const WIDGET_TYPES = {
        cummulativeCurrentBalance: 'cummulativeCurrentBalance',
        lowBalance: 'lowBalance',
        adhocCredit: 'adhocCredit',
        adhocRecovered: 'adhocRecovered',
    } as const;

    const handleCardClick = (widgetType: string) => {
        navigate(`/bills/prepaid/detail/${widgetType}`);
    };

    // Enhanced card data with smart fallbacks and conditional rendering
    const cardData = [
        {
            title: 'Cummulative Current Balance',
            value: prepaidStats?.cumulativeBalance || "0",
            icon: 'icons/wallet.svg',
            subtitle1: prepaidStats ? `Across ${prepaidStats.totalConsumers || 0} Consumers` : 'N/A Consumers',
            widgetType: WIDGET_TYPES.cummulativeCurrentBalance,
        },
        {
            title: 'Low Balance Consumers',
            value: prepaidStats?.lowBalanceConsumers || "0",
            icon: 'icons/low-balance.svg',
            subtitle1: prepaidStats ? `Consumers Below ₹${prepaidStats.lowBalanceThreshold || 100}` : 'Consumers Below ₹100',
            widgetType: WIDGET_TYPES.lowBalance,
        },
        {
            title: 'Adhoc Credit Issued',
            value: prepaidStats?.adhocCreditIssued || "0",
            icon: 'icons/credit-issued.svg',
            subtitle1: prepaidStats ? `${prepaidStats.adhocCreditIssued || '₹0'} Issued to ${prepaidStats.adhocCreditConsumers || 0} Consumers` : '₹0 Issued to 0 Consumers',
            widgetType: WIDGET_TYPES.adhocCredit,
        },
        {
            title: 'Adhoc Credit Recovered',
            value: prepaidStats?.adhocCreditRecovered || "0",
            icon: 'icons/credit-recovered.svg',
            subtitle1: prepaidStats ? `${prepaidStats.adhocCreditRemaining || '₹0'} Remaining` : '₹0 Remaining',
            widgetType: WIDGET_TYPES.adhocRecovered,
        },
    ];

    // Enhanced recharge data - mapped to API response structure:
    // totalRechargeCollection: { todayAmount, yesterdayAmount, rechargesProcessed }
    // totalUnitsConsumed: { todayUnits, yesterdayUnits, metersCount }
    // totalAmountDeducted: { todayAmount, yesterdayAmount, consumersCount }
    // transactions: { todayCount, yesterdayCount, consumersCount }
    // alertsTriggered: { todayCount, yesterdayCount, alertsSentToday }
    // autoTriggeredDisconnects: { todayCount, yesterdayCount, consumersToday }
    const rc = rechargeStats?.totalRechargeCollection;
    const uc = rechargeStats?.totalUnitsConsumed;
    const ad = rechargeStats?.totalAmountDeducted;
    const tx = rechargeStats?.transactions;
    const al = rechargeStats?.alertsTriggered;
    const dc = rechargeStats?.autoTriggeredDisconnects;

    const rechargeData = [
        {
            title: 'Total Recharge Collection',
            value: formatINR(toFiniteNumber(rc?.todayAmount, 0)),
            icon: 'icons/total-recharge-collection.svg',
            subtitle1: rc ? `vs. ₹${toFiniteNumber(rc.yesterdayAmount, 0).toLocaleString('en-IN')} Yesterday` : 'vs. ₹0 Yesterday',
            subtitle2: rc ? `${rc.rechargesProcessed ?? 0} Recharges Processed` : '0 Recharges Processed',
            comparisonValue: toFiniteNumber(rc?.todayAmount, 0) - toFiniteNumber(rc?.yesterdayAmount, 0),
            showTrend: true,
            previousValue: rc ? `vs. ₹${toFiniteNumber(rc.yesterdayAmount, 0).toLocaleString('en-IN')} Yesterday` : 'vs. ₹0 Yesterday',
        },
        {
            title: 'Total Units Consumed',
            value: `${toFiniteNumber(uc?.todayUnits, 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kWh`,
            icon: 'icons/units-consumed.svg',
            subtitle1: uc ? `vs. ${toFiniteNumber(uc.yesterdayUnits, 0).toLocaleString('en-IN')} kWh Yesterday` : 'vs. 0 kWh Yesterday',
            subtitle2: uc ? `Consumed from ${uc.metersCount ?? 0} Meters` : 'Consumed from 0 Meters',
            comparisonValue: toFiniteNumber(uc?.todayUnits, 0) - toFiniteNumber(uc?.yesterdayUnits, 0),
            showTrend: true,
            previousValue: uc ? `vs. ${toFiniteNumber(uc.yesterdayUnits, 0).toLocaleString('en-IN')} kWh Yesterday` : 'vs. 0 kWh Yesterday',
        },
        {
            title: 'Total Amount Deducted',
            value: formatINR(toFiniteNumber(ad?.todayAmount, 0)),
            icon: 'icons/amount-deducted.svg',
            subtitle1: ad ? `vs. ₹${toFiniteNumber(ad.yesterdayAmount, 0).toLocaleString('en-IN')} Yesterday` : 'vs. ₹0 Yesterday',
            subtitle2: ad ? `Deducted from ${ad.consumersCount ?? 0} Consumers` : 'Deducted from 0 Consumers',
            comparisonValue: toFiniteNumber(ad?.todayAmount, 0) - toFiniteNumber(ad?.yesterdayAmount, 0),
            showTrend: true,
            previousValue: ad ? `vs. ₹${toFiniteNumber(ad.yesterdayAmount, 0).toLocaleString('en-IN')} Yesterday` : 'vs. ₹0 Yesterday',
        },
        {
            title: 'No.of Transactions',
            value: String(toFiniteNumber(tx?.todayCount, 0)),
            icon: 'icons/transactions.svg',
            subtitle1: tx ? `vs. ${tx.yesterdayCount ?? 0} Yesterday` : 'vs. 0 Yesterday',
            subtitle2: tx ? `Transactions From ${tx.consumersCount ?? 0} Consumers` : 'Transactions From 0 Consumers',
            comparisonValue: toFiniteNumber(tx?.todayCount, 0) - toFiniteNumber(tx?.yesterdayCount, 0),
            showTrend: true,
            previousValue: tx ? `vs. ${tx.yesterdayCount ?? 0} Yesterday` : 'vs. 0 Yesterday',
        },
        {
            title: 'Alerts Triggered',
            value: String(toFiniteNumber(al?.todayCount, 0)),
            icon: 'icons/alert-triggered.svg',
            subtitle1: al ? `vs. ${al.yesterdayCount ?? 0} Yesterday` : 'vs. 0 Yesterday',
            subtitle2: al ? `${al.alertsSentToday ?? 0} sent Today` : '0 sent Today',
            comparisonValue: toFiniteNumber(al?.todayCount, 0) - toFiniteNumber(al?.yesterdayCount, 0),
            showTrend: true,
            previousValue: al ? `vs. ${al.yesterdayCount ?? 0} Yesterday` : 'vs. 0 Yesterday',
        },
        {
            title: 'Auto Triggered Disconnects',
            value: String(toFiniteNumber(dc?.todayCount, 0)),
            icon: 'icons/disconnect.svg',
            subtitle1: dc ? `vs. ${dc.yesterdayCount ?? 0} Yesterday` : 'vs. 0 Yesterday',
            subtitle2: dc ? `${dc.consumersToday ?? 0} Consumers Today` : '0 Consumers Today',
            comparisonValue: toFiniteNumber(dc?.todayCount, 0) - toFiniteNumber(dc?.yesterdayCount, 0),
            showTrend: true,
            previousValue: dc ? `vs. ${dc.yesterdayCount ?? 0} Yesterday` : 'vs. 0 Yesterday',
        },
    ];

    // ⬇ State for Transactions Table (with server-side pagination & filters)
    const [tableData, setTableData] = useState<any[]>([]);
    const [tableLoading, setTableLoading] = useState(false);
    const [serverPagination, setServerPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        limit: 10,
        hasNextPage: false,
        hasPrevPage: false,
    });
    const [tableFilters, setTableFilters] = useState<{
        startMonth: string;
        endMonth: string;
        amountRange: string;
        status: string;
    }>({
        startMonth: '',
        endMonth: '',
        amountRange: '',
        status: '',
    });
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Consumption Details table state
    const [consumptionTableData, setConsumptionTableData] = useState<any[]>([]);
    const [consumptionLoading, setConsumptionLoading] = useState(false);
    const [consumptionPagination, setConsumptionPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        limit: 10,
        hasNextPage: false,
        hasPrevPage: false,
    });

    // Retry specific API function
    const retrySpecificAPI = (apiId: string) => {
        const api = failedApis.find((a) => a.id === apiId);
        if (api) {
            api.retryFunction();
        }
    };

    // Fetch Prepaid Stats (combines all data)
    useEffect(() => {
        const fetchPrepaidStats = async () => {
            setStatsLoading(true);
            try {
                const response = await fetch(`${BACKEND_URL}/prepaid/stats`, {
                  credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to fetch prepaid stats');
                const result = await response.json();
                if (!isApiSuccess(result))
                    throw new Error(result.message || 'Failed to fetch prepaid stats');

                // Normalize API shape -> UI shape
                const d = result?.data || {};
                const normalized = {
                    cumulativeBalance: formatINR(d?.cumulativeCurrentBalance?.amount ?? 0),
                    totalConsumers: d?.cumulativeCurrentBalance?.consumerCount ?? 0,
                    lowBalanceConsumers: d?.lowBalanceConsumers?.count ?? 0,
                    lowBalanceThreshold: d?.lowBalanceConsumers?.threshold ?? 100,
                    adhocCreditIssued: formatINR(d?.adhocCreditIssued?.amount ?? 0),
                    adhocCreditConsumers: d?.adhocCreditIssued?.consumerCount ?? 0,
                    adhocCreditRecovered: formatINR(d?.adhocCreditRecovered?.amount ?? 0),
                    adhocCreditRemaining: formatINR(d?.adhocCreditRecovered?.remaining ?? 0),
                };

                setPrepaidStats(normalized);
                console.log('Prepaid stats:', result.data);
                // Remove from failed APIs if successful
                setFailedApis((prev) => prev.filter((api) => api.id !== "stats"));
            } catch (err) {
                console.error(err instanceof Error ? err.message : 'Failed to fetch prepaid stats');
                setPrepaidStats(null);
                // Add to failed APIs
                setFailedApis((prev) => {
                    if (!prev.find((api) => api.id === "stats")) {
                        return [
                            ...prev,
                            {
                                id: "stats",
                                name: "Prepaid Statistics",
                                retryFunction: fetchPrepaidStats,
                                errorMessage: "Failed to load Prepaid Statistics. Please try again.",
                            },
                        ];
                    }
                    return prev;
                });
            } finally {
                setStatsLoading(false);
            }
        };
        fetchPrepaidStats();
    }, []);

    // Fetch Recharge & Usage (Today) stats (separate API)
    useEffect(() => {
        const period =
            selectedTimeRange?.toLowerCase() === 'monthly' ? 'monthly' : 'daily';

        const fetchRechargeStats = async () => {
            setRechargeLoading(true);
            try {
                const res = await fetch(
                    `${BACKEND_URL}/prepaid/recharge-stats?period=${period}`,
                    { credentials: 'include' }
                );
                if (!res.ok) throw new Error('Failed to fetch recharge stats');
                const json = await res.json();
                if (!isApiSuccess(json))
                    throw new Error(json.message || 'Failed to fetch recharge stats');

                setRechargeStats(json?.data ?? null);
                setFailedApis((prev) =>
                    prev.filter((api) => api.id !== 'rechargeStats')
                );
            } catch (error) {
                console.error(error);
                setRechargeStats(null);
                setFailedApis((prev) => {
                    if (!prev.find((api) => api.id === 'rechargeStats')) {
                        return [
                            ...prev,
                            {
                                id: 'rechargeStats',
                                name: 'Recharge & Usage Stats',
                                retryFunction: fetchRechargeStats,
                                errorMessage:
                                    'Failed to load Recharge & Usage (Today). Please try again.',
                            },
                        ];
                    }
                    return prev;
                });
            } finally {
                setRechargeLoading(false);
            }
        };

        fetchRechargeStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTimeRange]);

    const buildMonthParam = (raw: string) => {
        if (!raw) return '';
        // Support both "YYYY-MM" and "DD/MM/YYYY"
        if (raw.includes('-')) {
            const parts = raw.split('-');
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1]}`;
            }
        }
        if (raw.includes('/')) {
            const [ mm, yyyy] = raw.split('/');
            if (yyyy && mm) {
                return `${yyyy}-${mm}`;
            }
        }
        return raw;
    };

    /** Format YYYY-MM to "Mon YYYY" (e.g. 2024-01 -> Jan 2024) */
    const formatMonthForDisplay = (yyyyMm: string): string => {
        if (!yyyyMm) return '';
        const [y, m] = yyyyMm.split('-');
        if (!y || !m) return yyyyMm;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIdx = parseInt(m, 10) - 1;
        return `${monthNames[monthIdx >= 0 && monthIdx < 12 ? monthIdx : 0]} ${y}`;
    };

    const transactionsDateRange = (() => {
        const { startMonth, endMonth } = tableFilters;
        if (startMonth && endMonth) {
            return `${formatMonthForDisplay(startMonth)} - ${formatMonthForDisplay(endMonth)}`;
        }
        if (startMonth) return `From ${formatMonthForDisplay(startMonth)}`;
        if (endMonth) return `Until ${formatMonthForDisplay(endMonth)}`;
        if (tableData.length > 0) {
            const dates = tableData
                .map((r: any) => r.date)
                .filter((d): d is string => typeof d === 'string' && d !== 'N/A');
            if (dates.length > 0) {
                const sorted = [...dates].sort();
                const formatDateDisplay = (d: string) => {
                    try {
                        const [y, m, day] = d.split(/[-/]/);
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const mi = parseInt(m || '1', 10) - 1;
                        return `${day || ''} ${monthNames[mi >= 0 && mi < 12 ? mi : 0]} ${y || ''}`.trim();
                    } catch {
                        return d;
                    }
                };
                return `${formatDateDisplay(sorted[0])} - ${formatDateDisplay(sorted[sorted.length - 1])}`;
            }
        }
        return 'All time';
    })();

    // Fetch Transactions Table Data (server-side pagination + filters)
    const fetchTable = async (
        page = 1,
        limit = 10,
        overrideFilters?: typeof tableFilters
    ) => {
        setTableLoading(true);
        try {
            const activeFilters = overrideFilters || tableFilters;
            const params = new URLSearchParams();
            params.append('page', String(page));
            params.append('limit', String(limit));

            if (activeFilters.startMonth) {
                params.append('startMonth', activeFilters.startMonth);
            }
            if (activeFilters.endMonth) {
                params.append('endMonth', activeFilters.endMonth);
            }
            if (activeFilters.amountRange) {
                params.append('amountRange', activeFilters.amountRange);
            }
            if (activeFilters.status) {
                params.append('status', activeFilters.status.toUpperCase());
            }

            const res = await fetch(
                `${BACKEND_URL}/prepaid/transactions?${params.toString()}`,
                {
                    credentials: 'include',
                }
            );

            if (!res.ok) throw new Error('Failed to fetch transactions');
            const json = await res.json();

            const resultData = json.data || json;
            const pagination = json.meta?.pagination || json.pagination || {};
            const currentPage = pagination.currentPage || page;
            const pageLimit = pagination.limit || limit;
            const totalCount = pagination.totalCount || (Array.isArray(resultData) ? resultData.length : 0);
            const totalPages = pagination.totalPages || Math.max(1, Math.ceil(totalCount / pageLimit));
            const offsetStart = (currentPage - 1) * pageLimit;

            const rows = (Array.isArray(resultData) ? resultData : resultData?.data || []).map(
                (row: any, idx: number) => ({
                    ...row,
                    sNo: row.sNo ?? offsetStart + idx + 1,
                })
            );

            setTableData(rows);
            setServerPagination({
                currentPage,
                totalPages,
                totalCount,
                limit: pageLimit,
                hasNextPage: pagination.hasNextPage ?? currentPage < totalPages,
                hasPrevPage: pagination.hasPrevPage ?? currentPage > 1,
            });

            // Remove from failed APIs if successful
            setFailedApis((prev) => prev.filter((api) => api.id !== 'transactions'));
        } catch (error) {
            console.error(error);
            setTableData([]);
            setServerPagination({
                currentPage: 1,
                totalPages: 1,
                totalCount: 0,
                limit: 10,
                hasNextPage: false,
                hasPrevPage: false,
            });
            // Add to failed APIs
            setFailedApis((prev) => {
                if (!prev.find((api) => api.id === 'transactions')) {
                    return [
                        ...prev,
                        {
                            id: 'transactions',
                            name: 'Prepaid Transactions',
                            retryFunction: () => fetchTable(page, limit),
                            errorMessage:
                                'Failed to load Prepaid Transactions. Please try again.',
                        },
                    ];
                }
                return prev;
            });
        } finally {
            setTableLoading(false);
        }
    };

    useEffect(() => {
        fetchTable(1, serverPagination.limit);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchConsumptionDetails = async (page = 1, limit = 10) => {
        setConsumptionLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            const res = await fetch(
                `${BACKEND_URL}/prepaid/consumption-details?${params.toString()}`,
                { credentials: 'include' }
            );
            if (!res.ok) throw new Error('Failed to fetch consumption details');
            const json = await res.json();
            const isSuccess = json?.status === 'success' || json?.success === true;
            const data = json?.data;
            if (isSuccess && data) {
                const rows = Array.isArray(data.data) ? data.data : data;
                const pagination = data.pagination || json.pagination || {};
                setConsumptionTableData(rows);
                setConsumptionPagination({
                    currentPage: pagination.currentPage ?? page,
                    totalPages: pagination.totalPages ?? 1,
                    totalCount: pagination.totalCount ?? rows.length,
                    limit: pagination.limit ?? limit,
                    hasNextPage: pagination.hasNextPage ?? false,
                    hasPrevPage: pagination.hasPrevPage ?? false,
                });
                setFailedApis((prev) => prev.filter((api) => api.id !== 'consumption'));
            } else {
                setConsumptionTableData([]);
                setConsumptionPagination({
                    currentPage: 1,
                    totalPages: 1,
                    totalCount: 0,
                    limit: 10,
                    hasNextPage: false,
                    hasPrevPage: false,
                });
            }
        } catch (err) {
            console.error(err);
            setConsumptionTableData([]);
            setConsumptionPagination({
                currentPage: 1,
                totalPages: 1,
                totalCount: 0,
                limit: 10,
                hasNextPage: false,
                hasPrevPage: false,
            });
            setFailedApis((prev) => {
                if (!prev.find((api) => api.id === 'consumption')) {
                    return [
                        ...prev,
                        {
                            id: 'consumption',
                            name: 'Consumption Details',
                            retryFunction: () => fetchConsumptionDetails(1, 10),
                            errorMessage: 'Failed to load Consumption Details. Please try again.',
                        },
                    ];
                }
                return prev;
            });
        } finally {
            setConsumptionLoading(false);
        }
    };

    useEffect(() => {
        fetchConsumptionDetails(1, 10);
    }, []);

    const handleConsumptionPageChange = (page: number, limit?: number) => {
        fetchConsumptionDetails(page, limit ?? consumptionPagination.limit);
    };

    const handleTablePageChange = (page: number, limit: number) => {
        fetchTable(page, limit, tableFilters);
    };

    const handleTimeRangeChange = (range: string) => {
        setSelectedTimeRange(range);
        console.log('Time range changed to:', range);
    };

    const handleHeaderMenuClick = (filter: string) => {
        console.log('Header menu filter changed to:', filter);
    };

    const handleAmountRangeChange = (value: string) => {
        const updated = {
            ...tableFilters,
            amountRange: value || '',
        };
        setTableFilters(updated);
        fetchTable(1, serverPagination.limit, updated);
    };

    const handleStatusFilterChange = (value: string) => {
        const updated = {
            ...tableFilters,
            status: value || '',
        };
        setTableFilters(updated);
        fetchTable(1, serverPagination.limit, updated);
    };

    const handleMonthRangeChange = (_dates: any, dateStrings: [string, string]) => {
        const [start, end] = dateStrings || [];
        const updated = {
            ...tableFilters,
            startMonth: buildMonthParam(start),
            endMonth: buildMonthParam(end),
        };
        setTableFilters(updated);
        fetchTable(1, serverPagination.limit, updated);
    };

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            const allTransactions: any[] = [];
            const limit = 500;
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                const params = new URLSearchParams();
                params.append('page', String(page));
                params.append('limit', String(limit));
                if (tableFilters.startMonth) params.append('startMonth', tableFilters.startMonth);
                if (tableFilters.endMonth) params.append('endMonth', tableFilters.endMonth);
                if (tableFilters.amountRange) params.append('amountRange', tableFilters.amountRange);
                if (tableFilters.status) params.append('status', tableFilters.status.toUpperCase());

                const res = await fetch(
                    `${BACKEND_URL}/prepaid/transactions?${params.toString()}`,
                    { credentials: 'include' }
                );
                if (!res.ok) throw new Error('Failed to fetch transactions');

                const json = await res.json();
                const resultData = json.data || json;
                const rows = Array.isArray(resultData) ? resultData : resultData?.data || [];
                const pagination = json.meta?.pagination || json.pagination || resultData?.pagination || {};

                allTransactions.push(...rows);
                const totalPages = pagination.totalPages ?? 1;
                hasMore = page < totalPages && rows.length === limit;
                page += 1;
            }

            const XLSX = await import('xlsx');
            const workbook = XLSX.utils.book_new();

            const setAutoWidth = (worksheet: any) => {
                const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
                const colWidths: any[] = [];
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    let maxWidth = 10;
                    for (let R = range.s.r; R <= range.e.r; ++R) {
                        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                        const cell = worksheet[cellAddress];
                        if (cell && cell.v !== undefined && cell.v !== null) {
                            maxWidth = Math.max(maxWidth, String(cell.v).length);
                        }
                    }
                    colWidths[C] = { wch: Math.min(maxWidth + 2, 50) };
                }
                worksheet['!cols'] = colWidths;
            };

            // Sheet 1: Prepaid Overview (top cards)
            const prepaidOverviewExport = cardData.map((c) => ({
                Metric: c.title,
                Value: c.value ?? 'N/A',
                Details: c.subtitle1 ?? '',
            }));
            const prepaidOverviewSheet = XLSX.utils.json_to_sheet(prepaidOverviewExport);
            setAutoWidth(prepaidOverviewSheet);
            XLSX.utils.book_append_sheet(workbook, prepaidOverviewSheet, 'Prepaid Overview');

            // Sheet 2: Recharge & Usage (Today) cards
            const rechargeUsageExport = rechargeData.map((c) => ({
                Metric: c.title,
                Value: c.value ?? 'N/A',
                Details1: c.subtitle1 ?? '',
                Details2: c.subtitle2 ?? '',
            }));
            const rechargeUsageSheet = XLSX.utils.json_to_sheet(rechargeUsageExport);
            setAutoWidth(rechargeUsageSheet);
            XLSX.utils.book_append_sheet(workbook, rechargeUsageSheet, 'Recharge & Usage');

            // Sheet 3: All Transactions
            const transactionsExport = allTransactions.map((row: any, index: number) => ({
                'SI.No': row?.sNo ?? row?.['s.no'] ?? index + 1,
                'Meter Number': row?.meterNumber ?? 'N/A',
                'USC No': row?.uscNo ?? 'N/A',
                'Consumer Name': row?.consumerName ?? row?.consumer ?? 'N/A',
                'Amount': row?.amount ?? 'N/A',
                'Date': row?.date ?? 'N/A',
                'Status': row?.status ?? 'N/A',
            }));
            const transactionsSheet = XLSX.utils.json_to_sheet(transactionsExport);
            setAutoWidth(transactionsSheet);
            XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transactions');

            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const today = new Date();
            link.download = `prepaid-report-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Generate report failed:', err);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleViewTransaction = (row: any) => {
        const consumerNumber = row.consumerNumber ?? row.uscNo;
        if (consumerNumber) {
            navigate(`/consumers/${consumerNumber}`);
        }
    };

    const handleDownloadTransaction = (row: any) => {
        console.log('Downloading transaction:', row.transactionId);
    };

    const handleShareTransaction = (row: any) => {
        console.log('Sharing transaction:', row.transactionId);
    };

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Page
                sections={[
                    // Error Section (show when there are failed APIs)
                    ...(failedApis.length > 0
                        ? [
                            {
                                layout: {
                                    type: 'column' as const,
                                    gap: 'gap-4',
                                    rows: [
                                        {
                                            layout: 'column' as const,
                                            columns: [
                                                {
                                                    name: 'Error',
                                                    props: {
                                                        visibleErrors: failedApis.map(
                                                            (api) => api.errorMessage
                                                        ),
                                                        showRetry: true,
                                                        maxVisibleErrors: 3, // Show max 3 errors at once
                                                        failedApis: failedApis, // Pass all failed APIs for individual retry
                                                        onRetrySpecific: retrySpecificAPI, // Pass the retry function
                                                    },
                                                },
                                            ],
                                        },
                                    ],
                                },
                            },
                        ]
                        : []),
                    // Page Header Section
                    {
                        layout: {
                            type: 'column',
                            gap: 'gap-4',
                            rows: [
                                {
                                    layout: 'column',
                                    columns: [
                                        {
                                            name: 'PageHeader',
                                            props: {
                                                title: 'Prepaid Overview',
                                                onBackClick: () =>
                                                    navigate('/dashboard'),
                                                buttons: [
                                                    {
                                                        label: isGeneratingReport ? 'Generating...' : 'Generate Report',
                                                        onClick: handleGenerateReport,
                                                        loading: isGeneratingReport,
                                                    },
                                                ],
                                                onMenuItemClick:
                                                    handleHeaderMenuClick,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    // Overview Cards Section
                    {
                        layout: {
                            type: 'column',
                            gap: 'gap-4',
                            rows: [
                                {
                                    layout: 'grid',
                                    gridColumns: 4,
                                    gap: 'gap-4',
                                    columns: cardData.map(({ widgetType: wt, ...card }) => ({
                                        name: 'Card',
                                        props: {
                                            ...card,
                                            bg: "bg-stat-icon-gradient",
                                            loading: statsLoading,
                                            onClick: () => handleCardClick(wt),
                                            onValueClick: () => handleCardClick(wt),
                                            className: 'cursor-pointer hover:shadow-lg transition-shadow duration-200',
                                        },
                                    })),
                                },
                            ],
                        },
                    },
                    // Recharge & Usage Section
                    {
                        layout: {
                            type: 'column',
                            gap: 'gap-4',
                            rows: [
                                {
                                    layout: 'row',
                                    className: 'items-center justify-between',
                                    columns: [
                                        {
                                            name: 'Heading',
                                            props: {
                                                className:
                                                    'text-lg font-semibold',
                                                children:
                                                    'Recharge & Usage',
                                            },
                                        },
                                        {
                                            name: 'TimeRangeSelector',
                                            props: {
                                                availableTimeRanges: [
                                                    'Daily',
                                                    'Monthly',
                                                ],
                                                selectedTimeRange:
                                                    selectedTimeRange,
                                                handleTimeRangeChange:
                                                    handleTimeRangeChange,
                                                    className: 'bg-background-secondary',
                                            },
                                        },
                                    ],
                                },
                                {
                                    layout: 'grid',
                                    gridColumns: 4,
                                    gap: 'gap-4',
                                    columns: rechargeData.map((card) => ({
                                        name: 'Card',
                                        props: { ...card, bg: "bg-stat-icon-gradient", loading: rechargeLoading },
                                    })),
                                },
                            ],
                        },
                    },
                    //Dropdown and calendar section
                    {
                        layout: {
                            type: 'column',
                            gap: 'gap-4',
                            rows: [
                                {
                                    layout: 'row',  
                                    columns: [
                                        {
                                            name: 'Dropdown',
                                            props: {
                                                options: [
                                                    { label: 'Select Amount Range', value: '' },
                                                    { label: '0 – 33.3k', value: '0-33300' },
                                                    { label: '33.3k – 66.6k', value: '33300-66600' },
                                                    { label: '66.6k – 100k', value: '66600-100000' },
                                                ],
                                                placeholder: 'Select Amount Range',
                                                value: tableFilters.amountRange,
                                                onChange: (e: any) =>
                                                    handleAmountRangeChange(
                                                        typeof e === 'string'
                                                            ? e
                                                            : e?.target?.value ?? ''
                                                    ),
                                            },
                                        },
                                        {
                                            name: 'RangePicker',
                                            props: {
                                                onChange: handleMonthRangeChange,
                                                picker: 'month',
                                                dateFormat: 'YYYY-MM',
                                            },
                                        },
                                        {
                                            name: 'Dropdown',
                                            props: {
                                                options: [
                                                    { label: 'Select Payment Status', value: '' },
                                                    { label: 'Pending', value: 'PENDING' },
                                                    { label: 'Completed', value: 'COMPLETED' },
                                                    { label: 'Failed', value: 'FAILED' },
                                                    { label: 'Cancelled', value: 'CANCELLED' },
                                                    { label: 'Reversed', value: 'REVERSED' },
                                                ],
                                                placeholder: 'Select Payment Status',
                                                value: tableFilters.status,
                                                onChange: (e: any) =>
                                                    handleStatusFilterChange(
                                                        typeof e === 'string'
                                                            ? e
                                                            : e?.target?.value ?? ''
                                                    ),
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    // Search Section
                    // {
                    //     layout: {
                    //         type: 'column',
                    //         gap: 'gap-4',
                    //         rows: [
                    //             {
                    //                 layout: 'row',
                    //                 columns: [
                    //                     {
                    //                         name: 'Search',
                    //                         props: {
                    //                             value: '',
                    //                             onChange: (
                    //                                 e: React.ChangeEvent<HTMLInputElement>
                    //                             ) =>
                    //                                 console.log(
                    //                                     'Search:',
                    //                                     e.target.value
                    //                                 ),
                    //                             placeholder:
                    //                                 'Search transactions by consumer name, transaction ID, or amount...',
                    //                             className: 'w-full',
                    //                             showShortcut: true,
                    //                             isLoading: false,
                    //                         },
                    //                     },
                    //                 ],
                    //             },
                    //         ],
                    //     },
                    // },
                    // Transactions Table Section
                    {
                        layout: {
                            type: 'column',
                            gap: 'gap-4',   
                            rows: [
                                {
                                    layout: 'grid',
                                    gridColumns: 1,
                                    className:'pb-4',
                                    columns: [
                                        {
                                            name: 'Table',
                                            props: {
                                                data: tableData,
                                                showDownload: true,
                                                columns: tableColumns,
                                                loading: tableLoading,
                                                serverPagination: serverPagination,
                                                onPageChange: handleTablePageChange,
                                                onRowClick: handleViewTransaction,
                                                actions: [
                                                    {
                                                        label: 'View',
                                                        icon: 'icons/eye.svg',
                                                        onClick:
                                                            handleViewTransaction,
                                                    },
                                                    {
                                                        label: 'Download',
                                                        icon: 'icons/download.svg',
                                                        onClick:
                                                            handleDownloadTransaction,
                                                    },
                                                    {
                                                        label: 'Share',
                                                        icon: 'icons/share.svg',
                                                        onClick:
                                                            handleShareTransaction,
                                                    },
                                                ],
                                                showActions: true,
                                                searchable: true, // Disable table search since we have dedicated search component
                                                pagination: true,
                                                rowsPerPageOptions: [
                                                    5, 10, 15, 25,
                                                ],
                                                initialRowsPerPage: 10,
                                                emptyMessage:
                                                    'No transactions found',
                                                showHeader: true,
                                                headerTitle:
                                                    'Recent Transactions',
                                                dateRange:
                                                    transactionsDateRange,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    // Consumption Details Table Section
                    {
                        layout: {
                            type: 'column',
                            gap: 'gap-4',
                            rows: [
                                {
                                    layout: 'grid',
                                    gridColumns: 1,
                                    className: 'pb-4',
                                    columns: [
                                        {
                                            name: 'Table',
                                            props: {
                                                data: consumptionTableData,
                                                columns: consumptionTableColumns,
                                                loading: consumptionLoading,
                                                showDownload: true,
                                                serverPagination: consumptionPagination,
                                                onPageChange: handleConsumptionPageChange,
                                                onRowClick: handleViewTransaction,
                                                searchable: true,
                                                pagination: true,
                                                rowsPerPageOptions: [5, 10, 15, 25],
                                                initialRowsPerPage: 10,
                                                emptyMessage: 'No consumption details found',
                                                showHeader: true,
                                                headerTitle: 'Consumption Details',
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                ]}
            />
        </Suspense>
    );
}
