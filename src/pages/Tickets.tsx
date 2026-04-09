import { lazy } from 'react';
import { Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
const Page = lazy(() => import('SuperAdmin/Page'));
// Define TableData type locally since we're using federated components
interface TableData {
  [key: string]: string | number | boolean | null | undefined;
}
import { exportChartData } from '../utils/excelExport';
import { apiClient } from '../api/apiUtils';

// API Response Types
interface TicketResponse {
  id: number;
  ticketNumber: string;
  title: string;
  description: string;
  type: string;
  category: string;
  priority: string;
  status: string;
  appId: number;
  createdById: number;
  assignedToId: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  tags: string[];
  createdBy: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
  };
  assignedTo: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
  } | null;
  app: {
    id: number;
    name: string;
    subdomain: string;
  };
  comments: any[];
  _count: {
    comments: number;
    attachments: number;
  };
}

interface ApiResponse {
  status: string;
  timestamp: string;
  traceId: string;
  message: string;
  meta: {
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      pageSize: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
  data: TicketResponse[];
}

// Dummy data for fallback
const dummyTicketStats = {
  total: 0,
  open: 0,
  inProgress: 0,
  resolved: 0,
  closed: 0,
};

const dummyTicketTrends = {
  xAxisData: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  seriesData: [
    {
      name: 'Open Tickets',
      data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      color: '#55b56c',
    },
    {
      name: 'In Progress Tickets',
      data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      color: '#55b56c',
    },
    {
      name: 'Resolved Tickets',
      data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      name: 'Closed Tickets',
      data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  ],
  seriesColors: ['#163b7c', '#55b56c', '#dc272c', '#ed8c22'],
};

const dummyTickets: TableData[] = [];

// Helper function to calculate statistics from tickets array
const calculateStats = (tickets: TicketResponse[]) => {
  const stats = {
    total: tickets.length,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
  };

  tickets.forEach(ticket => {
    const status = ticket.status?.toUpperCase();
    if (status === 'OPEN') {
      stats.open++;
    } else if (status === 'IN_PROGRESS' || status === 'INPROGRESS') {
      stats.inProgress++;
    } else if (status === 'RESOLVED') {
      stats.resolved++;
    } else if (status === 'CLOSED') {
      stats.closed++;
    }
  });

  return stats;
};

// Helper function to calculate trends from tickets array
const calculateTrends = (tickets: TicketResponse[]) => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthData: { [key: string]: { open: number; inProgress: number; resolved: number; closed: number } } = {};

  // Initialize all months with zeros
  monthNames.forEach(month => {
    monthData[month] = { open: 0, inProgress: 0, resolved: 0, closed: 0 };
  });

  // Process each ticket
  tickets.forEach(ticket => {
    if (ticket.createdAt) {
      const date = new Date(ticket.createdAt);
      const monthIndex = date.getMonth();
      const monthName = monthNames[monthIndex];
      const status = ticket.status?.toUpperCase();

      if (monthData[monthName]) {
        if (status === 'OPEN') {
          monthData[monthName].open++;
        } else if (status === 'IN_PROGRESS' || status === 'INPROGRESS') {
          monthData[monthName].inProgress++;
        } else if (status === 'RESOLVED') {
          monthData[monthName].resolved++;
        } else if (status === 'CLOSED') {
          monthData[monthName].closed++;
        }
      }
    }
  });

  // Build series data
  const seriesData = [
    {
      name: 'Open Tickets',
      data: monthNames.map(month => monthData[month].open),
      color: '#55b56c',
    },
    {
      name: 'In Progress Tickets',
      data: monthNames.map(month => monthData[month].inProgress),
      color: '#55b56c',
    },
    {
      name: 'Resolved Tickets',
      data: monthNames.map(month => monthData[month].resolved),
    },
    {
      name: 'Closed Tickets',
      data: monthNames.map(month => monthData[month].closed),
    },
  ];

  return {
    xAxisData: monthNames,
    seriesData,
    seriesColors: ['#163b7c', '#55b56c', '#dc272c', '#ed8c22'],
  };
};

// Helper function to map API ticket to table format
const mapTicketToTableFormat = (ticket: TicketResponse, index: number): TableData => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '0';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '0';
    }
  };

  const formatPriority = (priority: string) => {
    if (!priority) return '0';
    return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  };

  const formatStatus = (status: string) => {
    if (!status) return '0';
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return {
    sNo: index + 1,
    id: ticket.id,
    ticketNumber: ticket.ticketNumber || '0',
    subject: ticket.title || '0',
    category: ticket.category
      ? ticket.category
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ')
      : '0',
    priority: formatPriority(ticket.priority),
    status: formatStatus(ticket.status),
    createdAt: formatDate(ticket.createdAt),
    description: ticket.description || '0',
  };
};

export default function Tickets() {
  const navigate = useNavigate();

  // State for API data with smart fallbacks
  const [ticketStats, setTicketStats] = useState(dummyTicketStats);
  const [ticketTrends, setTicketTrends] = useState(dummyTicketTrends);
  const [tickets, setTickets] = useState<TableData[]>(dummyTickets);
  const [_allTickets, _setAllTickets] = useState<TicketResponse[]>([]); // Store all tickets for stats/trends

  // Loading states
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isTrendsLoading, setIsTrendsLoading] = useState(true);
  const [isTableLoading, setIsTableLoading] = useState(true);

  // State for tracking failed APIs
  const [failedApis, setFailedApis] = useState<
    Array<{
      id: string;
      name: string;
      retryFunction: () => Promise<void>;
      errorMessage: string;
    }>
  >([]);

  const [serverPagination, setServerPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Brand green icon style
  const brandGreenIconStyle = {
    filter:
      'brightness(0) saturate(100%) invert(52%) sepia(60%) saturate(497%) hue-rotate(105deg) brightness(95%) contrast(90%)',
  };

  const upsertFailedApi = (apiEntry: {
    id: string;
    name: string;
    retryFunction: () => Promise<void>;
    errorMessage: string;
  }) => {
    setFailedApis((prev) => {
      const idx = prev.findIndex((p) => p.id === apiEntry.id);
      if (idx === -1) return [...prev, apiEntry];
      return prev.map((p) => (p.id === apiEntry.id ? apiEntry : p));
    });
  };

  const clearFailedApi = (apiId: string) => {
    setFailedApis((prev) => prev.filter((api) => api.id !== apiId));
  };

  // Enhanced stats array with smart fallbacks and conditional rendering
  const statsArray = [
    {
      key: 'total',
      label: 'Total Tickets',
      icon: 'icons/open-tickets.svg',
      subtitle1: ticketStats ? `Total active tickets` : '- active tickets',
      subtitle2: ticketStats ? 'Last 24 hours' : '0',
      iconStyle: brandGreenIconStyle,
    },
    {
      key: 'open',
      label: 'Open Tickets',
      icon: 'icons/check-circle.svg',
      subtitle1: ticketStats ? `Successfully resolved` : '- resolved',
      subtitle2: ticketStats ? 'Today' : '0',
      iconStyle: brandGreenIconStyle,
    },
    {
      key: 'inProgress',
      label: 'In Progress Tickets',
      icon: 'icons/progress.svg',
      subtitle1: ticketStats ? `Customer satisfaction` : '- satisfaction',
      subtitle2: ticketStats ? 'Target: 4h' : '- target',
      iconStyle: brandGreenIconStyle,
    },
    {
      key: 'resolved',
      label: 'Resolved Tickets',
      icon: 'icons/alert-triggered.svg',
      subtitle1: ticketStats ? `Requires attention` : '- attention',
      subtitle2: ticketStats ? 'High priority' : '- priority',
      iconStyle: brandGreenIconStyle,
    },
    {
      key: 'closed',
      label: 'Closed Tickets',
      icon: 'icons/closed.svg',
      subtitle1: ticketStats
        ? `Based on ${ticketStats.total || '0'} reviews`
        : 'Based on - reviews',
      subtitle2: ticketStats ? 'This month' : '- month',
      iconStyle: brandGreenIconStyle,
    },
  ];

  async function retryStatsTrendsAPI() {
    setIsStatsLoading(true);
    setIsTrendsLoading(true);
    await fetchAllTicketsForStats();
    setTimeout(() => {
      setIsStatsLoading(false);
      setIsTrendsLoading(false);
    }, 1000);
  }

  // Fetch stats and trends using dedicated APIs
  async function fetchAllTicketsForStats() {
    // -------- 1) Stats API (widgets) --------
    try {
      const statsJson: any = await apiClient.get('/tickets/stats');

      // Support both: bare stats object OR { status, data } wrapper OR array
      let statsPayload: any = statsJson;
      if (statsJson && typeof statsJson === 'object' && !Array.isArray(statsJson)) {
        if (statsJson.status === 'success' && statsJson.data) {
          statsPayload = statsJson.data;
        }
      }

      if (Array.isArray(statsPayload)) {
        // Backend returned raw tickets array – derive stats from it
        const stats = calculateStats(statsPayload as TicketResponse[]);
        setTicketStats(stats);
      } else {
        const safeStats = statsPayload || {};
        setTicketStats({
          total: safeStats.total ?? 0,
          open: safeStats.open ?? 0,
          inProgress: safeStats.inProgress ?? 0,
          resolved: safeStats.resolved ?? 0,
          closed: safeStats.closed ?? 0,
        });
      }

      clearFailedApi('stats');
    } catch (err: any) {
      console.error('Error fetching ticket stats:', err);
      setTicketStats(dummyTicketStats);
      upsertFailedApi({
        id: 'stats',
        name: 'Ticket Statistics',
        retryFunction: retryStatsTrendsAPI,
        errorMessage: err?.message || 'Failed to load Tickets Statistics. Please try again.',
      });
    }

    // -------- 2) Trends API (graph) --------
    try {
      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dd = pad(today.getDate());
      const mm = pad(today.getMonth() + 1);
      const yyyy = today.getFullYear();
      const dateStr = `${dd}/${mm}/${yyyy}`; // DD/MM/YYYY as per given example

      const trendsJson: any = await apiClient.get(
        `/tickets/trends?startDate=${encodeURIComponent(dateStr)}&endDate=${encodeURIComponent(
          dateStr
        )}`
      );

      // Support both: direct trends object OR { status, data }
      let trendsPayload: any = trendsJson;
      if (trendsJson && typeof trendsJson === 'object' && !Array.isArray(trendsJson)) {
        if (trendsJson.status === 'success' && trendsJson.data) {
          trendsPayload = trendsJson.data;
        }
      }

      if (
        trendsPayload &&
        Array.isArray(trendsPayload.xAxisData) &&
        Array.isArray(trendsPayload.seriesData)
      ) {
        setTicketTrends({
          xAxisData: trendsPayload.xAxisData,
          seriesData: trendsPayload.seriesData,
          seriesColors: trendsPayload.seriesColors || dummyTicketTrends.seriesColors,
        });
      } else if (Array.isArray(trendsPayload)) {
        // Fallback: backend returned an array of tickets; derive trends
        const derivedTrends = calculateTrends(trendsPayload as TicketResponse[]);
        setTicketTrends(derivedTrends);
      } else {
        setTicketTrends(dummyTicketTrends);
      }

      clearFailedApi('trends');
    } catch (err: any) {
      console.error('Error fetching ticket trends:', err);
      setTicketTrends(dummyTicketTrends);
      upsertFailedApi({
        id: 'trends',
        name: 'Ticket Trends',
        retryFunction: retryStatsTrendsAPI,
        errorMessage: err?.message || 'Failed to load Tickets Trends. Please try again.',
      });
    }
  }

  // Retry function for Table API
  const retryTableAPI = async (page = 1, limit = 10, searchTerm = '') => {
    setIsTableLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));

      if (searchTerm && searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const data: any = await apiClient.get(`/tickets/table?${params.toString()}`);
      
      console.log('📥 Table API Response received:', data);

      // Handle bare array response (e.g. [] or [ ... ]) as a successful
      // "no data" or data response and do NOT show the Error component.
      if (Array.isArray(data)) {
        console.log('✅ Table API returned an array. Length:', data.length);
        const mappedTickets = data.map((ticket: TicketResponse, index: number) =>
          mapTicketToTableFormat(ticket, index)
        );
        setTickets(mappedTickets as any);
        // No pagination info available, so fall back to simple zero-state
        setServerPagination({
          currentPage: page,
          totalPages: 1,
          totalCount: data.length,
          limit,
          hasNextPage: false,
          hasPrevPage: false,
        });
        setFailedApis((prev) => prev.filter((api) => api.id !== 'table'));
        return;
      }

      const typedData = data as ApiResponse & {
        success?: boolean;
        pagination?: {
          currentPage?: number;
          totalPages?: number;
          totalCount?: number;
          limit?: number;
          hasNextPage?: boolean;
          hasPrevPage?: boolean;
        };
      };
      
      console.log('📥 Typed Table API Response received:');
      console.log('  - Status:', typedData.status);
      console.log(
        '  - Data array length:',
        Array.isArray(typedData.data) ? typedData.data.length : 'Not an array'
      );
      console.log('  - Pagination:', typedData.meta?.pagination || typedData.pagination);

      const isSuccess = typedData.status === 'success' || typedData.success === true;

      if (isSuccess && Array.isArray(typedData.data)) {
        console.log('✅ Table Success! Processing', typedData.data.length, 'tickets');
        // Map tickets to table format
        const mappedTickets = typedData.data.map((ticket, index) =>
          mapTicketToTableFormat(ticket, index)
        );
        console.log('📋 Mapped tickets for table:', mappedTickets);
        setTickets(mappedTickets as any);

        // Update pagination from meta.pagination OR pagination
        const pagination = typedData.meta?.pagination || typedData.pagination;
        if (pagination) {
          setServerPagination({
            currentPage: pagination.currentPage || 1,
            totalPages: Math.max(1, pagination.totalPages ?? 1),
            totalCount: pagination.totalCount || 0,
            limit: (pagination as any).pageSize || (pagination as any).limit || limit,
            hasNextPage: pagination.hasNextPage || false,
            hasPrevPage: pagination.hasPrevPage || false,
          });
        }

        // Remove from failed APIs on success
        setFailedApis(prev => prev.filter(api => api.id !== 'table'));
      } else {
        throw new Error('Table API returned unsuccessful response');
      }
    } catch (err: any) {
      console.error('Error in Tickets Table:', err);
      setTickets([]);

      // Add to failed APIs
      setFailedApis(prev => {
        if (!prev.find(api => api.id === 'table')) {
          return [
            ...prev,
            {
              id: 'table',
              name: 'Tickets Table',
              retryFunction: () => retryTableAPI(page, limit, searchTerm),
              errorMessage: err.message || 'Failed to load Tickets Table. Please try again.',
            },
          ];
        }
        return prev;
      });
    } finally {
      // Add a small delay to make loading state visible
      setTimeout(() => {
        setIsTableLoading(false);
      }, 1000);
    }
  };

  // Retry specific API
  const retrySpecificAPI = (apiId: string) => {
    const api = failedApis.find(a => a.id === apiId);
    if (api) {
      api.retryFunction();
    }
  };

  // Fetch ticket stats and trends on mount
  useEffect(() => {
    retryStatsTrendsAPI();
  }, []);

  // Fetch tickets table on mount
  useEffect(() => {
    const fetchTable = async () => {
      await retryTableAPI(1, 10);
    };

    fetchTable();
  }, []);

  // Refresh data when component comes into focus (e.g., after adding a ticket)
  useEffect(() => {
    const handleFocus = () => {
      // Refresh stats, trends, and table when window regains focus
      fetchAllTicketsForStats();
      retryTableAPI(serverPagination.currentPage, serverPagination.limit);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [serverPagination.currentPage, serverPagination.limit]);

  // Handle table pagination
  const handlePageChange = (page: number, limit: number) => {
    retryTableAPI(page, limit);
  };

  // Handle table search
  const handleSearch = (searchTerm: string) => {
    // Reset to first page when searching
    retryTableAPI(1, serverPagination.limit, searchTerm);
  };

  // Handle ticket actions
  const handleViewTicket = (row: TableData) => {
    console.log('Viewing ticket:', row);
    navigate(`/tickets/${row.ticketNumber}`);
  };

  const handleEditTicket = (row: TableData) => {
    console.log('Editing ticket:', row);
    navigate(`/tickets/${row.ticketNumber}/edit`);
  };

  const handleDeleteTicket = (row: TableData) => {
    console.log('Deleting ticket:', row);
    if (confirm(`Are you sure you want to delete ticket ${row.ticketNumber}?`)) {
      console.log('Ticket deleted:', row.id);
    }
  };

  const [tableColumns] = useState([
    { key: 'sNo', label: 'S.No' },
    { key: 'ticketNumber', label: 'Ticket ID' },
    { key: 'subject', label: 'Subject' },
    { key: 'category', label: 'Category' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Created Date' },
  ]);

  // Chart download handler
  const handleChartDownload = () => {
    if (ticketTrends?.xAxisData && ticketTrends?.seriesData) {
      exportChartData(ticketTrends.xAxisData, ticketTrends.seriesData, 'ticket-statistics-data');
    }
  };

  // Export function for tickets data
  const handleExportData = () => {
    import('xlsx').then((XLSX) => {
      const workbook = XLSX.utils.book_new();

      // 1. Ticket Statistics Cards
      const ticketStatsExportData = statsArray.map((stat) => ({
        Metric: stat.label,
        Value: ticketStats
          ? ticketStats[stat.key as keyof typeof ticketStats] === 0
            ? '0'
            : ticketStats[stat.key as keyof typeof ticketStats]
          : '0',
        Subtitle1: stat.subtitle1,
        Subtitle2: stat.subtitle2,
      }));

      // 2. Tickets Table Data
      const ticketsTableExportData = tickets.map((ticket, index) => ({
        'S.No': index + 1,
        'Ticket Number': ticket.ticketNumber || '-',
        Subject: ticket.subject || '-',
        Category: ticket.category || '-',
        Priority: ticket.priority || '-',
        Status: ticket.status || '-',
        'Created Date': ticket.createdAt || '-',
        Description: ticket.description || '-',
      }));

      // Create sheets with auto-sizing
      const ticketStatsSheet = XLSX.utils.json_to_sheet(ticketStatsExportData);
      const ticketsTableSheet = XLSX.utils.json_to_sheet(ticketsTableExportData);

      // Auto-size columns for better readability
      const setAutoWidth = (worksheet: any) => {
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        const colWidths: any[] = [];

        for (let C = range.s.c; C <= range.e.c; ++C) {
          let maxWidth = 10;
          for (let R = range.s.r; R <= range.e.r; ++R) {
            const cellAddress = XLSX.utils.encode_cell({
              r: R,
              c: C,
            });
            const cell = worksheet[cellAddress];
            if (cell && cell.v) {
              const cellLength = cell.v.toString().length;
              maxWidth = Math.max(maxWidth, cellLength);
            }
          }
          colWidths[C] = { wch: Math.min(maxWidth + 2, 50) }; // Max width 50
        }
        worksheet['!cols'] = colWidths;
      };

      // Apply auto-width to all sheets
      [ticketStatsSheet, ticketsTableSheet].forEach((sheet) => setAutoWidth(sheet));

      // Append sheets to workbook
      XLSX.utils.book_append_sheet(workbook, ticketStatsSheet, 'Ticket Statistics');
      XLSX.utils.book_append_sheet(workbook, ticketsTableSheet, 'Tickets List');

      const excelBuffer = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      });

      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tickets-list.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    });
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Page
        sections={[
          // Error Section - Above PageHeader
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
                            visibleErrors: failedApis.map((api) => api.errorMessage),
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
          {
            layout: {
              type: 'row',
              className: '',
            },
            components: [
              {
                name: 'PageHeader',
                props: {
                  title: 'Tickets',
                  onBackClick: () => window.history.back(),
                  backButtonText: 'Back to Dashboard',
                  buttonsLabel: 'Add Ticket',
                  variant: 'primary',
                  onClick: () => navigate('/add-ticket'),
                  showMenu: true,
                  showDropdown: true,
                  menuItems: [
                    { id: 'add', label: 'Add Ticket' },
                    { id: 'export', label: 'Export' },
                  ],
                  onMenuItemClick: (itemId: string) => {
                    console.log(`Filter by: ${itemId}`);
                    if (itemId === 'add') {
                      navigate('/add-ticket');
                    } else if (itemId === 'export') {
                      handleExportData();
                    }
                  },
                },
              },
            ],
          },
          {
            layout: {
              type: 'column',
              rows: [
                {
                  layout: 'row',
                  columns: statsArray.map((stat) => ({
                    name: 'Card',
                    props: {
                      title: stat.label,
                      value: ticketStats
                        ? ticketStats[stat.key as keyof typeof ticketStats] === 0
                          ? '0'
                          : ticketStats[stat.key as keyof typeof ticketStats]
                        : '0',
                      icon: stat.icon,
                      subtitle1: stat.subtitle1,
                      subtitle2: stat.subtitle2,
                      iconStyle: stat.iconStyle,
                      bg: 'bg-stat-icon-gradient',
                      loading: isStatsLoading,
                    },
                  })),
                },
              ],
            },
          },
          {
            layout: {
              type: 'grid',
              columns: 1,
              rows: [
                {
                  layout: 'grid',
                  gridColumns: 1,
                  columns: [
                    {
                      name: 'BarChart',
                      props: {
                        xAxisData: ticketTrends?.xAxisData || dummyTicketTrends.xAxisData,
                        seriesData: ticketTrends?.seriesData || dummyTicketTrends.seriesData,
                        seriesColors: ticketTrends?.seriesColors || dummyTicketTrends.seriesColors,
                        height: '400px',
                        showHeader: true,
                        headerTitle: 'Ticket Statistics',
                        dateRange: '2024',
                        showDownloadButton: true,
                        headerHeight: 'h-12',
                        ariaLabel: 'Monthly ticket statistics chart',
                        onDownload: handleChartDownload,
                        isLoading: isTrendsLoading,
                      },
                    },
                  ],
                },
              ],
            },
          },
          {
            layout: {
              type: 'grid',
              columns: 1,
              gap: 'gap-4',
              rows: [
                {
                  layout: 'grid',
                  gridColumns: 1,
                  gap: 'gap-4',
                  className: 'pb-4',
                  columns: [
                    {
                      name: 'Table',
                      props: {
                        data: tickets,
                        columns: tableColumns,
                        showHeader: true,
                        headerTitle: 'Recent Tickets',
                        dateRange: 'Last 30 days',
                        headerClassName: 'h-18',
                        searchable: true,
                        sortable: true,
                        pagination: true,
                        initialRowsPerPage: 10,
                        emptyMessage: isTableLoading ? 'Loading tickets...' : '0 Data',
                        showActions: true,
                        text: 'Ticket Management Table',
                        onEdit: handleEditTicket,
                        onDelete: handleDeleteTicket,
                        onView: handleViewTicket,
                        onPageChange: handlePageChange,
                        onSearch: handleSearch,
                        serverPagination: serverPagination,
                        availableTimeRanges: [],
                        isLoading: isTableLoading,
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
