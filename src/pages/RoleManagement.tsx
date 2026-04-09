import { lazy } from 'react';
import { Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/apiUtils';
const Page = lazy(() => import('SuperAdmin/Page'));

interface Role {
  id: number;
  name: string;
  users: Array<{
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  }>;
  permissions: Array<{ id: number; name: string; description: string }>;
  createdAt: string;
  updatedAt?: string;
}

export default function RoleManagement() {
  const navigate = useNavigate();

  // State for tracking failed APIs (like Users.tsx)
  const [failedApis, setFailedApis] = useState<
    Array<{
      id: string;
      name: string;
      retryFunction: () => Promise<void>;
      errorMessage: string;
    }>
  >([]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [serverPagination, setServerPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<any>(null);
  const [roleToEdit, setRoleToEdit] = useState<any>(null);
  const [formData, setFormData] = useState({
    roleName: '',
    description: '',
  });

  // Retry specific API function (like Users.tsx)
  const retrySpecificAPI = (apiId: string) => {
    const api = failedApis.find((a) => a.id === apiId);
    if (api) {
      api.retryFunction();
    }
  };

  const fetchRoles = async (page = 1, limit = 10, searchTerm = '') => {
    try {
      setLoading(true);
      setFailedApis((prev) => prev.filter((api) => api.id !== 'roles'));

      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));

      if (searchTerm && searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const payload = await apiClient.get(`/roles?${params.toString()}`);

      if (payload.status === 'success' || payload.success) {
        const data = payload.data || payload;
        const pagination = payload.meta?.pagination || payload.pagination || {};

        setRoles(Array.isArray(data) ? data : data?.roles || []);
        setServerPagination({
          currentPage: pagination.currentPage || 1,
          totalPages: pagination.totalPages || 1,
          totalCount: pagination.totalCount || 0,
          limit: pagination.limit || limit,
          hasNextPage: pagination.hasNextPage || false,
          hasPrevPage: pagination.hasPrevPage || false,
        });
      } else {
        throw new Error(
          payload?.error?.message ||
            payload?.meta?.message ||
            payload?.message ||
            'Failed to fetch roles'
        );
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch roles';
      console.error('Error fetching roles:', errorMessage);

      setFailedApis((prev) => {
        if (!prev.find((api) => api.id === 'roles')) {
          return [
            ...prev,
            {
              id: 'roles',
              name: 'Roles Data',
              retryFunction: () => fetchRoles(page, limit, searchTerm),
              errorMessage,
            },
          ];
        }
        return prev;
      });

      if (roles.length === 0) {
        setRoles([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchRoles();
  }, []);

  // Handle table pagination
  const handlePageChange = (page: number, limit: number) => {
    fetchRoles(page, limit);
  };

  // Handle table search
  const handleSearch = (searchTerm: string) => {
    // Reset to first page when searching
    fetchRoles(1, serverPagination.limit, searchTerm);
  };

  const handleDeleteClick = (row: any) => {
    setRoleToDelete(row);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;

    setDeleting(true);
    try {
      const result = await apiClient.delete(`/roles/${roleToDelete.id}`);

      if (result.status === 'success' || result.success) {
        setRoles(roles.filter((role) => role.id !== roleToDelete.id));

        // Add success message to failed APIs (temporary display)
        setFailedApis((prev) => [
          ...prev,
          {
            id: 'success',
            name: 'Success',
            retryFunction: async () => {},
            errorMessage: 'Role deleted successfully!',
          },
        ]);

        // Remove success message after 3 seconds
        setTimeout(() => {
          setFailedApis((prev) => prev.filter((api) => api.id !== 'success'));
        }, 3000);
      } else {
        throw new Error(result.message || 'Failed to delete role');
      }
    } catch (error: any) {
      console.error('Error deleting role:', error);

      // Add to failed APIs
      setFailedApis((prev) => [
        ...prev,
        {
          id: 'deleteError',
          name: 'Delete Error',
          retryFunction: async () => {},
          errorMessage: `Failed to delete role: ${error.message || 'Unknown error'}`,
        },
      ]);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
      setRoleToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setRoleToDelete(null);
  };

  const handleAddClick = () => {
    setFormData({
      roleName: '',
      description: '',
    });
    setShowAddModal(true);
  };

  const handleEditClick = (row: any) => {
    setRoleToEdit(row);
    setFormData({
      roleName: row.roleName || row.name || '-',
      description: row.description || '-',
    });
    setShowEditModal(true);
  };

  const handleSaveRole = async (data: Record<string, any>) => {
    setSaving(true);
    try {
      if (showEditModal && roleToEdit) {
        const result = await apiClient.put(`/roles/${roleToEdit.id}`, {
          name: data.roleName || '-',
          description: data.description || '-',
        });

        if (result.status === 'success' || result.success) {
          await fetchRoles();

          // Add success message to failed APIs (temporary display)
          setFailedApis((prev) => [
            ...prev,
            {
              id: 'success',
              name: 'Success',
              retryFunction: async () => {},
              errorMessage: 'Role updated successfully!',
            },
          ]);

          // Remove success message after 3 seconds
          setTimeout(() => {
            setFailedApis((prev) => prev.filter((api) => api.id !== 'success'));
          }, 3000);
        }
      } else {
        const result = await apiClient.post('/roles', {
          name: data.roleName || '-',
          description: data.description || '-',
        });

        if (result.status === 'success' || result.success) {
          await fetchRoles();

          // Add success message to failed APIs (temporary display)
          setFailedApis((prev) => [
            ...prev,
            {
              id: 'success',
              name: 'Success',
              retryFunction: async () => {},
              errorMessage: 'Role created successfully!',
            },
          ]);

          // Remove success message after 3 seconds
          setTimeout(() => {
            setFailedApis((prev) => prev.filter((api) => api.id !== 'success'));
          }, 3000);
        }
      }
    } catch (error: any) {
      console.error('Error saving role:', error);

      // Add to failed APIs
      setFailedApis((prev) => [
        ...prev,
        {
          id: 'saveError',
          name: 'Save Error',
          retryFunction: async () => {},
          errorMessage: `Failed to save role: ${error.message || 'Unknown error'}`,
        },
      ]);
    } finally {
      setSaving(false);
      setShowAddModal(false);
      setShowEditModal(false);
      setRoleToEdit(null);
      setFormData({ roleName: '', description: '' });
    }
  };

  const handleCancelModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setRoleToEdit(null);
    setFormData({
      roleName: '',
      description: '',
    });
  };

  const handleManagePermissions = (row: any) => {
    navigate('/role-permission', { state: { role: row } });
  };

  // Form fields configuration for add role
  const addRoleFormFields = [
    {
      type: 'input' as const,
      label: 'Role Name',
      name: 'roleName',
      value: formData.roleName,
      placeholder: 'Enter role name',
      required: true,
      validation: {
        required: 'Role name is required',
      },
    },
    {
      type: 'textarea' as const,
      label: 'Description',
      name: 'description',
      value: formData.description,
      placeholder: 'Enter role description',
      required: false,
      span: { col: 1, row: 1 }, // This makes the description field take full width
    },
  ];

  // Form fields configuration for edit role
  const editRoleFormFields = [
    {
      type: 'input' as const,
      label: 'Current Role',
      name: 'currentRole',
      value: roleToEdit?.roleName || roleToEdit?.name || '-',
      placeholder: 'Current role name',
      required: true,
      onChange: (value: string) => setFormData((prev) => ({ ...prev, roleName: value })),
      disabled: true,
    },
    {
      type: 'dropdown' as const,
      label: 'Select New Role',
      name: 'roleName',
      value: formData.roleName,
      required: true,
      options: [
        { value: 'Admin', label: 'Admin' },
        { value: 'Moderator', label: 'Moderator' },
        { value: 'Accountant', label: 'Accountant' },
        { value: 'User', label: 'User' },
      ],
      onChange: (value: string) => setFormData((prev) => ({ ...prev, roleName: value })),
    },
  ];

  // Table data for the Table component - Updated to match the image layout with smart fallbacks
  const tableData = roles.map((role) => ({
    id: role.id || '-',
    fullName:
      role.users && role.users.length > 0
        ? `${role.users[0].firstName || '-'} ${role.users[0].lastName || '-'}`.trim() || '-'
        : '-',
    roleName: role.name || '-',
    // client: 'Railways', // Default client as shown in the image
    users: role.users ? role.users.length : 0,
    permissions:
      role.permissions && role.permissions.length > 0
        ? role.permissions.map((p) => p.name || '-').join(', ')
        : '-',
    createdAt: role.createdAt || '-',
    updatedAt: role.updatedAt || '-',
  }));

  // Table columns configuration - Updated to match the image
  const tableColumns = [
    { key: 'fullName', label: 'Full Name', spacing: 'pl-5 py-1' },
    { key: 'roleName', label: 'Role Name' },
    //{ key: 'client', label: 'Client' },
  ];

  // Actions array for the table - With icons
  const tableActions = [
    {
      label: 'Manage Permissions',
      onClick: handleManagePermissions,
      icon: 'icons/settings.svg',
    },
    {
      label: 'Edit',
      onClick: handleEditClick,
      icon: 'icons/user-pen.svg',
    },
    {
      label: 'Delete',
      onClick: handleDeleteClick,
      icon: 'icons/delete.svg',
    },
  ];

  // Export function for roles data
  const handleExportData = () => {
    import('xlsx').then((XLSX) => {
      const workbook = XLSX.utils.book_new();

      // 1. Roles Table Data
      const rolesTableExportData = tableData.map((role, index) => ({
        'S.No': index + 1,
        'Full Name': role.fullName || '-',
        'Role Name': role.roleName || '-',
        // Client: role.client || '-',
        'Users Count': role.users || 0,
        Permissions: role.permissions || '-',
        'Created Date': role.createdAt || '-',
        'Updated Date': role.updatedAt || '-',
      }));

      // 2. Role Summary Data
      const roleSummaryData = roles.map((role) => ({
        'Role ID': role.id || '-',
        'Role Name': role.name || '-',
        'Total Users': role.users ? role.users.length : 0,
        'Total Permissions': role.permissions ? role.permissions.length : 0,
        'Created Date': role.createdAt || '-',
        'Last Updated': role.updatedAt || '-',
      }));

      // Create sheets with auto-sizing
      const rolesTableSheet = XLSX.utils.json_to_sheet(rolesTableExportData);
      const roleSummarySheet = XLSX.utils.json_to_sheet(roleSummaryData);

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
      [rolesTableSheet, roleSummarySheet].forEach((sheet) => setAutoWidth(sheet));

      // Append sheets to workbook
      XLSX.utils.book_append_sheet(workbook, rolesTableSheet, 'Roles List');
      XLSX.utils.book_append_sheet(workbook, roleSummarySheet, 'Role Summary');

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
      link.download = 'roles-management.xlsx';
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
                  },
                  components: [
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
              ]
            : []),
          // Page Header Section
          {
            layout: {
              type: 'column',
              gap: 'gap-4',
            },
            components: [
              {
                name: 'PageHeader',
                props: {
                  title: 'Role Management',
                  onBackClick: () => navigate('/users'),
                  backButtonText: 'Back to UserManagment',
                  buttonsLabel: 'Add Role',
                  variant: 'primary',
                  onClick: handleAddClick,
                  showMenu: true,
                  showDropdown: true,
                  menuItems: [
                    {
                      id: 'all',
                      label: 'All Roles',
                    },
                    {
                      id: 'admin',
                      label: 'Administrative Roles',
                    },
                    {
                      id: 'user',
                      label: 'User Roles',
                    },
                    {
                      id: 'support',
                      label: 'Support Roles',
                    },
                    {
                      id: 'financial',
                      label: 'Financial Roles',
                    },
                    {
                      id: 'system',
                      label: 'System Roles',
                    },
                    {
                      id: 'export',
                      label: 'Export',
                    },
                  ],
                  onMenuItemClick: (itemId: string) => {
                    console.log(`Filter by: ${itemId}`);
                    if (itemId === 'export') {
                      handleExportData();
                    }
                  },
                },
              },
            ],
          },
          // Table Section
          {
            layout: {
              type: 'column' as const,
              gap: 'gap-4',
              rows: [
                {
                  layout: 'row' as const,
                  columns: [
                    {
                      name: 'Table',
                      props: {
                        data: tableData,
                        columns: tableColumns,
                        loading: loading,
                        emptyMessage: 'No roles found',
                        searchable: true,
                        pagination: true,
                        showActions: true,
                        actions: tableActions,
                        onPageChange: handlePageChange,
                        onSearch: handleSearch,
                        serverPagination: serverPagination,
                        onEdit: (row: any) => {
                          navigate(`/edit-role/${row.id}`, { state: { role: row } });
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
          // Delete Confirmation Modal Section
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
                        isOpen: showDeleteModal,
                        onClose: handleCancelDelete,
                        title: 'Delete Role',
                        size: 'md',
                        showConfirmButton: true,
                        confirmButtonLabel: deleting ? 'Deleting...' : 'Delete Role',
                        confirmButtonVariant: 'danger',
                        onConfirm: handleConfirmDelete,
                        disabled: deleting,
                        message: `Are you sure you want to delete the role "${
                          roleToDelete?.roleName || roleToDelete?.name || '-'
                        }"?`,
                        warningMessage:
                          'This action cannot be undone. All users assigned to this role will lose their permissions.',
                      },
                    },
                  ],
                },
              ],
            },
          },
          // Add Role Modal Section
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
                        isOpen: showAddModal,
                        onClose: handleCancelModal,
                        title: 'Add New Role',
                        size: 'lg',
                        showCloseIcon: true,
                        showForm: true,
                        formFields: addRoleFormFields,
                        onSave: (formData: Record<string, any>) => {
                          handleSaveRole(formData);
                        },
                        saveButtonLabel: saving ? 'Creating...' : 'Create Role',
                        cancelButtonLabel: 'Cancel',
                        cancelButtonVariant: 'secondary',
                        confirmButtonVariant: 'primary',
                        disabled: saving,
                        formId: 'add-role-form',
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
          // Edit Role Modal Section
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
                        isOpen: showEditModal,
                        onClose: handleCancelModal,
                        title: 'Edit Role',
                        size: 'lg',
                        showForm: true,
                        formFields: editRoleFormFields,
                        onSave: (formData: Record<string, any>) => {
                          handleSaveRole(formData);
                        },
                        saveButtonLabel: saving ? 'Updating...' : 'Update Role',
                        cancelButtonLabel: 'Cancel',
                        disabled: saving,
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
