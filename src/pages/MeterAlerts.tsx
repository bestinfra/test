import React, { useState, useEffect, lazy } from "react";
import { useNavigate } from "react-router-dom";
const Page = lazy(() => import("SuperAdmin/Page"));
import BACKEND_URL from "../config";

// Dummy data for fallback
const dummyAlertStats = {
    totalAlerts: "0",
    resolvedAlerts: "0",
    activeAlerts: "0",
    todayOccurred: "0",
};

const dummyFilterOptions = {
    statusOptions: [
        { value: "all", label: "All Status" },
        { value: "active", label: "Active" },
        { value: "resolved", label: "Resolved" },
    ],
    alertTypeOptions: [
        { value: "all", label: "All Types" },
        { value: "overload", label: "Overload" },
        { value: "power_failure", label: "Power Failure" },
        { value: "communication_loss", label: "Communication Loss" },
        { value: "voltage_fluctuation", label: "Voltage Fluctuation" },
    ],
};

const dummyAlertTableData = [
    {
        sNo: 1,
        dtrId: "DTR001",
        meter: "MTR001",
        tamperType: "Cover Tamper",
        status: "Active",
        duration: "2h 30m",
    },
    {
        sNo: 2,
        dtrId: "DTR002",
        meter: "MTR002",
        tamperType: "Magnetic Tamper",
        status: "Resolved",
        duration: "45m",
    },
    {
        sNo: 3,
        dtrId: "DTR003",
        meter: "MTR003",
        tamperType: "Reverse Polarity",
        status: "Active",
        duration: "1h 15m",
    },
];

const dummyTimelineData = {
    months: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ],
    days: [], // For daily timeline data
    hours: [], // Start with empty hours
    series: [
        { name: "Active", data: [] },
        { name: "Resolved", data: [] },
    ],
    hourlySeries: [
        { name: "Active", data: [] },
        { name: "Resolved", data: [] },
    ],
};

const dummyTrendData = {
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    series: [{ name: "Total Alerts", data: [15, 23, 20, 26, 27, 28] }],
};

const MeterAlert: React.FC = () => {
    const navigate = useNavigate();

    // Filter states - Initialize empty so tracker only shows when user selects something
    const [filterValues, setFilterValues] = useState({
        meterId: "",
        status: "all",
        dateRange: { start: "", end: "" },
        alertType: "all",
    });

    // Data states
    const [alertStats, _setAlertStats] = useState(dummyAlertStats);
    const [alertTableData, _setAlertTableData] = useState(dummyAlertTableData);
    const [filterOptions, _setFilterOptions] = useState(dummyFilterOptions);
    const [timelineData, _setTimelineData] = useState(dummyTimelineData);
    const [monthlyTimelineData, _setMonthlyTimelineData] =
        useState(dummyTimelineData);
    const [dailyTimelineData, _setDailyTimelineData] =
        useState(dummyTimelineData);
    const [_trendData, _setTrendData] = useState(dummyTrendData);
    const [pieData, _setPieData] = useState<
        Array<{ value: number; name: string; unit: string }>
    >([]);
    const [tamperTypesStats, _setTamperTypesStats] = useState({
        totalCount: 0,
        average: 0,
        totalTypes: 0,
    });
    const [activityLogData, _setActivityLogData] = useState<Array<any>>([]);

    // Filter options states
    const [meterOptions, setMeterOptions] = useState([]);
    const [isLoadingMeterOptions, setIsLoadingMeterOptions] = useState(false);

    // Loading states
    const [isStatsLoading, _setIsStatsLoading] = useState(false);
    const [isTableLoading, _setIsTableLoading] = useState(false);
    const [isChartLoading, _setIsChartLoading] = useState(false);

    // Time range state for bar chart
    const [alertTimelineRange, setAlertTimelineRange] = useState<
        "Daily" | "Monthly"
    >("Daily");

    // Error states - following the pattern from MetersList.tsx
    const [error, setError] = useState<string | null>(null);

    // Alert statistics cards
    const alertStatsCards = [
        {
            title: "Total Events",
            value: alertStats.totalAlerts,
            icon: "icons/totalAlerts.svg",
            subtitle1: "Current Month Events",
            bg: "bg-stat-icon-gradient",
            loading: isStatsLoading,
            // onValueClick: () => navigate("/meter-alert-table?type=all"),
        },
        {
            title: "Resolved",
            value: alertStats.resolvedAlerts,
            icon: "icons/resolvednotification.svg",
            subtitle1: "Resolved This Month",
            bg: "bg-stat-icon-gradient",
            loading: isStatsLoading,
            //onValueClick: () => navigate("/meter-alert-table?type=resolved"),
        },
        {
            title: "Active",
            value: alertStats.activeAlerts,
            icon: "icons/todayNofitication.svg",
            subtitle1: "Currently Active",
            bg: "bg-stat-icon-gradient",
            loading: isStatsLoading,
            // onValueClick: () => navigate("/meter-alert-table?type=active"),
        },
        {
            title: "Today Occurred",
            value: alertStats.todayOccurred,
            icon: "icons/alert.svg",
            subtitle1: "Events Today",
            bg: "bg-stat-icon-gradient",
            loading: isStatsLoading,
            // onValueClick: () => navigate("/meter-alert-table?type=today"),
        },
    ];

    // Alert table columns
    const alertTableColumns = [
        { key: "sNo", label: "S.No" },
        { key: "dtrId", label: "DTR ID" },
        { key: "meter", label: "Meter" },
        { key: "tamperType", label: "Tamper Type" },
        { key: "occurredOn", label: "Occured On" },
        {
            key: "status",
            label: "Status",
            statusIndicator: {},
            isActive: (value: string) => value.toLowerCase() === "active",
        },
        { key: "duration", label: "Duration" },
    ];

    // Filter change handlers
    const handleFilterChange = (filterName: string, value: any) => {
        // Extract the actual value if it's an object with target.value
        const actualValue =
            typeof value === "string" ? value : value?.target?.value || value;

        console.log("Frontend handleFilterChange called with:");
        console.log("  filterName:", filterName);
        console.log("  value:", value);
        console.log("  actualValue:", actualValue);
        console.log("  typeof value:", typeof value);

        setFilterValues((prev) => {
            const newValues = {
                ...prev,
                [filterName]: actualValue,
            };
            console.log(
                "Frontend new filterValues after filter change:",
                newValues
            );
            return newValues;
        });
    };

    const handleDateRangeChange = (start: string, end: string) => {
        console.log("Frontend handleDateRangeChange called with:");
        console.log("  start:", start);
        console.log("  end:", end);
        console.log("  typeof start:", typeof start);
        console.log("  typeof end:", typeof end);

        setFilterValues((prev) => {
            const newValues = {
                ...prev,
                dateRange: { start, end },
            };
            console.log(
                "Frontend new filterValues after date change:",
                newValues
            );
            return newValues;
        });
    };

    const handleChartDownload = () => {
        console.log("Downloading chart data...");
    };

    // Get alert timeline data based on selected time range
    const getAlertTimelineData = () => {
        if (alertTimelineRange === "Daily") {
            console.log("Returning DAILY data:", {
                xAxisData: dailyTimelineData.days,
                seriesData: dailyTimelineData.series,
            });
            return {
                xAxisData: dailyTimelineData.days || [],
                seriesData: dailyTimelineData.series || [],
            };
        } else {
            console.log("Returning MONTHLY data:", {
                xAxisData: monthlyTimelineData.months,
                seriesData: monthlyTimelineData.series,
            });
            return {
                xAxisData: monthlyTimelineData.months || [],
                seriesData: monthlyTimelineData.series || [],
            };
        }
    };

    const handleAlertTimeRangeChange = (range: string) => {
        console.log("Time range changed to:", range);
        setAlertTimelineRange(range as "Daily" | "Monthly");
    };

    // Fetch meter options for dropdown
    const fetchMeterOptions = async (searchTerm: string = "") => {
        setIsLoadingMeterOptions(true);
        try {
            const response = await fetch(
                `${BACKEND_URL}/alerts/meter-suggestions?search=${encodeURIComponent(
                    searchTerm
                )}&limit=50`
            );
            if (response.ok) {
                const suggestions = await response.json();
                setMeterOptions(suggestions);
                console.log("Frontend meter options:", suggestions);
            }
        } catch (error) {
            console.error("Error fetching meter options:", error);
        } finally {
            setIsLoadingMeterOptions(false);
        }
    };

    // Fetch tamper type options
    const fetchTamperTypeOptions = async () => {
        try {
            const response = await fetch(
                `${BACKEND_URL}/alerts/tamper-type-options`
            );
            if (response.ok) {
                const options = await response.json();
                _setFilterOptions((prev) => ({
                    ...prev,
                    alertTypeOptions: [
                        { value: "all", label: "All Types" },
                        ...options,
                    ],
                }));
                console.log("Frontend tamper type options:", options);
            }
        } catch (error) {
            console.error("Error fetching tamper type options:", error);
        }
    };

    // Error handling functions - following the pattern from MetersList.tsx
    const handleRetry = () => {
        setError(null);
        window.location.reload();
    };

    // Self-contained tracking system - no imports needed!
    const [_hasActiveFilters, setHasActiveFilters] = useState(false);
    const [_activeComponents, setActiveComponents] = useState<
        Array<{
            id: string;
            name: string;
            value: any;
            label?: string;
        }>
    >([]);

    useEffect(() => {
        const components: Array<{
            id: string;
            name: string;
            value: any;
            label?: string;
        }> = [];

        // Track Meter ID
        if (filterValues.meterId && filterValues.meterId.trim()) {
            components.push({
                id: "meterId-filter",
                name: `Meter ID: ${filterValues.meterId}`,
                value: filterValues.meterId,
            });
        }

        if (filterValues.status && filterValues.status !== "all") {
            const statusLabel =
                filterOptions.statusOptions.find(
                    (opt) => opt.value === filterValues.status
                )?.label || filterValues.status;
            components.push({
                id: "status-filter",
                name: `Status: ${statusLabel}`,
                value: filterValues.status,
                label: statusLabel,
            });
        }

        if (filterValues.alertType && filterValues.alertType !== "all") {
            const alertTypeLabel =
                filterOptions.alertTypeOptions.find(
                    (opt) => opt.value === filterValues.alertType
                )?.label || filterValues.alertType;
            components.push({
                id: "alertType-filter",
                name: `Alert Type: ${alertTypeLabel}`,
                value: filterValues.alertType,
                label: alertTypeLabel,
            });
        }

        if (filterValues.dateRange.start || filterValues.dateRange.end) {
            const dateRangeLabel =
                filterValues.dateRange.start && filterValues.dateRange.end
                    ? `Date Range: ${filterValues.dateRange.start} to ${filterValues.dateRange.end}`
                    : filterValues.dateRange.start
                    ? `From: ${filterValues.dateRange.start}`
                    : `Until: ${filterValues.dateRange.end}`;

            components.push({
                id: "dateRange-filter",
                name: dateRangeLabel,
                value: {
                    start: filterValues.dateRange.start,
                    end: filterValues.dateRange.end,
                },
            });
        }

        // Update state
        setActiveComponents(components);
        setHasActiveFilters(components.length > 0);
    }, [filterValues, filterOptions]);

    // Fetch filter options on component mount
    useEffect(() => {
        fetchTamperTypeOptions();
        fetchMeterOptions(); // Load initial meter options
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            _setIsStatsLoading(true);
            _setIsTableLoading(true);

            try {
                console.log(
                    "Frontend building query params with filterValues:",
                    filterValues
                );

                const queryParams = new URLSearchParams({
                    status:
                        filterValues.status === "all"
                            ? ""
                            : filterValues.status,
                    meterId: filterValues.meterId || "",
                    alertType:
                        filterValues.alertType === "all"
                            ? ""
                            : filterValues.alertType,
                    startDate: filterValues.dateRange.start || "",
                    endDate: filterValues.dateRange.end || "",
                }).toString();

                console.log("Frontend queryParams:", queryParams);
                console.log(
                    "Frontend URL:",
                    `${BACKEND_URL}/alerts?${queryParams}`
                );

                const res = await fetch(`${BACKEND_URL}/alerts?${queryParams}`);
                if (!res.ok) throw new Error("Failed to fetch alerts");

                const data = await res.json();

                console.log("====== FULL API RESPONSE ======");
                console.log("API Response Keys:", Object.keys(data));
                console.log(
                    "Has monthlyTimelineData?",
                    !!data.monthlyTimelineData
                );
                console.log("================================");

                // Update stats
                _setAlertStats({
                    totalAlerts: data.stats.totalAlerts || "0",
                    activeAlerts: data.stats.activeAlerts || "0",
                    resolvedAlerts: data.stats.resolvedAlerts || "0",
                    todayOccurred: data.stats.todayOccurred || "0",
                });

                // Map table data
                _setAlertTableData(
                    data.events.map((event: any, idx: number) => ({
                        sNo: idx + 1,
                        dtrId: event.dtrId ?? "N/A",
                        meter: event.meter ?? "N/A",
                        tamperType: event.tamperType,
                        status: event.status,
                        duration: event.duration,
                        occurredOn: event.occurredOn,
                    }))
                );

                // Update timeline data
                if (data.timelineData) {
                    _setTimelineData({
                        months: dummyTimelineData.months, // Keep original monthly data
                        days: dummyTimelineData.days, // Keep original daily data
                        hours: data.timelineData.hours,
                        series: dummyTimelineData.series, // Keep original monthly series
                        hourlySeries: data.timelineData.series, // Use backend data for hourly
                    });
                }

                // Update daily and monthly timeline data for bar chart
                if (data.dailyTimelineData) {
                    _setDailyTimelineData(data.dailyTimelineData);
                }

                if (data.monthlyTimelineData) {
                    data.monthlyTimelineData.series?.forEach(
                        (_s: any, _idx: number) => {}
                    );
                    _setMonthlyTimelineData(data.monthlyTimelineData);
                }

                // Update tamper types distribution data
                if (data.tamperTypesData) {
                    const transformedPieData = data.tamperTypesData.pieData.map(
                        (item: any) => ({
                            ...item,
                            unit: item.unit === "alerts" ? "Events" : item.unit,
                        })
                    );

                    _setPieData(transformedPieData);
                    _setTamperTypesStats({
                        totalCount: data.tamperTypesData.totalCount,
                        average: data.tamperTypesData.average,
                        totalTypes: data.tamperTypesData.totalTypes,
                    });
                }

                // Update top meters data
                if (data.topMetersData) {
                    _setActivityLogData(data.topMetersData);
                }
            } catch (err) {
                console.error(err);
                setError("Failed to fetch alert data. Please try again.");
            } finally {
                _setIsStatsLoading(false);
                _setIsTableLoading(false);
            }
        };

        fetchData();
    }, [filterValues]);

    return (
        <div className="overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <Page
                sections={[
                    // Error section - following pattern from MetersList.tsx
                    ...(error
                        ? [
                              {
                                  layout: {
                                      type: "column" as const,
                                      gap: "gap-4",
                                  },
                                  components: [
                                      {
                                          name: "Error",
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
                                    title: "Meter Events",
                                    onBackClick: () => window.history.back(),
                                    //   buttonsLabel: 'Export',
                                    //   variant: 'primary',
                                    //   backButtonText: '',
                                    //   onClick: handleExportData,
                                    //   showMenu: true,
                                    //   showDropdown: true,
                                    //   menuItems: [{ id: 'export', label: 'Export' }],
                                    //   onMenuItemClick: (_itemId: string) => {
                                    //     // Handle menu item click
                                    //   },
                                },
                            },
                        ],
                    },

                    // Filter Section - following MetersList.tsx pattern (NO DUPLICATES)
                    {
                        layout: {
                            type: "grid" as const,
                            columns: 4,
                            gap: "gap-4",
                            className:
                                "border border-primary-border dark:border-dark-border rounded-3xl p-4 bg-background-secondary dark:bg-primary-dark-light items-center",
                        },
                        components: [
                            {
                                name: "Dropdown",
                                props: {
                                    options: [
                                        { value: "", label: "All Meters" },
                                        ...meterOptions,
                                    ],
                                    value: filterValues.meterId,
                                    onChange: (value: string) => {
                                        handleFilterChange("meterId", value);
                                    },
                                    onSearch: (searchTerm: string) => {
                                        fetchMeterOptions(searchTerm);
                                    },
                                    placeholder: "Search Meter ID",
                                    searchable: true,
                                    loading: isLoadingMeterOptions,
                                    className: "w-full",
                                },
                            },
                            {
                                name: "Dropdown",
                                props: {
                                    options: filterOptions.statusOptions,
                                    value: filterValues.status,
                                    onChange: (value: string) =>
                                        handleFilterChange("status", value),
                                    placeholder: "Select Status",
                                    searchable: false,
                                    className: "w-full",
                                },
                            },
                            {
                                name: "RangePicker",
                                props: {
                                    startDate: filterValues.dateRange.start,
                                    endDate: filterValues.dateRange.end,
                                    onChange: handleDateRangeChange,
                                    placeholder: "Select Date Range",
                                    className: "w-full",
                                },
                            },
                            {
                                name: "Dropdown",
                                props: {
                                    options: filterOptions.alertTypeOptions,
                                    value: filterValues.alertType,
                                    onChange: (value: string) =>
                                        handleFilterChange("alertType", value),
                                    placeholder: "Select Event Type",
                                    searchable: false,
                                    className: "w-full",
                                },
                            },
                        ],
                    },
                    //  // SimpleTracker Section - separate section (only show when filters are active)
                    //  ...(hasActiveFilters ? [{
                    //    layout: {
                    //      type: 'column' as const,
                    //      gap: 'gap-4',
                    //    },
                    //    components: [
                    //      {
                    //        name: "SimpleTracker",
                    //        props: {
                    //          title: "Active Filters",
                    //          showRemoveButton: true,
                    //          activeComponents: activeComponents,
                    //          onRemoveComponent: (componentId: string) => {
                    //            switch (componentId) {
                    //              case "meterId-filter":
                    //                handleFilterChange("meterId", "");
                    //                break;
                    //              case "status-filter":
                    //                handleFilterChange("status", "all");
                    //                break;
                    //              case "alertType-filter":
                    //                handleFilterChange("alertType", "all");
                    //                break;
                    //              case "dateRange-filter":
                    //                handleDateRangeChange("", "");
                    //                break;
                    //              default:
                    //                console.log("Remove component:", componentId);
                    //            }
                    //          },
                    //          onComponentClick: (componentId: string) => {
                    //            console.log("Clicked on component:", componentId);
                    //          },
                    //        },
                    //      },
                    //    ],
                    //  }] : []),

                    // Alert Statistics Cards
                    {
                        layout: {
                            type: "grid",
                            columns: 4,
                            gap: "gap-4",
                            className:
                                "border border-primary-border dark:border-dark-border rounded-3xl p-4 bg-background-secondary dark:bg-primary-dark-light",
                        },
                        components: [
                            {
                                name: "SectionHeader",
                                props: {
                                    title: "Event Statistics",
                                    titleLevel: 2,
                                    titleSize: "md",
                                    titleVariant: "primary",
                                    titleWeight: "medium",
                                    titleAlign: "left",
                                },
                                span: { col: 4, row: 1 },
                            },
                            ...alertStatsCards.map((stat) => ({
                                name: "Card",
                                props: {
                                    title: stat.title,
                                    value: stat.value,
                                    icon: stat.icon,
                                    subtitle1: stat.subtitle1,
                                    // onValueClick: stat.onValueClick,
                                    bg: stat.bg,
                                    loading: stat.loading,
                                },
                                span: { col: 1 as const, row: 1 as const },
                            })),
                        ],
                    },

                    // Charts Section
                    {
                        layout: {
                            type: "grid",
                            columns: 2,
                            gap: "gap-4",
                            rows: [
                                {
                                    layout: "grid",
                                    gridColumns: 1,
                                    span: { col: 2, row: 1 },
                                    columns: [
                                        {
                                            name: "StackedBarChart",
                                            props: {
                                                xAxisData: timelineData.hours,
                                                seriesData:
                                                    timelineData.hourlySeries,
                                                height: 300,
                                                showHeader: true,
                                                headerTitle:
                                                    filterValues.dateRange
                                                        .start ||
                                                    filterValues.dateRange.end
                                                        ? `Event Timeline (Hourly - ${
                                                              filterValues
                                                                  .dateRange
                                                                  .start ||
                                                              "Start"
                                                          } to ${
                                                              filterValues
                                                                  .dateRange
                                                                  .end || "End"
                                                          })`
                                                        : "Event Timeline (Today - Hourly)",
                                                showDownloadButton: true,
                                                onDownload: handleChartDownload,
                                                isLoading: isChartLoading,
                                                isTimeFormat: true,
                                                timeFormat: "24h",
                                                timeInterval: 60,
                                            },
                                        },
                                    ],
                                },
                                {
                                    layout: "grid",
                                    gridColumns: 1,
                                    span: { col: 2, row: 1 },
                                    columns: [
                                        {
                                            name: "BarChart",
                                            props: {
                                                xAxisData:
                                                    getAlertTimelineData()
                                                        .xAxisData,
                                                seriesColors: [
                                                    "#163b7c",
                                                    "#55b56c",
                                                ], // Force brand colors
                                                seriesData:
                                                    getAlertTimelineData()
                                                        .seriesData,
                                                height: 300,
                                                showHeader: true,
                                                headerTitle:
                                                    filterValues.dateRange
                                                        .start ||
                                                    filterValues.dateRange.end
                                                        ? `${alertTimelineRange} Alert Timeline (${
                                                              filterValues
                                                                  .dateRange
                                                                  .start ||
                                                              "Start"
                                                          } to ${
                                                              filterValues
                                                                  .dateRange
                                                                  .end || "End"
                                                          })`
                                                        : `${alertTimelineRange} Alert Timeline`,
                                                availableTimeRanges: [
                                                    "Daily",
                                                    "Monthly",
                                                ],
                                                initialTimeRange:
                                                    alertTimelineRange,
                                                onTimeRangeChange:
                                                    handleAlertTimeRangeChange,
                                                showDownloadButton: true,
                                                onDownload: handleChartDownload,
                                                isLoading: isChartLoading,
                                            },
                                        },
                                    ],
                                },
                                {
                                    layout: "grid",
                                    gridColumns: 2,
                                    span: { col: 2, row: 1 },
                                    columns: [
                                        // {
                                        //   name: "BarChart",
                                        //   props: {
                                        //     xAxisData: trendData.months,
                                        //     seriesData: trendData.series,
                                        //     height: 300,
                                        //     showHeader: true,
                                        //     headerTitle: "Alert Trend",
                                        //     showDownloadButton: true,
                                        //     onDownload: handleChartDownload,
                                        //     isLoading: isChartLoading,
                                        //   },
                                        //   span: { col: 1, row: 1 },
                                        // },
                                        {
                                            name: "PieChart",
                                            props: {
                                                data: pieData,
                                                height: 300,
                                                showHeader: true,
                                                headerTitle:
                                                    "Current Month Event Types Distribution",
                                                showDownloadButton: true,
                                                isLoading: isChartLoading,
                                                onClick: (
                                                    segmentName?: string
                                                ) => {
                                                    if (segmentName) {
                                                        navigate(
                                                            `/meter-alert-table?type=${segmentName
                                                                .toLowerCase()
                                                                .replace(
                                                                    /\s+/g,
                                                                    "-"
                                                                )}`
                                                        );
                                                    }
                                                },
                                                showStatsSection: true,
                                                //  Avg: tamperTypesStats.average,
                                                valueUnit: "",
                                                totalCount:
                                                    tamperTypesStats.totalCount,
                                                totalTypes:
                                                    tamperTypesStats.totalTypes,
                                                useDynamicColors: true,
                                                colorPalette: "status",
                                                onDownload: () => {
                                                    handleChartDownload();
                                                },
                                            },
                                            span: { col: 1, row: 1 },
                                        },
                                        {
                                            name: "ActivityLog",
                                            props: {
                                                title: "Top Meters by Event Count",
                                                entries: activityLogData,
                                                maxHeight: "h-80",
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },

                    // Alert Table Section
                    {
                        layout: {
                            type: "grid" as const,
                            className: "",
                            columns: 1,
                        },
                        components: [
                            {
                                name: "Table",
                                props: {
                                    data: alertTableData,
                                    columns: alertTableColumns,
                                    showHeader: true,
                                    headerTitle: "Current Month Event Details",
                                    searchable: true,
                                    sortable: true,
                                    initialRowsPerPage: 10,
                                    showActions: true,
                                    text: "Events Management Table",
                                    onRowClick: (row: any) =>
                                        navigate(`/alert-detail/${row.dtrId}`),
                                    onView: (row: any) =>
                                        navigate(`/alert-detail/${row.dtrId}`),
                                    pagination: true,
                                    loading: isTableLoading,
                                    emptyMessage: "No alerts found",
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
