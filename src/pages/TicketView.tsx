import { lazy } from 'react';
import { Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
const Page = lazy(() => import('SuperAdmin/Page'));
import BACKEND_URL from '../config';
import { getStoredToken, logout } from '../api/subAppAuth';

// API Response Types (same as Tickets.tsx)
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

// Helper function to get the correct API URL (same as Tickets.tsx)
const getApiUrl = (endpoint: string): string => {
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       import.meta.env.DEV;
  
  let baseUrl: string;
  if (isDevelopment) {
    baseUrl = 'http://localhost:3001/api';
  } else {
    const backendUrl = BACKEND_URL || '';
    if (backendUrl.startsWith('http')) {
      try {
        const urlObj = new URL(backendUrl);
        baseUrl = `${urlObj.protocol}//${urlObj.host}/api`;
      } catch (e) {
        baseUrl = `${window.location.protocol}//${window.location.host}/api`;
      }
    } else {
      baseUrl = `${window.location.origin}/api`;
    }
  }
  
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  const finalUrl = `${baseUrl}/${normalizedEndpoint}`;
  
  console.log('📋 API URL Construction (TicketView):');
  console.log('  - Environment:', isDevelopment ? 'Development (localhost)' : 'Production');
  console.log('  - Base URL:', baseUrl);
  console.log('  - Endpoint:', normalizedEndpoint);
  console.log('  - ✅ Final API URL:', finalUrl);
  
  return finalUrl;
};

// Helper function to get token (same as Tickets.tsx)
const getToken = (): string | null => {
  const possibleKeys = ['my-gate', 'token', 'accessToken', 'authToken'];
  const storages = [localStorage, sessionStorage];
  
  for (const storage of storages) {
    for (const key of possibleKeys) {
      const token = storage.getItem(key);
      if (token) {
        console.log(`✅ Token found in ${storage === localStorage ? 'localStorage' : 'sessionStorage'} with key: ${key}`);
        return token;
      }
    }
  }
  
  const token = getStoredToken();
  if (token) {
    console.log('✅ Token found via getStoredToken()');
    return token;
  }
  
  console.warn('⚠️ No token found in any storage location');
  return null;
};

// Helper function to make authenticated API requests (same as Tickets.tsx)
const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getToken();

  if (!token) {
    console.error('❌ No authentication token found!');
    throw new Error('Authentication required. Please login again.');
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  console.log('📤 Making API request to:', url);
  console.log('📤 Request method:', options.method || 'GET');

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log('📥 Response status:', response.status, response.statusText);

    if (response.status === 401) {
      console.error('❌ 401 Unauthorized - Token expired or invalid');
      console.warn('🔄 Redirecting to login...');
      logout();
      throw new Error('Your session has expired. Please login again.');
    }

    if (response.status === 403) {
      console.error('❌ 403 Forbidden - Access denied');
      console.warn('🔄 Redirecting to login...');
      logout();
      throw new Error('You do not have permission to access this resource.');
    }

    if (response.status === 404) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ 404 Not Found - Endpoint does not exist');
      console.error('❌ Requested URL:', url);
      console.error('❌ Error details:', errorData);
      throw new Error(`API endpoint not found: ${url}`);
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes('session has expired')) {
      throw error;
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
    }
    throw error;
  }
};

// Helper function to map API ticket to display format
const mapTicketToDisplayFormat = (ticketData: TicketResponse) => {
  const formatStatus = (status: string): string => {
    if (!status) return '-';
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatCategory = (category: string): string => {
    if (!category) return '-';
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const createdByName = ticketData.createdBy 
    ? `${ticketData.createdBy.firstName || ''} ${ticketData.createdBy.lastName || ''}`.trim() || ticketData.createdBy.username
    : '-';

  const assignedToName = ticketData.assignedTo 
    ? `${ticketData.assignedTo.firstName || ''} ${ticketData.assignedTo.lastName || ''}`.trim() || ticketData.assignedTo.username
    : 'Unassigned';

  return {
    id: ticketData.id || 0,
    ticketNumber: ticketData.ticketNumber || '-',
    uid: ticketData.app?.subdomain || ticketData.appId?.toString() || '-',
    subject: ticketData.title || '-',
    status: formatStatus(ticketData.status),
    customerName: ticketData.customerName || createdByName || '-',
    category: formatCategory(ticketData.category),
    priority: ticketData.priority ? ticketData.priority.charAt(0).toUpperCase() + ticketData.priority.slice(1).toLowerCase() : '-',
    assignedTo: assignedToName,
    createdAt: ticketData.createdAt || '-',
    lastUpdated: ticketData.updatedAt || '-',
    description: ticketData.description || '-',
    location: ticketData.app?.name || '-',
    email: ticketData.customerEmail || '-',
    unitNumber: ticketData.app?.name || '-',
    meterId: ticketData.appId?.toString() || '-',
    mobile: ticketData.customerPhone || '-',
    connectionType: formatCategory(ticketData.type) || '-',
    autoDateFormat: true,
  };
};

// Display Ticket Interface
interface Ticket {
  id: number;
  ticketNumber: string;
  subject: string;
  status: string;
  customerName: string;
  category: string;
  priority: string;
  assignedTo: string;
  createdAt: string;
  lastUpdated: string;
  description: string;
  uid: string;
  location: string;
  email: string;
  unitNumber: string;
  meterId: string;
  mobile: string;
  connectionType: string;
  autoDateFormat?: boolean;
}

interface ActivityLogEntry {
  id: string | number;
  description: string;
  timestamp: string;
  status?: string;
  subText?: string;
  author?: string;
}

export default function TicketView() {
  const navigate = useNavigate();
  const { ticketId } = useParams<{ ticketId: string }>();

  // State for tracking failed APIs
  const [failedApis, setFailedApis] = useState<Array<{
    id: string;
    name: string;
    retryFunction: () => Promise<void>;
    errorMessage: string;
  }>>([]);

  // Loading states
  const [isTicketLoading, setIsTicketLoading] = useState(true);
  const [_isActivityLoading, setIsActivityLoading] = useState(true);

  // Ticket data with default values
  const [ticket, setTicket] = useState<Ticket>({
    id: 0,
    ticketNumber: '-',
    uid: '-',
    subject: '-',
    status: '-',
    customerName: '-',
    category: '-',
    priority: '-',
    assignedTo: '-',
    createdAt: '-',
    lastUpdated: '-',
    description: '-',
    location: '-',
    email: '-',
    unitNumber: '-',
    meterId: '-',
    mobile: '-',
    connectionType: '-',
  });

  // Activity log data
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  // Retry specific API function
  const retrySpecificAPI = (apiId: string) => {
    const api = failedApis.find((a) => a.id === apiId);
    if (api) {
      api.retryFunction();
    }
  };

  // Fetch ticket data from API (same pattern as Tickets.tsx)
  const fetchTicketData = async () => {
    if (!ticketId) {
      setFailedApis([{
        id: 'ticketData',
        name: 'Ticket Data',
        retryFunction: fetchTicketData,
        errorMessage: 'No ticket ID provided. Please try again.',
      }]);
      setIsTicketLoading(false);
      return;
    }

    try {
      setIsTicketLoading(true);
      setFailedApis(prev => prev.filter(api => api.id !== 'ticketData'));

      const url = getApiUrl(`tickets/${ticketId}`);
      console.log('📥 Fetching ticket data from:', url);

      const res = await authenticatedFetch(url);

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        throw new Error(`API failed with status ${res.status}: ${errorText}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API returned non-JSON response');
      }

      const responseData: any = await res.json();

      console.log('📥 API Response received:');
      console.log('  - Full Response:', responseData);
      console.log('  - Response Type:', typeof responseData);
      console.log('  - Has status?', 'status' in responseData);
      console.log('  - Has data?', 'data' in responseData);
      console.log('  - Has id?', 'id' in responseData);
      console.log('  - Has ticketNumber?', 'ticketNumber' in responseData);

      // Handle different response structures
      let ticketData: TicketResponse | null = null;

      // Case 1: {status: 'success', data: {...}}
      if (responseData.status === 'success' && responseData.data) {
        ticketData = responseData.data;
        console.log('✅ Found ticket data in response.data');
      }
      // Case 2: Direct ticket object {id, ticketNumber, ...}
      else if (responseData.id || responseData.ticketNumber) {
        ticketData = responseData as TicketResponse;
        console.log('✅ Found ticket data as direct object');
      }
      // Case 3: {success: true, data: {...}}
      else if (responseData.success && responseData.data) {
        ticketData = responseData.data;
        console.log('✅ Found ticket data in response.data (success format)');
      }
      // Case 4: Check if data exists but status is different
      else if (responseData.data && (responseData.data.id || responseData.data.ticketNumber)) {
        ticketData = responseData.data;
        console.log('✅ Found ticket data in response.data (any status)');
      }

      if (ticketData) {
        const mappedTicket = mapTicketToDisplayFormat(ticketData);
        console.log('✅ Ticket data mapped successfully:', mappedTicket);
        console.log('✅ Setting ticket state...');
        setTicket(mappedTicket);
        setFailedApis(prev => prev.filter(api => api.id !== 'ticketData'));
        setIsTicketLoading(false); // Explicitly clear loading on success
        console.log('✅ Ticket state updated, loading should stop now');
      } else {
        console.error('❌ Could not extract ticket data from response');
        console.error('❌ Response structure:', JSON.stringify(responseData, null, 2));
        setIsTicketLoading(false); // Clear loading even on error
        throw new Error('Invalid API response: Could not find ticket data');
      }
    } catch (err: any) {
      console.error('❌ Error fetching ticket data:', err);
      
      // Always clear loading first
      setIsTicketLoading(false);
      console.log('🛑 Loading state cleared in catch block');
      
      if (err.message && (
        err.message.includes('session has expired') || 
        err.message.includes('permission') ||
        err.message.includes('Authentication required')
      )) {
        setFailedApis(prev => {
          if (!prev.find(api => api.id === 'ticketData')) {
            return [...prev, {
              id: 'ticketData',
              name: 'Ticket Data',
              retryFunction: fetchTicketData,
              errorMessage: err.message || 'Failed to load Ticket Data. Please try again.',
            }];
          }
          return prev;
        });
        return; // Don't throw, just return to prevent blocking
      }

      // For 404 errors, show error but stop loading
      if (err.message && err.message.includes('404')) {
        setFailedApis(prev => {
          if (!prev.find(api => api.id !== 'ticketData')) {
            return [...prev, {
              id: 'ticketData',
              name: 'Ticket Data',
              retryFunction: fetchTicketData,
              errorMessage: `Ticket not found. Please check the ticket ID: ${ticketId}`,
            }];
          }
          return prev;
        });
        return;
      }

      setFailedApis(prev => {
        if (!prev.find(api => api.id !== 'ticketData')) {
          return [...prev, {
            id: 'ticketData',
            name: 'Ticket Data',
            retryFunction: fetchTicketData,
            errorMessage: err.message || 'Failed to load Ticket Data. Please try again.',
          }];
        }
        return prev;
      });
    } finally {
      setIsTicketLoading(false);
    }
  };

  // Fetch activity log data from API
  const fetchActivityLog = async () => {
    if (!ticketId) {
      setIsActivityLoading(false);
      return;
    }

    try {
      setIsActivityLoading(true);
      setFailedApis(prev => prev.filter(api => api.id !== 'activityLog'));

      const url = getApiUrl(`tickets/${ticketId}/activity-log`);
      console.log('📥 Fetching activity log from:', url);

      const res = await authenticatedFetch(url);

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' || data.success) {
          const activityData = data.data || [];
          setActivityLog(activityData.map((item: any) => ({
            id: item.id || item.timestamp || '-',
            description: item.description || item.message || '-',
            timestamp: item.timestamp || item.createdAt || '-',
            status: item.status || '-',
            subText: item.subText || item.type || '-',
            author: item.author || (item.createdBy ? `${item.createdBy.firstName || ''} ${item.createdBy.lastName || ''}`.trim() : '-') || '-',
          })));
          setFailedApis(prev => prev.filter(api => api.id !== 'activityLog'));
        } else {
          setActivityLog([]);
        }
      } else if (res.status === 404) {
        // Activity log endpoint doesn't exist, use empty array
        setActivityLog([]);
      } else {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
    } catch (err: any) {
      console.error('❌ Error fetching activity log:', err);
      
      if (err.message && (
        err.message.includes('session has expired') || 
        err.message.includes('permission') ||
        err.message.includes('Authentication required')
      )) {
        setFailedApis(prev => {
          if (!prev.find(api => api.id !== 'activityLog')) {
            return [...prev, {
              id: 'activityLog',
              name: 'Activity Log',
              retryFunction: fetchActivityLog,
              errorMessage: err.message || 'Authentication failed. Please login again.',
            }];
          }
          return prev;
        });
        return;
      }

      // For 404 or other errors, use empty array (activity log is optional)
      if (err.message && err.message.includes('404')) {
        setActivityLog([]);
      } else {
        setFailedApis(prev => {
          if (!prev.find(api => api.id !== 'activityLog')) {
            return [...prev, {
              id: 'activityLog',
              name: 'Activity Log',
              retryFunction: fetchActivityLog,
              errorMessage: err.message || 'Failed to load Activity Log. Please try again.',
            }];
          }
          return prev;
        });
      }
    } finally {
      setIsActivityLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      if (ticketId) {
        try {
          await Promise.all([fetchTicketData(), fetchActivityLog()]);
        } catch (error) {
          console.error('❌ Error in fetchData:', error);
          // Ensure loading states are cleared even if there's an error
          setIsTicketLoading(false);
          setIsActivityLoading(false);
        }
      } else {
        // No ticketId, clear loading states
        setIsTicketLoading(false);
        setIsActivityLoading(false);
      }
    };

    fetchData();
  }, [ticketId]);

  const handleOpenTicket = () => {
    console.log('Opening ticket #', ticket.ticketNumber);
  };

  const isAdmin = false;
  const basePath = '/user/tickets';
  const userDashboardPath = '/tickets';

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Page
        style={{
          position: 'sticky',
          top: 0,
        }}
        sections={[
          // Error Section
          ...(failedApis.length > 0
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
                        visibleErrors: failedApis.map((api) => api.errorMessage),
                        showRetry: true,
                        maxVisibleErrors: 3,
                        failedApis: failedApis,
                        onRetrySpecific: retrySpecificAPI,
                      },
                    },
                  ],
                },
              ]
            : []),
          // Page Header
          {
            layout: {
              type: 'column',
              gap: 'gap-4',
            },
            components: [
              {
                name: 'PageHeader',
                props: {
                  title: `Ticket Details - #${ticket.ticketNumber !== '-' ? ticket.ticketNumber : 'Loading...'}`,
                  onBackClick: () => {
                    navigate(isAdmin ? basePath : userDashboardPath);
                  },
                  backButtonText: isAdmin ? 'Back to Tickets' : 'Back to Dashboard',
                },
              },
            ],
          },
          // Main Content
          {
            layout: {
              type: 'grid',
              columns: 5,
              gap: 'gap-4',
              rows: [
                {
                  layout: 'grid',
                  gap: 'gap-4',
                  gridColumns: 5,
                  gridRows: 2,
                  span: { col: 5, row: 1 },
                  className: '',
                  columns: [
                    {
                      name: 'TicketConversationPanel',
                      span: { col: 3, row: 1 },
                      props: {
                        title: 'Issue Details',
                        data: {
                          leftColumn: [
                            {
                              label: 'Ticket ID',
                              value: ticket.ticketNumber !== '-' ? `#${ticket.ticketNumber}` : '-',
                            },
                          ],
                        },
                        loading: isTicketLoading,
                      },
                    },
                    {
                      name: 'TicketInformationPannel',
                      span: { col: 2, row: 1 },
                      props: {
                        ticket: ticket,
                        activityLog: activityLog,
                        rightStatus: {
                          text: ticket.status !== '-' ? ticket.status : 'Loading...',
                          variant: 'default',
                          onClick: () => handleOpenTicket(),
                        },
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
