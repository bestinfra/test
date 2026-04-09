import { lazy } from 'react';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  apiClient,
  getAccessToken,
  decodeJwtPayload,
  isTokenExpired,
  clearAuthAndRedirectToLogin,
} from '../api/apiUtils';
const Page = lazy(() => import('SuperAdmin/Page'));

type MeterConsumerAlertUpdateMessage = {
  type: string;
  data?: {
    items?: Array<{
      consumerNumber?: string;
      consumerName?: string;
      meterNumber?: string;
      meterSerial?: string;
      coordinates?: { lat: number | null; lng: number | null } | null;
      locationName?: string;
      lastCommunicationDate?: string;
      alertCount?: number;
      alerts?: any[];
    }>;
    totalConsumers?: number;
    totalMeters?: number;
    totalAlerts?: number;
  };
  timestamp?: number;
};

type MapSocketDTR = {
  coordinates: { lat: number; lng: number };
  dtrNumber: string;
  dtrId?: string;
  dtrName?: string;
  lastCommunicationDate?: string;
  location?: string;
  alertCount?: number;
  alerts?: any[] | null;
};

type DTRSocketData = {
  timestamp?: string;
  totalDTRs?: number;
  totalAlerts?: number;
  dtrsWithAlerts?: number;
  dtrs: MapSocketDTR[];
};

function buildRealtimeWsUrl(apiBaseUrl?: string, token?: string) {
  const base = (apiBaseUrl || '').trim();
  if (!base) return '';

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return '';
  }

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/realtime';
  url.search = '';
  if (token) {
    url.searchParams.set('token', token);
  }
  return url.toString();
}

const createDummyConsumptionBillingData = (navigate: ReturnType<typeof useNavigate>) => [
  {
    id: 1,
    title: 'Electricity Usage (kVAh)',
    value: '0',
    icon: 'icons/plug-alt.svg',
    subtitle1: '0 Active Consumption',
    subtitle2: '0 In-Active Consumption',
    onValueClick: () => {
      navigate('/consumers');
    },
    showTrend: true,
    comparisonValue: 0,
    previousValue: 'vs. 0 kVAh Yesterday',
    infoContent: undefined as string | undefined,
  },
  {
    id: 2,
    title: 'Electricity Charges',
    value: '0',
    icon: 'icons/rupee.svg',
    subtitle1: '0 kVAh Average Billing',
    subtitle2: '0 kVAh Average Billing',
    showTrend: true,
    onValueClick: () => {
      navigate('/consumers');
    },
    comparisonValue: 0,
    previousValue: 'vs. ₹0 kVAh Yesterday',
    infoContent: undefined as string | undefined,
  },
];

const ConsumerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const apiBaseUrl = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  // const googleMapsApiKey = 'AIzaSyCzGAzUjgicpxShXVusiguSnosdmsdQ7WI';

  // On mount: if token is expired (exp in the past), clear auth and redirect to login
  useEffect(() => {
    const token = getAccessToken();
    if (token && isTokenExpired(token)) {
      clearAuthAndRedirectToLogin();
      return;
    }
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload) {
        console.log('Decoded token payload:', payload);
        console.log('Token properties:', Object.keys(payload));
        if (typeof payload.exp === 'number') {
          console.log(
            'exp (expiry, seconds):',
            payload.exp,
            '→',
            new Date(payload.exp * 1000).toISOString()
          );
        }
        if (typeof payload.iat === 'number') {
          console.log(
            'iat (issued at, seconds):',
            payload.iat,
            '→',
            new Date(payload.iat * 1000).toISOString()
          );
        }
      }
    }
  }, []);

  // Helper function to format date as DD-MM-YYYY
  const formatDateToDDMMYYYY = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();
    return `${day}-${month}-${year}`;
  };

  // Unified navigation function for all widgets - completely dynamic
  const handleWidgetClick = (
    dataType: string,
    consumption?: number,
    useYesterdayDate: boolean = false
  ) => {
    // Use dynamic dates from dashboard data
    let startDate, endDate;

    // Add consumption if provided (for chart clicks)
    let consumptionParam = '';
    if (consumption !== undefined) {
      consumptionParam = `&consumption=${consumption}`;
    }

    // Determine dates based on time range and data type
    if (widgetsTimeRange === 'Daily') {
      if (useYesterdayDate && apiData?.dailyStats?.yesterdayDate) {
        // For consumption widgets, use yesterday's date from API
        const yesterdayDate = new Date(apiData.dailyStats.yesterdayDate);
        startDate = formatDateToDDMMYYYY(yesterdayDate);
        endDate = formatDateToDDMMYYYY(yesterdayDate);
      } else {
        // For consumer count widgets, use current date to match dashboard display
        const today = new Date();
        startDate = formatDateToDDMMYYYY(today);
        endDate = formatDateToDDMMYYYY(today);
      }
    } else if (widgetsTimeRange === 'Monthly') {
      if (apiData?.monthlyStats?.currentMonth) {
        // Use current month range for monthly view
        const monthStr = apiData.monthlyStats.currentMonth; // "08-2025"
        const [month, year] = monthStr.split('-');
        const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
        const lastDay = new Date(parseInt(year), parseInt(month), 0);
        startDate = formatDateToDDMMYYYY(firstDay);
        endDate = formatDateToDDMMYYYY(lastDay);
      } else {
        // Fallback to current month
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        startDate = formatDateToDDMMYYYY(firstDay);
        endDate = formatDateToDDMMYYYY(lastDay);
      }
    } else {
      // Fallback to current date
      const today = new Date();
      startDate = formatDateToDDMMYYYY(today);
      endDate = formatDateToDDMMYYYY(today);
    }

    // Build final URL with dynamic format - NO meterIds in URL
    const finalUrl = `/individual-detail?data=${dataType}&startDate=${startDate}&endDate=${endDate}${consumptionParam}&page=1&limit=10`;
    navigate(finalUrl);
  };

  // Individual click handlers using unified function - completely dynamic
  // Consumer count widgets use current date to match dashboard display
  const handleTotalConsumersClick = () => handleWidgetClick('all-consumers');
  const handleHighUsageClick = () => handleWidgetClick('high-usage');

  // Consumption widgets use yesterday's date for consumption data
  const handleElectricityUsageClick = () => handleWidgetClick('electricity-usage', undefined, true);
  const handleMonthlyElectricityUsageClick = () =>
    handleWidgetClick('monthly-consumption-details', undefined, true);

  // Electricity Charges widget - no click functionality needed

  // Enhanced API state management (same pattern as other pages)
  const [failedApis, setFailedApis] = useState<
    Array<{
      id: string;
      name: string;
      retryFunction: () => Promise<void>;
      errorMessage: string;
    }>
  >([]);

  // State for API data with smart fallbacks
  const [consumerStats, setConsumerStats] = useState<any>(null);
  const [consumptionBilling, setConsumptionBilling] = useState<any>(null);
  const [highUsageConsumers, setHighUsageConsumers] = useState<any>(null);
  const [highUsageConsumersPagination, setHighUsageConsumersPagination] = useState<any>(null);
  const [_currentSearchTerm, setCurrentSearchTerm] = useState<string>('');
  const [isHighUsageLoading, setIsHighUsageLoading] = useState<boolean>(false);
  const [consumptionChart, setConsumptionChart] = useState<any>(null);
  const [meterStatus, setMeterStatus] = useState<any>(null);

  // State for computed card data (using useState like other pages)
  const [consumerStatsData, setConsumerStatsData] = useState([
    {
      id: 1,
      title: 'Total Consumers',
      value: '0',
      icon: 'icons/consumers.svg',
      subtitle1: '0 Communicating',
      subtitle2: '0 Non-Communicating',
      onValueClick: handleTotalConsumersClick,
    },
    {
      id: 2,
      title: 'High-Usage Consumers',
      value: '0',
      icon: 'icons/heavy-user.svg',
      subtitle1: '0 kWh Avg Consumption',
      subtitle2: 'Exceeding Max Demand',
      onValueClick: handleHighUsageClick,
      infoContent: 'Consumers exceeding maximum demand threshold based on consumption patterns.',
    },
  ]);
  const [consumptionBillingData, setConsumptionBillingData] = useState(() =>
    createDummyConsumptionBillingData(navigate)
  );
  // Time range state for consumption billing cards

  // Store API data for both daily and monthly
  const [apiData, setApiData] = useState<any>(null);

  // Helper function to calculate percentage change
  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(2));
  };

  // Helper function to format date for display
  const formatDisplayDate = (daysBack: number = 1): string => {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Helper function to format API date (YYYY-MM-DD) to display format
  // const formatApiDate = (apiDate: string): string => {
  //   if (!apiDate) return '';
  //   const date = new Date(apiDate);
  //   return date.toLocaleDateString('en-US', {
  //     month: 'short',
  //     day: 'numeric',
  //     year: 'numeric',
  //   });
  // };

  // Helper function to format API month (MM-YYYY) to display format
  const formatApiMonth = (apiMonth: string): string => {
    if (!apiMonth) return '';
    const [month, year] = apiMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  // Helper function to get previous period date based on time range
  const getPreviousPeriodDate = (): string => {
    if (widgetsTimeRange === 'Daily') {
      // Use API date if available, otherwise fallback to calculated date
      return formatDisplayDate(2); // Day before yesterday
    } else {
      // Monthly - use API month if available, otherwise fallback to calculated month
      if (consumptionBilling?.previousMonth) {
        return formatApiMonth(consumptionBilling.previousMonth);
      }
      const date = new Date();
      date.setMonth(date.getMonth() - 1);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
    }
  };

  // TimeRangeSelector state for Consumption & Billing widgets (independent)
  const [widgetsTimeRange, setWidgetsTimeRange] = useState<'Daily' | 'Monthly'>('Daily');

  // Reset state for PieRadiusChart
  const [resetPieChart, _setResetPieChart] = useState(false);

  // Reset function for PieRadiusChart
  // const resetPieChartState = useCallback(() => {
  //     setResetPieChart(true);
  //     // Reset the flag after a short delay
  //     setTimeout(() => setResetPieChart(false), 100);
  // }, []);

  // Chart-specific time range change handler (independent from widgets)
  const handleChartTimeRangeChange = useCallback((range: string) => {
    console.log('Chart time range changed to:', range);
    // This only affects the chart, not the widgets
    // The BarChart component will handle switching between daily and monthly data internally
  }, []);

  // Normalize meter status data for charts (API or fallback)
  const meterStatusChartData = useMemo(() => {
    const source =
      meterStatus && Array.isArray(meterStatus) && meterStatus.length > 0 ? meterStatus : [];

    // Try to map to { value, name } ensuring standard names
    return source.map((item: any) => {
      // Support various API shapes
      const value =
        typeof item.value === 'number'
          ? item.value
          : typeof item.count === 'number'
            ? item.count
            : typeof item.total === 'number'
              ? item.total
              : 0;

      let name: string = item.name || item.status || item.label || '';
      // Standardize labels
      const lower = String(name).toLowerCase();
      if (lower.includes('communicating') && !lower.includes('non')) {
        name = 'Communicating';
      } else if (lower.includes('non') && lower.includes('communicating')) {
        name = 'Non-Communicating';
      }

      return { value, name };
    });
  }, [meterStatus]);

  // Widgets time range change handler (independent from chart)
  const handleWidgetsTimeRangeChange = useCallback((range: string) => {
    console.log('Widgets time range changed to:', range);
    setWidgetsTimeRange(range as 'Daily' | 'Monthly');
    // This only affects the widgets display, not the chart
  }, []);

  // Loading states
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isBillingLoading, setIsBillingLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [isMeterStatusLoading, setIsMeterStatusLoading] = useState(true);

  // ───────── Realtime map (WebSocket) ─────────
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const firstMessageReceivedRef = useRef(false);

  const [_socketLoading, setSocketLoading] = useState(true);
  const [_dtrSocketData, setDtrSocketData] = useState<DTRSocketData | undefined>(undefined);
  const [_socketMarkers, setSocketMarkers] = useState<
    Array<{
      position: { lat: number; lng: number };
      id?: string;
      title?: string;
      infoContent?: string;
    }>
  >([]);

  const connectRealtimeSocket = useCallback(() => {
    const token = getAccessToken();
    const wsUrl = buildRealtimeWsUrl(apiBaseUrl, token || undefined);
    if (!wsUrl) {
      // If we can't build a URL (misconfigured env), keep fallback markers and stop loading.
      setSocketLoading(false);
      return;
    }

    try {
      wsRef.current?.close();
    } catch {}

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      let msg: MeterConsumerAlertUpdateMessage | undefined;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (!msg || msg.type !== 'meter-consumer-alert-update') return;

      if (!firstMessageReceivedRef.current) {
        firstMessageReceivedRef.current = true;
        setSocketLoading(false);
      }

      const items = Array.isArray(msg.data?.items) ? msg.data?.items : [];
      const dtrs: MapSocketDTR[] = [];
      const markers: Array<{
        position: { lat: number; lng: number };
        id?: string;
        title?: string;
      }> = [];

      for (const item of items) {
        const coords = item?.coordinates;
        const lat = coords?.lat;
        const lng = coords?.lng;
        if (lat == null || lng == null) continue;

        const id = item.consumerNumber || item.meterNumber || item.meterSerial;
        if (!id) continue;

        const dtr: MapSocketDTR = {
          coordinates: { lat, lng },
          dtrNumber: id,
          dtrId: id,
          dtrName: item.consumerName || '',
          lastCommunicationDate: item.lastCommunicationDate,
          location: item.locationName,
          alertCount: item.alertCount ?? 0,
          alerts: Array.isArray(item.alerts) ? item.alerts : null,
        };
        dtrs.push(dtr);

        markers.push({
          position: { lat, lng },
          id,
          title: item.consumerName || item.consumerNumber || item.meterNumber || '',
        });
      }

      setDtrSocketData({
        timestamp: String(msg.timestamp || Date.now()),
        totalDTRs: msg.data?.totalConsumers ?? dtrs.length,
        totalAlerts: msg.data?.totalAlerts ?? 0,
        dtrsWithAlerts: dtrs.filter((d) => (d.alertCount || 0) > 0).length,
        dtrs,
      });
      setSocketMarkers(markers);
    };

    const scheduleReconnect = () => {
      if (reconnectTimerRef.current != null) return;
      const attempt = reconnectAttemptRef.current++;
      const delay = Math.min(30000, 1000 * Math.pow(2, attempt));
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connectRealtimeSocket();
      }, delay);
    };

    ws.onerror = () => {
      scheduleReconnect();
    };

    ws.onclose = () => {
      scheduleReconnect();
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    // reset when base url changes
    firstMessageReceivedRef.current = false;
    setSocketLoading(true);
    connectRealtimeSocket();

    return () => {
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
  }, [connectRealtimeSocket]);

  // const handleMapMarkerIdClick = useCallback(
  //   (id: string) => {
  //     // Keep this aligned with existing navigation patterns (table uses /consumers/:id)
  //     navigate(`/consumers/${id}`);
  //   },
  //   [navigate]
  // );

  // Filter states for table

  // Retry specific API function
  const retrySpecificAPI = (apiId: string) => {
    const api = failedApis.find((a) => a.id === apiId);
    if (api) {
      api.retryFunction();
    }
  };

  useEffect(() => {
    if (consumerStats) {
      setConsumerStatsData([
        {
          id: 1,
          title: 'Total Consumers',
          value: consumerStats.totalConsumers || '0',
          icon: 'icons/consumers.svg',
          subtitle1: `${consumerStats.activeConsumers || '0'} Communicating`,
          subtitle2: `${consumerStats.inactiveConsumers || '0'} Non-Communicating`,
          onValueClick: handleTotalConsumersClick,
        },
        {
          id: 2,
          title: 'High-Usage Consumers',
          value: consumerStats.highUsageConsumers || '0',
          icon: 'icons/heavy-user.svg',
          subtitle1: `Exceeding Max Demand`,

          subtitle2: '',
          onValueClick: handleHighUsageClick,
          infoContent:
            'Consumers exceeding maximum demand threshold based on consumption patterns.',
        },
      ]);
    } else {
      // When no API data, use dummy data with navigation functions
      setConsumerStatsData([
        {
          id: 1,
          title: 'Total Consumers',
          value: '0',
          icon: 'icons/consumers.svg',
          subtitle1: '0 Communicating',
          subtitle2: '0 Non-Communicating',
          onValueClick: handleTotalConsumersClick,
        },
        {
          id: 2,
          title: 'High-Usage Consumers',
          value: '0',
          icon: 'icons/heavy-user.svg',
          subtitle1: 'Exceeding Max Demand',
          subtitle2: '',
          onValueClick: handleHighUsageClick,
          infoContent:
            'Consumers exceeding maximum demand threshold based on consumption patterns.',
        },
      ]);
    }
  }, [consumerStats]);

  useEffect(() => {
    if (consumptionBilling) {
      setConsumptionBillingData([
        {
          id: 1,
          title: 'Electricity Usage ( kVAh)',
          value: consumptionBilling.totalConsumption || '0',
          icon: 'icons/plug-alt.svg',
          subtitle1: `${consumptionBilling.previousConsumption || '0'} kVAh`,
          subtitle2: getPreviousPeriodDate(),
          onValueClick:
            widgetsTimeRange === 'Daily'
              ? handleElectricityUsageClick
              : handleMonthlyElectricityUsageClick,
          showTrend: true,
          comparisonValue: consumptionBilling.consumptionComparison || 0,
          previousValue: `vs. ${consumptionBilling.previousConsumption || '0'} kVAh ${
            widgetsTimeRange === 'Daily'
              ? 'Day before yesterday'
              : consumptionBilling.previousMonth
                ? formatApiMonth(consumptionBilling.previousMonth)
                : 'Previous Month'
          }`,
          infoContent: undefined as string | undefined,
        },
        {
          id: 2,
          title: 'Electricity Charges (Tentative)', //this is  reflect
          value: consumptionBilling.totalBilling || '0',
          icon: 'icons/rupee.svg',
          subtitle1: `${consumptionBilling.previousBilling || '0'}`,
          // subtitle1: `${apiData.dailyStats.dayBeforeYesterdayTotalRevenue}`,
          subtitle2: getPreviousPeriodDate(),
          onValueClick: () => {
            navigate('/indepth-details/');
          },
          showTrend: true,
          comparisonValue: consumptionBilling.billingComparison || 0,
          previousValue: `vs. ${consumptionBilling.previousBilling || '0'} ${
            widgetsTimeRange === 'Daily'
              ? 'Day before yesterday'
              : consumptionBilling.previousMonth
                ? formatApiMonth(consumptionBilling.previousMonth)
                : 'Previous Month'
          }`,
          infoContent: 'Demand, Energy, and IMC Charges as per standard tariff included.',
        },
      ]);
    } else {
      setConsumptionBillingData(createDummyConsumptionBillingData(navigate));
    }
  }, [consumptionBilling, navigate]);

  // Update consumption billing data when API data or time range changes
  useEffect(() => {
    if (apiData) {
      const { consumerStats, electricityUsage, monthlyConsumption } = apiData;

      const toNumber = (v: unknown): number => {
        if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
        if (typeof v === 'string') {
          const n = Number.parseFloat(v);
          return Number.isFinite(n) ? n : 0;
        }
        return 0;
      };

      const formatNumberIN = (n: number): string => n.toLocaleString('en-IN');
      const formatCurrencyIN = (n: number): string =>
        n.toLocaleString('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2,
        });

      // Widgets show data based on selected time range
      const mappedConsumptionBilling =
        widgetsTimeRange === 'Daily'
          ? {
              totalConsumption: formatNumberIN(toNumber(electricityUsage?.yesterday?.consumption)),
              activeConsumption: consumerStats?.activeConsumers || '0',
              inactiveConsumption: consumerStats?.inactiveConsumers || '0',
              consumptionComparison: calculatePercentageChange(
                toNumber(electricityUsage?.yesterday?.consumption),
                toNumber(electricityUsage?.dayBeforeYesterday?.consumption)
              ),
              previousConsumption: formatNumberIN(
                toNumber(electricityUsage?.dayBeforeYesterday?.consumption)
              ),
              totalBilling: formatCurrencyIN(toNumber(electricityUsage?.yesterday?.billing)),
              averageBilling: consumerStats?.averageConsumption || '0',
              totalAmount: formatCurrencyIN(toNumber(electricityUsage?.yesterday?.billing)),
              billingComparison: calculatePercentageChange(
                toNumber(electricityUsage?.yesterday?.billing),
                toNumber(electricityUsage?.dayBeforeYesterday?.billing)
              ),
              previousBilling: formatCurrencyIN(
                toNumber(electricityUsage?.dayBeforeYesterday?.billing)
              ),
            }
          : {
              // Monthly data
              totalConsumption: formatNumberIN(
                toNumber(monthlyConsumption?.previousMonth?.consumption)
              ),
              activeConsumption: consumerStats?.activeConsumers || '0',
              inactiveConsumption: consumerStats?.inactiveConsumers || '0',
              consumptionComparison: calculatePercentageChange(
                toNumber(monthlyConsumption?.previousMonth?.consumption),
                toNumber(monthlyConsumption?.previousPreviousMonth?.consumption)
              ),
              previousConsumption: formatNumberIN(
                toNumber(monthlyConsumption?.previousPreviousMonth?.consumption)
              ),
              totalBilling: formatCurrencyIN(toNumber(monthlyConsumption?.previousMonth?.billing)),
              averageBilling: consumerStats?.averageConsumption || '0',
              totalAmount: formatCurrencyIN(toNumber(monthlyConsumption?.previousMonth?.billing)),
              billingComparison: calculatePercentageChange(
                toNumber(monthlyConsumption?.previousMonth?.billing),
                toNumber(monthlyConsumption?.previousPreviousMonth?.billing)
              ),
              previousBilling: formatCurrencyIN(
                toNumber(monthlyConsumption?.previousPreviousMonth?.billing)
              ),
              // Month information from API (note: API gives previousMonth & previousPreviousMonth)
              currentMonth: monthlyConsumption?.previousMonth?.month,
              previousMonth: monthlyConsumption?.previousPreviousMonth?.month,
            };

      setConsumptionBilling(mappedConsumptionBilling);
    }
  }, [apiData, widgetsTimeRange, navigate]);

  // Fetch Dashboard Widgets Data (First route: /)
  useEffect(() => {
    const fetchWidgets = async () => {
      setIsStatsLoading(true);
      setIsBillingLoading(true);
      try {
        const result = await apiClient.get('/dashboard');

        if (result.status === 'success' || result.success) {
          const data = result.data || result;
          setApiData(data);
          setConsumerStats(data?.consumerStats);
          setFailedApis((prev) => prev.filter((api) => api.id !== 'widgets'));
        } else {
          throw new Error(
            result.meta?.message ||
              result.error?.message ||
              result.message ||
              'Failed to fetch dashboard widgets'
          );
        }
      } catch (err: any) {
        console.error('Error fetching dashboard widgets:', err);
        setConsumerStats(null);
        setConsumptionBilling(null);
        // Add to failed APIs
        setFailedApis((prev) => {
          if (!prev.find((api) => api.id === 'widgets')) {
            return [
              ...prev,
              {
                id: 'widgets',
                name: 'Dashboard Widgets',
                retryFunction: fetchWidgets,
                errorMessage: 'Failed to load Dashboard Widgets Data. Please try again.',
              },
            ];
          }
          return prev;
        });
      } finally {
        setIsStatsLoading(false);
        setIsBillingLoading(false);
      }
    };

    fetchWidgets();
  }, []);

  // Fetch High Usage Consumers (initial load with 5 items per page)
  useEffect(() => {
    const fetchHighUsageConsumers = async () => {
      try {
        setIsHighUsageLoading(true);
        const result = await apiClient.get('/dashboard/latest-tamper-events?page=1&limit=5');

        if (result.status === 'success' || result.success) {
          const data = result.data || result;
          const dataArray = Array.isArray(data) ? data : data?.data || [];

          const normalized = dataArray.map((row: any) => {
            const uscNo = row?.['USC No'] ?? row?.uscNo ?? row?.usc_no ?? row?.usc ?? row?.idNumber;
            return uscNo == null || uscNo === ''
              ? row
              : {
                  ...row,
                  'USC No': row?.['USC No'] ?? String(uscNo),
                };
          });

          setHighUsageConsumers(normalized);
          setHighUsageConsumersPagination(result.pagination || null);
        } else {
          throw new Error(
            result.meta?.message ||
              result.error?.message ||
              result.message ||
              'Failed to fetch high usage consumers'
          );
        }
      } catch (err) {
        console.error('Error fetching high usage consumers:', err);
        setHighUsageConsumers(null);
      } finally {
        setIsHighUsageLoading(false);
      }
    };
    fetchHighUsageConsumers();
  }, []);

  // Handle table pagination
  const handlePageChange = async (
    page: number,
    limit: number = highUsageConsumersPagination?.limit || 5
  ) => {
    try {
      setIsHighUsageLoading(true);
      const searchTerm = _currentSearchTerm?.trim();

      const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';

      const result = await apiClient.get(
        `/dashboard/latest-tamper-events?page=${page}&limit=${limit}${searchParam}`
      );

      if (result.status === 'success' || result.success) {
        const data = result.data || result;
        const dataArray = Array.isArray(data) ? data : data?.data || [];

        const normalized = dataArray.map((row: any) => {
          const uscNo = row?.['USC No'] ?? row?.uscNo ?? row?.usc_no ?? row?.usc ?? row?.idNumber;
          return uscNo == null || uscNo === ''
            ? row
            : {
                ...row,
                'USC No': row?.['USC No'] ?? String(uscNo),
              };
        });

        setHighUsageConsumers(normalized);
        setHighUsageConsumersPagination(result.pagination || null);
      } else {
        throw new Error(
          result.meta?.message ||
            result.error?.message ||
            result.message ||
            'Failed to fetch latest tamper events'
        );
      }
    } catch (err) {
      console.error('Error fetching paginated latest tamper events:', err);
    } finally {
      setIsHighUsageLoading(false);
    }
  };

  // Handle table search
  const handleSearch = async (searchTerm: string) => {
    try {
      setIsHighUsageLoading(true);
      setCurrentSearchTerm(searchTerm);

      const trimmed = searchTerm.trim();
      const searchParam = trimmed ? `&search=${encodeURIComponent(trimmed)}` : '';

      const result = await apiClient.get(
        `/dashboard/latest-tamper-events?page=1&limit=${highUsageConsumersPagination?.limit || 5}${searchParam}`
      );

      if (result.status === 'success' || result.success) {
        const data = result.data || result;
        const dataArray = Array.isArray(data) ? data : data?.data || [];

        const normalized = dataArray.map((row: any) => {
          const uscNo = row?.['USC No'] ?? row?.uscNo ?? row?.usc_no ?? row?.usc ?? row?.idNumber;
          return uscNo == null || uscNo === ''
            ? row
            : {
                ...row,
                'USC No': row?.['USC No'] ?? String(uscNo),
              };
        });

        setHighUsageConsumers(normalized);
        setHighUsageConsumersPagination(result.pagination || null);
      } else {
        throw new Error(
          result.meta?.message ||
            result.error?.message ||
            result.message ||
            'Failed to search latest tamper events'
        );
      }
    } catch (err) {
      console.error('Error searching latest tamper events:', err);
    } finally {
      setIsHighUsageLoading(false);
    }
  };

  // Handle clearing search
  const handleClearSearch = async () => {
    try {
      setIsHighUsageLoading(true);
      setCurrentSearchTerm('');

      const result = await apiClient.get(
        `/dashboard/latest-tamper-events?page=1&limit=${highUsageConsumersPagination?.limit || 5}`
      );

      if (result.status === 'success' || result.success) {
        const data = result.data || result;
        const dataArray = Array.isArray(data) ? data : data?.data || [];

        const normalized = dataArray.map((row: any) => {
          const uscNo = row?.['USC No'] ?? row?.uscNo ?? row?.usc_no ?? row?.usc ?? row?.idNumber;
          return uscNo == null || uscNo === ''
            ? row
            : {
                ...row,
                'USC No': row?.['USC No'] ?? String(uscNo),
              };
        });

        setHighUsageConsumers(normalized);
        setHighUsageConsumersPagination(result.pagination || null);
      } else {
        throw new Error(
          result.meta?.message ||
            result.error?.message ||
            result.message ||
            'Failed to fetch latest tamper events'
        );
      }
    } catch (err) {
      console.error('Error clearing search for latest tamper events:', err);
    } finally {
      setIsHighUsageLoading(false);
    }
  };

  // Fetch Meter Status
  useEffect(() => {
    const fetchMeterStatus = async () => {
      setIsMeterStatusLoading(true);
      try {
        const result = await apiClient.get('/consumers/meter-status');

        if (result.status === 'success' || result.success) {
          setMeterStatus(result.data || result);
        } else {
          throw new Error(
            result.meta?.message ||
              result.error?.message ||
              result.message ||
              'Failed to fetch meter status'
          );
        }
      } catch (err) {
        console.error('Error fetching meter status:', err);
        setMeterStatus(null);
      } finally {
        setIsMeterStatusLoading(false);
      }
    };
    fetchMeterStatus();
  }, []);

  // Removed Overdue Consumers fetch for now

  // Fetch Chart Data (Second route: /graph-analytics)
  useEffect(() => {
    const fetchChart = async () => {
      setIsChartLoading(true);
      try {
        const result = await apiClient.get('/dashboard/graph-analytics');

        if (result.status === 'success' || result.success) {
          const data = result.data || result;
          const toNumberArray = (values: unknown): number[] => {
            if (!Array.isArray(values)) return [];
            return values.map((v) => {
              if (typeof v === 'number') return v;
              if (typeof v === 'string') {
                const n = Number.parseFloat(v);
                return Number.isFinite(n) ? n : 0;
              }
              return 0;
            });
          };

          const makeSeriesFromSums = (
            payload: any,
            fallbackName: string
          ): { xAxisData: string[]; seriesData: Array<{ name: string; data: number[] }> } => {
            const xAxisData = Array.isArray(payload?.xAxisData) ? payload.xAxisData : [];

            // API in demo returns `sums`; other envs may already return `seriesData`.
            if (Array.isArray(payload?.seriesData) && payload.seriesData.length > 0) {
              const seriesData = payload.seriesData.map((s: any) => ({
                name: String(s?.name || fallbackName),
                data: toNumberArray(s?.data),
              }));
              return { xAxisData, seriesData };
            }

            const sums = toNumberArray(payload?.sums);
            return {
              xAxisData,
              seriesData: [{ name: fallbackName, data: sums }],
            };
          };

          const transformedData: any = {
            daily: makeSeriesFromSums(data?.daily, 'Daily kVAh'),
            monthly: makeSeriesFromSums(data?.monthly, 'Monthly kVAh'),
            seriesColors: data?.seriesColors || ['#3B82F6', '#10B981'],
          };

          // Helper to drop today's bar from daily data
          const removeTodayFromDaily = (dailyData: {
            xAxisData: string[];
            seriesData: Array<{
              name: string;
              data?: number[];
              clickableData?: Array<{
                date: string;
                value: number;
                seriesName: string;
                timeRange: string;
              }>;
            }>;
          }) => {
            if (!dailyData?.xAxisData?.length || !dailyData.seriesData?.length) {
              return dailyData;
            }

            const normalizeLabel = (val: string) =>
              (val || '').replace(',', '').trim().toLowerCase();

            const todayLabel = normalizeLabel(
              new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
            );

            const removeIndex = dailyData.xAxisData.findIndex(
              (label) => normalizeLabel(label) === todayLabel
            );

            if (removeIndex === -1) {
              return dailyData;
            }

            const filteredXAxis = dailyData.xAxisData.filter((_, idx) => idx !== removeIndex);
            const filteredSeries = dailyData.seriesData.map((series) => ({
              ...series,
              data: series.data?.filter((_, idx) => idx !== removeIndex),
              clickableData: series.clickableData?.filter((_, idx) => idx !== removeIndex),
            }));

            return {
              ...dailyData,
              xAxisData: filteredXAxis,
              seriesData: filteredSeries,
            };
          };

          transformedData.daily = removeTodayFromDaily(transformedData.daily);

          // Add clickableData for chart interactions
          if (transformedData.daily.xAxisData && transformedData.daily.seriesData[0]) {
            transformedData.daily.seriesData[0].clickableData = transformedData.daily.xAxisData.map(
              (date: string, index: number) => ({
                date: date,
                value: transformedData.daily.seriesData[0].data[index] || 0,
                seriesName: 'Daily kVAh',
                timeRange: 'Daily',
              })
            );
          }

          if (transformedData.monthly.xAxisData && transformedData.monthly.seriesData[0]) {
            transformedData.monthly.seriesData[0].clickableData =
              transformedData.monthly.xAxisData.map((date: string, index: number) => ({
                date: date,
                value: transformedData.monthly.seriesData[0].data[index] || 0,
                seriesName: 'Monthly kVAh',
                timeRange: 'Monthly',
              }));
          }

          setConsumptionChart(transformedData);
          // Remove from failed APIs if successful
          setFailedApis((prev) => prev.filter((api) => api.id !== 'chart'));
        } else {
          throw new Error(
            result.meta?.message ||
              result.error?.message ||
              result.message ||
              'Failed to fetch graph analytics'
          );
        }
      } catch (err: any) {
        console.error('Error fetching graph analytics:', err);
        setConsumptionChart(null);
        // Add to failed APIs
        setFailedApis((prev) => {
          if (!prev.find((api) => api.id === 'chart')) {
            return [
              ...prev,
              {
                id: 'chart',
                name: 'Chart Data',
                retryFunction: fetchChart,
                errorMessage: 'Failed to load Chart Data. Please try again.',
              },
            ];
          }
          return prev;
        });
      } finally {
        setIsChartLoading(false);
      }
    };

    fetchChart();
  }, []);

  // Removed overdueConsumersColumns for now

  const [highUsageConsumersColumns] = useState([
    { key: 'sno', label: 'S.No' },
    { key: 'meterNumber', label: 'Meter Number' },
    { key: 'USC No', label: 'USC No' },
    // {
    //   key: 'consumerName',
    //   label: 'Consumer Name',
    //   showIcon: true,
    //   iconPath: 'icons/user.svg',
    //   iconPosition: 'left',
    //   compact: 'normal',
    // },
    { key: 'tamperTypeDesc', label: 'Tamper Type' },
    { key: 'occurredOn', label: 'Occurred On' },
    { key: 'status', label: 'Status' },
    { key: 'duration', label: 'Duration' },
  ]);

  // Chart download handler
  // const handleChartDownload = () => {
  //     exportChartData(consumptionAnalyticsData.xAxisData, 'consumption-analytics-data');
  // };

  // Handle bar chart click
  const handleBarClick = useCallback(
    (data: { date: string; value: number; seriesName: string; timeRange: string }) => {
      console.log('🔍 [DEBUG] Chart click data:', data);

      // Determine data type based on time range
      const dataType =
        data.timeRange === 'Monthly' ? 'chart-monthly-consumption' : 'chart-daily-consumption';

      // Parse the chart date to the format we need
      let chartDate;

      try {
        // Handle different date formats from the chart data
        if (data.date.includes('-') && data.date.length === 10) {
          // Handle YYYY-MM-DD format (ISO date)
          chartDate = new Date(data.date);
        } else if (data.date.includes('/')) {
          // Handle DD/MM/YYYY format
          const [day, month, year] = data.date.split('/');
          chartDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else if (data.date.includes(' ') && /\d{4}/.test(data.date)) {
          // Handle "MMM YYYY" format like "Aug 2025" for monthly data
          chartDate = new Date(data.date);
        } else if (data.date.includes(' ') && !/\d{4}/.test(data.date)) {
          // Handle "DD MMM" format like "21 Aug" for daily data
          const currentYear = new Date().getFullYear();
          chartDate = new Date(`${data.date} ${currentYear}`);
        } else if (data.date.match(/^\d{2}-\d{2}-\d{4}$/)) {
          // Handle DD-MM-YYYY format
          const [day, month, year] = data.date.split('-');
          chartDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          // Try to parse as is
          chartDate = new Date(data.date);
        }

        // If the date is invalid, try alternative parsing methods
        if (isNaN(chartDate.getTime())) {
          // Try to match patterns like "21 Aug", "Aug 21", "21-08", etc.
          const dayMonthMatch = data.date.match(/(\d{1,2})[-\s]([A-Za-z]{3}|\d{1,2})/);
          if (dayMonthMatch) {
            const [, day, monthOrName] = dayMonthMatch;
            const currentYear = new Date().getFullYear();

            const monthMap: { [key: string]: number } = {
              Jan: 0,
              Feb: 1,
              Mar: 2,
              Apr: 3,
              May: 4,
              Jun: 5,
              Jul: 6,
              Aug: 7,
              Sep: 8,
              Oct: 9,
              Nov: 10,
              Dec: 11,
            };

            let monthNum;
            if (isNaN(parseInt(monthOrName))) {
              monthNum = monthMap[monthOrName];
            } else {
              monthNum = parseInt(monthOrName) - 1;
            }

            if (monthNum !== undefined) {
              chartDate = new Date(currentYear, monthNum, parseInt(day));
            }
          }

          // If still invalid, try to extract month and day separately
          if (isNaN(chartDate.getTime())) {
            const currentYear = new Date().getFullYear();
            const dayMatch = data.date.match(/(\d{1,2})/);
            const monthMatch = data.date.match(/([A-Za-z]{3})/);

            if (dayMatch && monthMatch) {
              const monthMap: { [key: string]: number } = {
                Jan: 0,
                Feb: 1,
                Mar: 2,
                Apr: 3,
                May: 4,
                Jun: 5,
                Jul: 6,
                Aug: 7,
                Sep: 8,
                Oct: 9,
                Nov: 10,
                Dec: 11,
              };
              const monthNum = monthMap[monthMatch[1]];
              if (monthNum !== undefined) {
                chartDate = new Date(currentYear, monthNum, parseInt(dayMatch[1]));
              }
            }

            // Last resort: use current date
            if (isNaN(chartDate.getTime())) {
              chartDate = new Date();
            }
          }
        }
      } catch (error) {
        // Use current date as fallback to ensure navigation still works
        chartDate = new Date();
      }

      // For monthly charts, we need to override the date logic to use the chart's specific month
      if (data.timeRange === 'Monthly') {
        // Use the specific month from the chart data
        const monthStart = new Date(chartDate.getFullYear(), chartDate.getMonth(), 1);
        const monthEnd = new Date(chartDate.getFullYear(), chartDate.getMonth() + 1, 0);

        // Navigate directly with the chart's specific month range
        const startDate = formatDateToDDMMYYYY(monthStart);
        const endDate = formatDateToDDMMYYYY(monthEnd);

        const finalUrl = `/individual-detail?data=${dataType}&startDate=${startDate}&endDate=${endDate}&consumption=${data.value}&page=1&limit=10`;
        console.log('🔍 [DEBUG] Monthly navigation URL:', finalUrl);
        navigate(finalUrl);
      } else {
        // For daily charts, use the specific date
        const startDate = formatDateToDDMMYYYY(chartDate);
        const endDate = formatDateToDDMMYYYY(chartDate);

        // Navigate directly with the chart's specific date
        const finalUrl = `/individual-detail?data=${dataType}&startDate=${startDate}&endDate=${endDate}&consumption=${data.value}&page=1&limit=10`;
        console.log('🔍 [DEBUG] Daily navigation URL:', finalUrl);
        navigate(finalUrl);
      }
    },
    [navigate]
  );
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="sticky top-0 ">
        <Page
          sections={[
            ...(failedApis.length > 0
              ? [
                  {
                    layout: {
                      type: 'column' as const,
                      gap: 'gap-4',
                      className: '',
                      rows: [
                        {
                          layout: 'column' as const,
                          columns: [
                            {
                              name: 'Error',
                              props: {
                                visibleErrors: failedApis.map((api) => api.errorMessage),
                                showRetry: true,
                                maxVisibleErrors: 4,
                                failedApis: failedApis,
                                onRetrySpecific: retrySpecificAPI,
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
                type: 'grid',
                gap: 'gap-4',
                columns: 4,
                rows: [
                  {
                    layout: 'grid',
                    gap: 'gap-4',
                    gridColumns: 2,
                    span: { col: 2, row: 1 },
                    className: 'border border-primary-border rounded-3xl p-4 bg-primary-lightest',
                    columns: [
                      {
                        name: 'SectionHeader',
                        props: {
                          title: `Consumer Statistics (${new Date().toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })})`,
                          titleLevel: 2,
                          titleSize: 'md',
                          titleVariant: 'colorPrimaryDark',
                          titleWeight: 'normal',
                          titleAlign: 'left',
                        },
                        span: { col: 2, row: 1 },
                      },
                      ...consumerStatsData.map((card) => ({
                        name: 'Card',
                        props: {
                          title: card.title,
                          value: card.value,
                          icon: card.icon,
                          subtitle1: card.subtitle1,
                          subtitle2: card.subtitle2,
                          onValueClick: card.onValueClick,
                          bg: 'bg-stat-icon-gradient',
                          loading: isStatsLoading,
                          className:
                            card.onValueClick != null
                              ? 'cursor-pointer hover:shadow-lg transition-shadow duration-200'
                              : '',
                          onClick: card.onValueClick,
                          infoContent: card.infoContent,
                        },
                        span: {
                          col: 1 as const,
                          row: 1 as const,
                        },
                      })),
                    ],
                  },
                  {
                    layout: 'grid',
                    gap: 'gap-4',
                    gridColumns: 2,
                    span: { col: 2, row: 1 },
                    className:
                      'border border-primary-border rounded-3xl p-4 bg-background-secondary',
                    columns: [
                      {
                        name: 'SectionHeader',
                        props: {
                          title: `Consumption & Billing (${
                            widgetsTimeRange === 'Daily'
                              ? formatDisplayDate(1)
                              : consumptionBilling?.currentMonth
                                ? formatApiMonth(consumptionBilling.currentMonth)
                                : new Date().toLocaleDateString('en-US', {
                                    month: 'short',
                                    year: 'numeric',
                                  })
                          })`,
                          titleLevel: 2,
                          titleSize: 'md',
                          titleVariant: 'colorPrimaryDark',
                          titleWeight: 'normal',
                          titleAlign: 'left',
                          rightComponent: {
                            name: 'TimeRangeSelector',
                            props: {
                              availableTimeRanges: ['Daily', 'Monthly'],
                              selectedTimeRange: widgetsTimeRange,
                              handleTimeRangeChange: handleWidgetsTimeRangeChange,
                              timeRangeLabels: {},
                            },
                          },
                          layout: 'horizontal',
                          gap: 'gap-4',
                        },
                        span: { col: 2, row: 1 },
                      },
                      ...consumptionBillingData.map((card) => ({
                        name: 'Card',
                        props: {
                          title: card.title,
                          value: card.value,
                          icon: card.icon,
                          subtitle1: card.subtitle1,
                          subtitle2: card.subtitle2,
                          onValueClick: card.onValueClick,
                          bg: 'bg-stat-icon-gradient',
                          showTrend: card.showTrend,
                          comparisonValue: card.comparisonValue,
                          loading: isBillingLoading,
                          className:
                            card.onValueClick != null
                              ? 'cursor-pointer hover:shadow-lg transition-shadow duration-200'
                              : '',
                          onClick: card.onValueClick,
                          infoContent: card.infoContent,
                        },
                        span: {
                          col: 1 as const,
                          row: 1 as const,
                        },
                      })),
                    ],
                  },
                ],
              },
            },

            {
              layout: {
                type: 'column',
                gap: 'gap-4',
                className: '',
                rows: [
                  {
                    layout: 'column',
                    gap: 'gap-1',
                    columns: [
                      {
                        name: 'BarChart',
                        props: {
                          dailyData: consumptionChart?.daily || {
                            xAxisData: [],
                            seriesData: [
                              {
                                name: 'Daily kVAh',
                                data: [],
                                clickableData: [],
                              },
                            ],
                          },
                          monthlyData: consumptionChart?.monthly || {
                            xAxisData: [],
                            seriesData: [
                              {
                                name: 'Monthly kVAh',
                                data: [],
                                clickableData: [],
                              },
                            ],
                          },
                          seriesColors: ['#163b7c', '#55b56c'],
                          height: 400,
                          showHeader: true,
                          headerTitle: 'Energy Consumption (kVAh)',
                          // showDownloadButton: true,
                          showViewToggle: true,
                          viewToggleOptions: ['Graph', 'Table'],
                          availableTimeRanges: ['Daily', 'Monthly'],
                          initialTimeRange: 'Daily',
                          onTimeRangeChange: handleChartTimeRangeChange,
                          showTableView: true,
                          ariaLabel:
                            'Energy consumption chart showing daily and monthly data in kVAh',
                          yAxisMax: 3000000,
                          yAxisStep: 500000,
                          yAxisUnit: 'kVAh',
                          onDownload: '',
                          searchable: false,
                          onBarClick: handleBarClick,
                          isLoading: isChartLoading,
                          animation: true,
                          animationDuration: 800,
                          animationEasing: 'linear',
                          animationDelay: 0,
                          animationDurationUpdate: 400,
                          animationEasingUpdate: 'cubicInOut',
                        },
                      },
                    ],
                  },
                ],
              },
            },
            // {
            //   layout: {
            //     type: 'column',
            //     gap: 'gap-4',
            //     className: '',
            //     rows: [
            //       {
            //         layout: 'column',
            //         gap: 'gap-1',
            //         columns: [
            //           {
            //             name: 'GoogleMap',
            //             props: {
            //               title: 'Consumers Map',
            //               apiKey: googleMapsApiKey,
            //               dtrSocketData: dtrSocketData,
            //               markers: firstMessageReceivedRef.current ? socketMarkers : [],
            //               loading: socketLoading,
            //               onMarkerIdClick: handleMapMarkerIdClick,
            //               mapOptions: {},
            //               onReady: () => {},
            //               showLegend: true,
            //             },
            //           },
            //         ],
            //       },
            //     ],
            //   },
            // },
            {
              layout: {
                type: 'grid',
                columns: 5,
                gap: 'gap-4',
                className: '',
                rows: [
                  {
                    layout: 'column',
                    gap: 'gap-1',
                    span: {
                      col: 2 as const,
                      row: 1 as const,
                    },
                    columns: [
                      {
                        name: 'PieRadiusChart',
                        props: {
                          data: meterStatusChartData,
                          height: 408,
                          showNoDataMessage: false,
                          showDownloadButton: true,
                          showHeader: true,
                          headerTitle: 'Meters Status',
                          innerRadius: '40%',
                          outerRadius: '70%',
                          borderRadius: 10,
                          borderColor: '#fff',
                          borderWidth: 2,
                          showLegend: true,
                          legendPosition: 'top',
                          showLabel: false,
                          emphasisLabelSize: 20, // Smaller emphasis size
                          emphasisLabelWeight: 'bold',
                          enableHover: true,
                          // Tooltip should show label and value on two lines
                          tooltipFormatter: '{b}<br/>{c}',
                          // Center label configuration
                          showCenterLabel: true,
                          centerLabelFontSize: 24,
                          centerLabelSubtextFontSize: 12,
                          // Default center label (shows total when not hovering/clicking)
                          centerLabelFormatter: (data: any[]) => {
                            const total = (data || []).reduce(
                              (sum, d: any) => sum + (d?.value || 0),
                              0
                            );
                            return {
                              text: String(total),
                              subtext: 'Total Meters',
                            };
                          },
                          // Hover center label (shows individual values while hovering)
                          showHoverCenterLabel: true,
                          hoverTimeout: 2000, // 2 seconds
                          hoverCenterLabelFormatter: (hoveredData: any) => {
                            if (!hoveredData) return { text: '', subtext: '' };
                            return {
                              text: String(hoveredData.value),
                              subtext: hoveredData.name,
                            };
                          },
                          // Click center label (shows individual values when clicked)
                          clickCenterLabelFormatter: (clickedData: any) => {
                            if (!clickedData) return { text: '', subtext: '' };
                            return {
                              text: String(clickedData.value),
                              subtext: clickedData.name,
                            };
                          },
                          onClick: (segmentName?: string) => {
                            if (segmentName === 'Communicating') {
                              handleWidgetClick('communicating');
                            } else if (segmentName === 'Non-Communicating') {
                              handleWidgetClick('non-communicating');
                            } else {
                              handleWidgetClick('all-consumers');
                            }
                          },
                          resetClickedData: resetPieChart,
                          isLoading: isMeterStatusLoading,
                        },
                      },
                    ],
                  },
                  {
                    layout: 'column',
                    gap: 'gap-1',
                    span: {
                      col: 3 as const,
                      row: 1 as const,
                    },
                    columns: [
                      {
                        name: 'Table',
                        props: {
                          data: highUsageConsumers || [],
                          columns: highUsageConsumersColumns,
                          loading: isHighUsageLoading,
                          searchable: true,
                          showDownload: true,
                          downloadFileName: 'high-usage-consumers',
                          pagination: true,
                          pageSize: highUsageConsumersPagination?.limit || 5,
                          initialRowsPerPage: highUsageConsumersPagination?.limit || 10,
                          rowsPerPageOptions: [5, 10, 20],
                          itemsPerPage: highUsageConsumersPagination?.limit || 10,
                          availableTimeRanges: [],
                          showHeader: true,
                          useStatusDurationMapping: true,
                          headerTitle: 'Latest Meter Events',
                          height: 330,
                          showActions: true,
                          onView: (row: any) => {
                            const consumerNumber = row['Consumer Number'] || row.consumerNumber;
                            const uid = row.UID || row.uid;
                            if (consumerNumber) {
                              navigate(`/consumers/${consumerNumber}`);
                            } else if (uid) {
                              navigate(`/consumers/${uid}`);
                            }
                          },
                          onRowClick: (row: any) => {
                            const consumerNumber = row['Consumer Number'] || row.consumerNumber;
                            const uid = row.UID || row.uid;
                            if (consumerNumber) {
                              navigate(`/consumers/${consumerNumber}`);
                            } else if (uid) {
                              navigate(`/consumers/${uid}`);
                            }
                          },
                          onPageChange: handlePageChange,
                          onSearch: handleSearch,
                          onClearSearch: handleClearSearch,
                          serverPagination: highUsageConsumersPagination,
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

export default ConsumerDashboard;
