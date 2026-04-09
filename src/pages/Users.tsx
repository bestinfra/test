import { lazy } from 'react';
import { useState, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
const Page = lazy(() => import('SuperAdmin/Page'));
import { apiClient } from '../api/apiUtils';

const tableColumns = [
  { key: 'S.No', label: 'S.No' },
  { key: 'username', label: 'User Name' },
  { key: 'email', label: 'Email Address' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'role', label: 'Role' },
  // { key: 'client', label: 'Client' },
  // { key: 'lastActive', label: 'Last Active' },
  { key: 'createdDate', label: 'Created Date' },
  // Add actions column if you want to show action buttons
];

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<
    Array<{
      sNo: number;
      name: string;
      username: string;
      email: string;
      phone: string;
      role: string;
      client: string;
      createdDate: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [serverPagination, setServerPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 8,
    hasNextPage: false,
    hasPrevPage: false,
  });
  // User stats state
  const [userStats, setUserStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // State for tracking failed APIs
  const [failedApis, setFailedApis] = useState<
    Array<{
      id: string;
      name: string;
      retryFunction: () => Promise<void>;
      errorMessage: string;
    }>
  >([]);

  // Inactive modal state
  const [showInactiveModal, setShowInactiveModal] = useState(false);
  const [userToInactive, setUserToInactive] = useState<any>(null);
  const [inactiveFormData, setInactiveFormData] = useState({
    userName: '',
    reason: '',
  });

  // Filter state
  const [filters, setFilters] = useState({
    userTypes: '',
    userStatus: '',
  });

  // Dropdown options
  const userTypesOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'user', label: 'User' },
    { value: 'moderator', label: 'Moderator' },
    { value: 'accountant', label: 'Accountant' },
  ];

  const userStatusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  // Filter change handler
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const updatedFilters = {
        ...prev,
        [name]: value,
      };
      // Refetch users with new filters
      fetchUsers(1, serverPagination.limit, '', updatedFilters);
      return updatedFilters;
    });
  };

  const handlePageChange = (page: number, limit: number) => {
    fetchUsers(page, limit, '', filters);
  };

  // Handle table search
  const handleSearch = (searchTerm: string) => {
    // Reset to first page when searching, but preserve filters
    fetchUsers(1, serverPagination.limit, searchTerm, filters);
  };

  // Retry specific API
  const retrySpecificAPI = (apiId: string) => {
    const api = failedApis.find((a) => a.id === apiId);
    if (api) {
      api.retryFunction();
    }
  };

  const fetchUsers = async (
    page = 1,
    limit = 8,
    searchTerm = '',
    activeFilters?: { userTypes?: string; userStatus?: string }
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));

      if (searchTerm && searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      // Add filter parameters
      const filtersToUse = activeFilters || filters;
      if (filtersToUse.userTypes && filtersToUse.userTypes !== '') {
        params.append('roleName', filtersToUse.userTypes);
      }
      if (filtersToUse.userStatus && filtersToUse.userStatus !== '') {
        params.append('isActive', filtersToUse.userStatus === 'active' ? 'true' : 'false');
      }

      const payload = await apiClient.get(`/users?${params.toString()}`);

      if (payload.status === 'success' || payload.success) {
        const data = payload.data || payload;
        const rows = (Array.isArray(data) ? data : data?.users || []).map((u: any) => ({
          ...u,
          ['S.No']: u.sNo,
        }));
        const pagination = payload.meta?.pagination || payload.pagination || {};

        setUsers(rows);
        setServerPagination({
          currentPage: pagination.currentPage || 1,
          totalPages: pagination.totalPages || 1,
          totalCount: pagination.totalCount || 0,
          limit: pagination.limit || limit,
          hasNextPage: pagination.hasNextPage || false,
          hasPrevPage: pagination.hasPrevPage || false,
        });

        setFailedApis((prev) => prev.filter((api) => api.id !== 'users'));
      } else {
        throw new Error(
          payload?.error?.message ||
            payload?.meta?.message ||
            payload?.message ||
            'Failed to fetch users'
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch users';
      console.error(errorMessage);
      setUsers([]);
      setServerPagination({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        limit,
        hasNextPage: false,
        hasPrevPage: false,
      });
      setFailedApis((prev) => {
        if (!prev.find((api) => api.id === 'users')) {
          return [
            ...prev,
            {
              id: 'users',
              name: 'Users Table',
              retryFunction: () => fetchUsers(page, limit, searchTerm, activeFilters || filters),
              errorMessage: errorMessage || 'Failed to load Users Table. Please try again.',
            },
          ];
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch user stats (widgets)
  const fetchUserStats = async () => {
    setStatsLoading(true);
    try {
      const payload = await apiClient.get('/users/stats');

      if (payload.status === 'success' || payload.success) {
        setUserStats(payload.data || payload);
      } else {
        throw new Error(
          payload?.error?.message ||
            payload?.meta?.message ||
            payload?.message ||
            'Failed to fetch user stats'
        );
      }
      console.log('User stats:', payload.data);
      setFailedApis((prev) => prev.filter((api) => api.id !== 'stats'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user stats';
      console.error(errorMessage);
      setUserStats(null);
      setFailedApis((prev) => {
        if (!prev.find((api) => api.id === 'stats')) {
          return [
            ...prev,
            {
              id: 'stats',
              name: 'User Statistics',
              retryFunction: fetchUserStats,
              errorMessage: errorMessage || 'Failed to load User Statistics. Please try again.',
            },
          ];
        }
        return prev;
      });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserStats();
  }, []);

  // Widget cards array (same style as meters/tickets)
  const userWidgets = [
    {
      title: 'Total Users',
      value: userStats?.totalUsers || '0',
      icon: 'icons/total-users.svg',
      subtitle1: userStats ? `${userStats.activeUsers} Active Users` : '- Active Users',
      subtitle2: userStats ? `${userStats.inactiveUsers} Inactive Users` : '- Inactive Users',
    },
    {
      title: 'Total Admins',
      value: userStats?.totalAdmins || '0',
      icon: 'icons/admin.svg',
      subtitle1: 'This Month',
    },
    {
      title: 'Total Accountants',
      value: userStats?.roleBreakdown?.Accountant || '0',
      icon: 'icons/accountant.svg',
      subtitle1: 'This Month',
    },
    {
      title: 'Total Moderators',
      value: userStats?.roleBreakdown?.Moderator || '0',
      icon: 'icons/moderator.svg',
      subtitle1: '1 Active Users', // Adjust if you want to show actual active moderators
    },
    {
      title: 'Total Roles',
      value: userStats?.totalRoles || '0',
      icon: 'icons/roles.svg',
      subtitle1: '1 Active Users', // Adjust if you want to show actual active roles
    },
  ];

  const handleInactiveClick = (row: any) => {
    setUserToInactive(row);
    setInactiveFormData({
      userName: row.username || '',
      reason: '',
    });
    setShowInactiveModal(true);
  };

  const handleConfirmInactive = async (data: any) => {
    try {
      console.log('Inactivating user:', userToInactive.sNo, data);
      // Here you would make the actual API call to inactive the user
      // const res = await fetch(`${BACKEND_URL}/users/${userToInactive.sNo}/inactive`, {
      //     method: 'PUT',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ reason: data.reason })
      // });

      // For demo purposes, update local state
      setUsers(
        users.map((user) =>
          user.sNo === userToInactive.sNo ? { ...user, status: 'inactive' } : user
        )
      );
    } catch (error) {
      console.error('Error inactivating user:', error);
    } finally {
      setShowInactiveModal(false);
      setUserToInactive(null);
      setInactiveFormData({
        userName: '',
        reason: '',
      });
    }
  };

  const handleCancelInactive = () => {
    setShowInactiveModal(false);
    setUserToInactive(null);
    setInactiveFormData({
      userName: '',
      reason: '',
    });
  };

  // Form fields configuration for inactive user
  const inactiveFormFields = [
    {
      type: 'input' as const,
      label: 'User Name',
      name: 'userName',
      value: inactiveFormData.userName,
      placeholder: 'User name',
      required: true,
      onChange: (value: string) => setInactiveFormData((prev) => ({ ...prev, userName: value })),
      disabled: true,
    },
    {
      type: 'dropdown' as const,
      label: 'Reason for Inactivation',
      name: 'reason',
      searchable: false,
      value: inactiveFormData.reason,
      required: true,
      options: [
        { value: 'account_violation', label: 'Account Violation' },
        { value: 'inactive_usage', label: 'Inactive Usage' },
        { value: 'security_concern', label: 'Security Concern' },
        { value: 'user_request', label: 'User Request' },
        { value: 'other', label: 'Other' },
      ],
      onChange: (value: string) => setInactiveFormData((prev) => ({ ...prev, reason: value })),
    },
  ];

  // Export function for users data
  const handleExportData = () => {
    import('xlsx').then((XLSX) => {
      const workbook = XLSX.utils.book_new();

      // 1. User Statistics Cards
      const userStatsExportData = userWidgets.map((widget) => ({
        Metric: widget.title,
        Value: widget.value || '0',
        Subtitle1: widget.subtitle1 || '',
        Subtitle2: widget.subtitle2 || '',
      }));

      // 2. Users Table Data
      const usersTableExportData = users.map((user, index) => ({
        'S.No': user.sNo || index + 1,
        'User Name': user.name || '0',
        'Email Address': user.email || '0',
        'Phone Number': user.phone || '0',
        Role: user.role || '0',
        Client: user.client || '0',
        'Created Date': user.createdDate || '0',
      }));

      // Create sheets with auto-sizing
      const userStatsSheet = XLSX.utils.json_to_sheet(userStatsExportData);
      const usersTableSheet = XLSX.utils.json_to_sheet(usersTableExportData);

      // Auto-size columns for better readability
      const setAutoWidth = (worksheet: any) => {
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        const colWidths: any[] = [];

        for (let C = range.s.c; C <= range.e.c; ++C) {
          let maxWidth = 10;
          for (let R = range.s.r; R <= range.e.r; ++R) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
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
      [userStatsSheet, usersTableSheet].forEach((sheet) => setAutoWidth(sheet));

      // Append sheets to workbook
      XLSX.utils.book_append_sheet(workbook, userStatsSheet, 'User Statistics');
      XLSX.utils.book_append_sheet(workbook, usersTableSheet, 'Users List');

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
      link.download = 'users-list.xlsx';
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
          // Page Header Section
          {
            layout: {
              type: 'column' as const,
              gap: 'gap-4',
              rows: [
                {
                  layout: 'row' as const,
                  columns: [
                    {
                      name: 'PageHeader',
                      props: {
                        title: 'Users',
                        onBackClick: () => navigate('/superadmin'),
                        backButtonText: 'Back to Dashboard',
                        buttonsLabel: 'Add User',
                        variant: 'primary',
                        onClick: () => navigate('/add-user'),
                        showMenu: true,
                        showDropdown: true,
                        menuItems: [
                          {
                            id: 'RoleManagement',
                            label: 'Role Management',
                          },
                          {
                            id: 'Export',
                            label: 'Export',
                          },
                        ],
                        onMenuItemClick: (itemId: string) => {
                          console.log(`Filter by: ${itemId}`);
                          if (itemId === 'RoleManagement') {
                            navigate('/role-management');
                          } else if (itemId === 'Export') {
                            handleExportData();
                          }
                        },
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
              type: 'column' as const,
              gap: 'gap-4',
              rows: [
                {
                  layout: 'grid' as const,
                  gridColumns: 5,
                  gap: 'gap-4',
                  columns: userWidgets.map((card) => ({
                    name: 'Card',
                    props: {
                      ...card,
                      loading: statsLoading,
                      bg: 'bg-stat-icon-gradient',
                    },
                  })),
                },
              ],
            },
          },
          {
            layout: {
              type: 'grid' as const,
              columns: 1,
              gap: 'gap-4',
              rows: [
                {
                  layout: 'grid' as const,
                  gridColumns: 2,
                  gap: 'gap-4',
                  columns: [
                    {
                      name: 'Dropdown',
                      props: {
                        name: 'userTypes',
                        options: userTypesOptions,
                        placeholder: 'Filter By User Types',
                        value: filters.userTypes,
                        onChange: handleFilterChange,
                        className: 'w-48',
                        searchable: false,
                      },
                    },
                    {
                      name: 'Dropdown',
                      props: {
                        name: 'userStatus',
                        options: userStatusOptions,
                        placeholder: 'Filter By User Status',
                        value: filters.userStatus,
                        onChange: handleFilterChange,
                        className: 'w-48',
                        searchable: false,
                      },
                    },
                  ],
                },
              ],
            },
          },
          // Users Table Section
          {
            layout: {
              type: 'column' as const,
              className: 'pb-4',
              gap: 'gap-4',
              rows: [
                {
                  layout: 'column' as const,
                  columns: [
                    {
                      name: 'Table',
                      props: {
                        data: users,
                        columns: tableColumns,
                        loading: loading,
                        searchable: true,
                        sortable: true,
                        pagination: true,
                        showHeader: true,
                        showActions: true,
                        serverPagination: serverPagination,
                        onPageChange: handlePageChange,
                        onSearch: handleSearch,
                        headerTitle: 'User Management',
                        onView: (row: any) => {
                          console.log('Users: onView triggered', row);
                          console.log('Users: Navigating to', `/user-detail/${row.sNo}`);
                          navigate(`/users/${row.sNo}`, {
                            state: {
                              user: row,
                            },
                          });
                        },
                        onEdit: (row: any) => {
                          console.log('Edit user:', row);
                          // Navigate to edit page or open edit modal
                          navigate(`/users/${row.sNo}`, {
                            state: {
                              user: row,
                            },
                          });
                        },
                        onInactive: (row: any) => {
                          handleInactiveClick(row);
                        },
                        availableTimeRanges: [],
                        // dateRange: 'Real-time data',
                        text: 'User Management Table',
                        className: 'w-full',
                        emptyMessage: 'No users found',
                      },
                    },
                  ],
                },
              ],
            },
          },
          // Inactive User Modal Section
          {
            layout: {
              type: 'column' as const,
              gap: 'gap-4',
              rows: [
                {
                  layout: 'row' as const,
                  columns: [
                    {
                      name: 'Modal',
                      props: {
                        isOpen: showInactiveModal,
                        onClose: handleCancelInactive,
                        title: 'Inactivate User',
                        size: 'md',
                        showForm: true,
                        formFields: inactiveFormFields,
                        onSave: handleConfirmInactive,
                        saveButtonLabel: 'Inactivate User',
                        cancelButtonLabel: 'Cancel',
                        cancelButtonVariant: 'secondary',
                        gridLayout: {
                          gridRows: 2,
                          gridColumns: 1,
                          gap: 'gap-4',
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
