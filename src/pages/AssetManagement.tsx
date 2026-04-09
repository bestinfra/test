import { lazy } from 'react';
import { Suspense, useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import BACKEND_URL from '../config';
const Page = lazy(() => import('SuperAdmin/Page'));

interface HierarchyNode {
  hierarchy_id: string | number;
  hierarchy_name: string;
  hierarchy_type_title: string;
  children?: HierarchyNode[];
  meters?: Array<{
    meterNumber?: string;
    meterNo?: string;
    lastCommunication?: string;
  }>;
}

interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  searchable?: boolean;
  statusIndicator?: {};
  isActive?: (value: any, row: any) => boolean;
}

// Utility functions for processing hierarchical data into table format
/**
 * Extracts all unique hierarchy levels from hierarchical data
 * Returns them in the order they appear in the hierarchy
 */
const extractHierarchyLevels = (data: HierarchyNode[]): string[] => {
  const levels = new Set<string>();
  const levelOrder: string[] = [];

  const traverse = (nodes: HierarchyNode[]) => {
    nodes.forEach((node) => {
      if (node.hierarchy_type_title) {
        const level = node.hierarchy_type_title;
        if (!levels.has(level)) {
          levels.add(level);
          levelOrder.push(level);
        }
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    });
  };

  traverse(data);
  return levelOrder;
};

/**
 * Flattens hierarchical data into table rows dynamically
 * Creates a row for each meter found in the hierarchy
 */
const flattenHierarchyForTable = (
  nodes: HierarchyNode[],
  hierarchyLevels: string[]
): any[] => {
  const flattened: any[] = [];

  const flattenNode = (
    node: HierarchyNode,
    hierarchyPath: Record<string, string> = {}
  ) => {
    const currentType = node.hierarchy_type_title || '';
    const currentName = node.hierarchy_name || '';

    // Dynamically add current level to path
    const updatedPath = {
      ...hierarchyPath,
      [currentType]: currentName,
    };

    // Check if this is a leaf node (no children) or has meters
    const isLeafNode = !node.children || node.children.length === 0;
    const hasMeters = node.meters && Array.isArray(node.meters) && node.meters.length > 0;

    // If this node has meters, create a row for each meter
    if (hasMeters && node.meters) {
      node.meters.forEach((meter: any) => {
        const row: any = {
          slNo: flattened.length + 1, // Will be recalculated later
        };

        // Add all hierarchy levels to the row
        hierarchyLevels.forEach((level) => {
          row[level] = updatedPath[level] || '-';
        });

        // Add meter-specific data
        row.MeterNo = meter.meterNumber || meter.meterNo || '-';
        row.lastCommunication = meter.lastCommunication || 'No Data';
        row.hierarchy_id = node.hierarchy_id;
        row.hierarchy_name = node.hierarchy_name;
        row.hierarchy_type_title = node.hierarchy_type_title;

        flattened.push(row);
      });
    } 
    // If this is a leaf node without meters, still create a row to show the hierarchy
    else if (isLeafNode) {
      const row: any = {
        slNo: flattened.length + 1, // Will be recalculated later
      };

      // Add all hierarchy levels to the row
      hierarchyLevels.forEach((level) => {
        row[level] = updatedPath[level] || '-';
      });

      // Add node data
      row.MeterNo = '-'; // No meter for this node
      row.lastCommunication = 'No Data';
      row.hierarchy_id = node.hierarchy_id;
      row.hierarchy_name = node.hierarchy_name;
      row.hierarchy_type_title = node.hierarchy_type_title;

      flattened.push(row);
    }

    // Recursively process children (even if this node has meters, children might have more meters)
    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      node.children.forEach((child) => flattenNode(child, updatedPath));
    }
  };

  nodes.forEach((node) => flattenNode(node));

  // Update serial numbers after all data is collected
  const finalFlattened = flattened.map((item, index) => ({
    ...item,
    slNo: index + 1,
  }));

  return finalFlattened;
};

/**
 * Generates dynamic columns from hierarchy levels
 */
const generateDynamicColumns = (
  hierarchyLevels: string[],
  options?: {
    includeMeterNo?: boolean;
    includeLastCommunication?: boolean;
    meterNoConfig?: {
      statusIndicator?: {};
      isActive?: (value: any, row: any) => boolean;
    };
  }
): TableColumn[] => {
  const columns: TableColumn[] = [
    {
      key: 'slNo',
      label: 'S.No',
      sortable: true,
    },
  ];

  // Add hierarchy level columns
  hierarchyLevels.forEach((level) => {
    columns.push({
      key: level,
      label: level,
      sortable: true,
      searchable: true,
    });
  });

  // Add MeterNo column if enabled
  if (options?.includeMeterNo !== false) {
    columns.push({
      key: 'MeterNo',
      label: 'Meter No',
      sortable: true,
      searchable: true,
      statusIndicator: options?.meterNoConfig?.statusIndicator || {},
      isActive: options?.meterNoConfig?.isActive || ((_value: any, row: any) => {
        const status = String(row?.lastCommunication || '').toLowerCase();
        return status !== 'no data' && status !== '-';
      }),
    });
  }

  // Add lastCommunication column if enabled
  if (options?.includeLastCommunication) {
    columns.push({
      key: 'lastCommunication',
      label: 'Last Communication',
      sortable: true,
      searchable: true,
    });
  }

  return columns;
};

/**
 * Main function to process hierarchical data and return columns + table data
 */
const processHierarchyDataForTable = (
  hierarchyData: HierarchyNode[],
  options?: {
    includeMeterNo?: boolean;
    includeLastCommunication?: boolean;
    meterNoConfig?: {
      statusIndicator?: {};
      isActive?: (value: any, row: any) => boolean;
    };
  }
): { columns: TableColumn[]; tableData: any[] } => {
  if (!hierarchyData || hierarchyData.length === 0) {
    return { columns: [], tableData: [] };
  }

  // Extract hierarchy levels
  const levels = extractHierarchyLevels(hierarchyData);

  // Generate dynamic columns
  const columns = generateDynamicColumns(levels, options);

  // Flatten hierarchical data
  const tableData = flattenHierarchyForTable(hierarchyData, levels);

  return { columns, tableData };
};

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const ListIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 10h16M4 14h16M4 18h16"
    />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

export default function AssetManagment() {
  const navigate = useNavigate();
  const [searchParams, _setSearchParams] = useSearchParams();
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [hierarchicalData, setHierarchicalData] = useState<HierarchyNode[]>([]);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'hierarchy' | 'table'>('table');
  const [assetsTableData, setAssetsTableData] = useState<any[]>([]);
  const [isLoadingAssetsData, setIsLoadingAssetsData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [_currentPageSize, setCurrentPageSize] = useState(10);
  const [serverPagination, setServerPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [_isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [dynamicColumns, setDynamicColumns] = useState<any[]>([]);

  // Process hierarchical data to generate dynamic columns and table data
  const { columns: processedColumns } = useMemo(() => {
    if (!hierarchicalData || hierarchicalData.length === 0) {
      return { columns: [], tableData: [] };
    }
    
    return processHierarchyDataForTable(hierarchicalData, {
      includeMeterNo: true,
      includeLastCommunication: false,
      meterNoConfig: {
        statusIndicator: {},
        isActive: (_value: any, row: any) => {
          const status = String(row?.lastCommunication || '').toLowerCase();
          return status !== 'no data' && status !== '-';
        },
      },
    });
  }, [hierarchicalData]);

  // Update dynamic columns when processed columns change
  useEffect(() => {
    if (processedColumns.length > 0) {
      setDynamicColumns(processedColumns);
    }
  }, [processedColumns]);

  const [lastSelectedId, _setLastSelectedId] = useState<string | null>(null);

  const assetManagementActions = [
    { id: 'edit-asset-title', label: 'Edit Asset Title' },
    { id: 'delete', label: 'Delete', isDestructive: true },
    { id: 'view', label: 'View' },
  ];

  const handleAssetAction = (actionId: string, node: any) => {
    switch (actionId) {
      case 'edit-asset-title':
        break;
      case 'change-node-to-sub-node':
        break;
      case 'download-template':
        break;
      case 'duplicate-entire-asset':
        break;
      case 'remove-sub-node-list':
        break;
      case 'delete':
        break;
      case 'view':
        const meterId = node.meterNo || node.dtrId || node.meterNumber;
        if (meterId) {
          navigate(`/meter-details/${meterId}`);
        }
        break;
      default:
        break;
    }
  };
  const handleMenuClick = (menuId: string) => {
    switch (menuId) {
      case 'Table View':
        setViewMode('table');
        break;
      case 'HierarchyView':
        setViewMode('hierarchy');
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/assets`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();

        if (data.status === 'success' || data.success === true) {
          setHierarchicalData(data.data || []);
          // Process data using dynamic utility functions
          const { tableData: flattenedData, columns: generatedColumns } = processHierarchyDataForTable(data.data || [], {
            includeMeterNo: true,
            includeLastCommunication: false,
            meterNoConfig: {
              statusIndicator: {},
              isActive: (_value: any, row: any) => {
                const status = String(row?.lastCommunication || '').toLowerCase();
                return status !== 'no data' && status !== '-';
              },
            },
          });
          setAssetsTableData(flattenedData);
          setDynamicColumns(generatedColumns);
          setServerPagination((prev) => ({
            ...prev,
            totalCount: flattenedData.length,
            totalPages: Math.ceil(flattenedData.length / prev.limit),
          }));
        }
      } catch (error) {
        setErrorMessages((prev) => {
          if (!prev.includes('Failed to fetch assets')) {
            return [...prev, 'Failed to fetch assets'];
          }
          return prev;
        });
      }
    };

    setTimeout(() => {
      fetchAssets();
    }, 1000);
  }, []);

  const handleExportToExcel = async () => {
    try {
      setIsExporting(true);

      const allSourceRows: any[] = [];
      const limitPerPage = 100;
      let page = 1;
      let hasMoreData = true;
      const search = searchParams.get('search') || '';

      while (hasMoreData) {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limitPerPage.toString(),
        });

        if (search && search.trim()) {
          queryParams.append('search', search.trim());
        }

        if (lastSelectedId) {
          queryParams.append('hierarchyId', lastSelectedId);
        }

        const response = await fetch(`${BACKEND_URL}/meters?${queryParams}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (data.status === 'success' || data.success === true) {
          const rawData = Array.isArray(data.data) ? data.data : [];
          const pageRows = rawData.map((item: any) => ({
            slNo: item.sNo || item.slNo || 0,
            meterNo: item.meterNo || item.meterNumber || 'NA',
            communicationStatus: item.communicationStatus || 'No Data',
            lastCommunicationDate: item.lastCommunicationDate || 'No Data',
          }));

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
              'Failed to fetch assets for export'
          );
        }
      }

      if (allSourceRows.length > 0) {
        const excelData = allSourceRows.map((asset: any, index: number) => ({
          'S.No': index + 1,
          'Meter No': asset.meterNo,
          'Communication Status': asset.communicationStatus,
          'Last Communication Date': asset.lastCommunicationDate,
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        worksheet['!cols'] = [
          { wch: 8 },
          { wch: 15 },
          { wch: 20 },
          { wch: 25 },
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets List');

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
        link.download = 'assets_list.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('No assets found to export');
      }
    } catch (error) {
      setErrorMessages((prev) => {
        if (!prev.includes('Failed to export assets')) {
          return [...prev, 'Failed to export assets'];
        }
        return prev;
      });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    // const search = searchParams.get('search') || '';

    setServerPagination((prev) => ({ ...prev, currentPage: page, limit }));
    setCurrentPageSize(limit);

    if (viewMode === 'table') {
      // Fetch assets data for table view instead of meter data
      fetchAssetsTableData();
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'table' && serverPagination.currentPage > 0) {
      // Fetch assets data when view mode changes
      fetchAssetsTableData();
    }
  }, [viewMode]);

  useEffect(() => {
    const fetchDropdownData = async () => {
      setDropdownLoading(true);
      try {
        const response = await fetch(`${BACKEND_URL}/dtrs/filter/filter-options`);

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Invalid response format');
        }

        const data = await response.json();

        if (data.status === 'success' || data.success === true) {
          const transformedData = {
            discoms: data.data
              .filter((item: any) => item.levelName === 'DISCOM')
              .map((item: any) => ({
                id: item.id,
                name: item.name,
                code: item.code || item.name,
                region: item.region || item.name,
              })),
            circles: data.data
              .filter((item: any) => item.levelName === 'CIRCLE')
              .map((item: any) => ({
                id: item.id,
                name: item.name,
                code: item.code || item.name,
                discom_id: item.parentId || 1,
              })),
            divisions: data.data
              .filter((item: any) => item.levelName === 'DIVISION')
              .map((item: any) => ({
                id: item.id,
                name: item.name,
                code: item.code || item.name,
                circle_id: item.parentId || 1,
              })),
            subDivisions: data.data
              .filter((item: any) => item.levelName === 'SUB-DIVISION')
              .map((item: any) => ({
                id: item.id,
                name: item.name,
                code: item.code || item.name,
                division_id: item.parentId || 1,
              })),
            sections: data.data
              .filter((item: any) => item.levelName === 'SECTION')
              .map((item: any) => ({
                id: item.id,
                name: item.name,
                code: item.code || item.name,
                sub_division_id: item.parentId || 1,
              })),
            meterLocations: data.data
              .filter((item: any) => item.levelName === 'METER-LOCATION')
              .map((item: any) => ({
                id: item.id,
                name: item.name,
                code: item.code || item.name,
                description: item.description || item.name,
              })),
          };

          setFilterOptions({
            discoms: [
              { value: 'all', label: 'All DISCOMs' },
              ...transformedData.discoms.map((item: any) => ({
                value: item.id.toString(),
                label: item.name,
              })),
            ],
            circles: [
              { value: 'all', label: 'All Circles' },
              ...transformedData.circles.map((item: any) => ({
                value: item.id.toString(),
                label: item.name,
              })),
            ],
            divisions: [
              { value: 'all', label: 'All Divisions' },
              ...transformedData.divisions.map((item: any) => ({
                value: item.id.toString(),
                label: item.name,
              })),
            ],
            subDivisions: [
              { value: 'all', label: 'All Sub-Divisions' },
              ...transformedData.subDivisions.map((item: any) => ({
                value: item.id.toString(),
                label: item.name,
              })),
            ],
            sections: [
              { value: 'all', label: 'All Sections' },
              ...transformedData.sections.map((item: any) => ({
                value: item.id.toString(),
                label: item.name,
              })),
            ],
            meterLocations: [
              { value: 'all', label: 'All Locations' },
              ...transformedData.meterLocations.map((item: any) => ({
                value: item.id.toString(),
                label: item.name,
              })),
            ],
          });
        } else {
          throw new Error(data.message || 'Failed to fetch filter options');
        }
      } catch (error) {
      } finally {
        setDropdownLoading(false);
      }
    };

    fetchDropdownData();
  }, []);

  const [isSubNodeChecked, setIsSubNodeChecked] = useState(false);

  const [_dropdownLoading, setDropdownLoading] = useState(false);

  const [_filterOptions, setFilterOptions] = useState<{
    discoms: Array<{ value: string; label: string }>;
    circles: Array<{ value: string; label: string }>;
    divisions: Array<{ value: string; label: string }>;
    subDivisions: Array<{ value: string; label: string }>;
    sections: Array<{ value: string; label: string }>;
    meterLocations: Array<{ value: string; label: string }>;
  }>({
    discoms: [],
    circles: [],
    divisions: [],
    subDivisions: [],
    sections: [],
    meterLocations: [],
  });

  const handleTabChange = (newTabIndex: number) => {
    setActiveTab(newTabIndex);
    setIsSubNodeChecked(false);
  };

  const handleCheckboxChange = (checked: boolean) => {
    setIsSubNodeChecked(checked);
  };

  const clearErrors = () => {
    setErrorMessages([]);
  };

  const removeError = (indexToRemove: number) => {
    setErrorMessages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const retryAllAPIs = () => {
    clearErrors();
    window.location.reload();
  };

  const tabs = [
    {
      label: 'Add Asset Name',
      content: null,
      icon: <PlusIcon />,
    },
    {
      label: 'Upload List',
      content: null,
      icon: <ListIcon />,
    },
    {
      label: 'Template',
      content: null,
      icon: <DownloadIcon />,
    },
  ];

  const generateFormFieldsForTab = (tabIndex: number) => {
    switch (tabIndex) {
      case 0:
        const baseFields = [
          {
            name: 'assetTitle',
            type: 'text',
            label: 'Asset Title',
            placeholder: 'Asset Title (Ex. Locations)',
            required: true,
            validation: {
              required: 'Asset title is required',
            },
            rightIcon: 'icons/search.svg',
          },
          {
            name: 'assetName',
            type: 'text',
            label: 'Asset Name',
            placeholder: 'Search and select asset name',
            required: true,
            validation: {
              required: 'Asset name is required',
            },
          },
          {
            name: 'isSubNode',
            type: 'checkbox',
            label: 'Choose an asset below to assign this as a Sub Node.',
            labelClassName: 'text-sm text-TextSecondary dark:text-gray-400',
            checkboxLabelClassName: 'text-TextSecondary font-normal',
            onChange: handleCheckboxChange,
            value: isSubNodeChecked,
          },
        ];

        if (isSubNodeChecked) {
          baseFields.push({
            name: 'parentAssetSearch',
            type: 'text',
            label: '',
            placeholder: 'Search for parent Node',
            required: true,
            validation: {
              required: 'Parent asset is required when creating a sub node',
            },
            rightIcon: 'icons/search.svg',
          });
        }

        return baseFields;

      case 1:
        return [
          {
            name: 'uploadFile',
            type: 'chosenfile',
            label: 'Upload File',
            rightIcon: 'icons/search.svg',
            placeholder: 'Drag and drop files here or click to browse',
            required: true,
            validation: {
              required: 'File is required',
            },
            accept: '.csv,.xlsx,.xls',
            multiple: true,
            dragAndDrop: true,
          },
        ];

      case 2:
        return [
          {
            name: 'templateSearch',
            type: 'text',
            label: 'Search Templates',
            placeholder: 'Asset Title (Ex. Locations)',
            required: false,
            rightIcon: 'icons/search.svg',
          },
        ];

      default:
        return [];
    }
  };

  const currentFormFields = generateFormFieldsForTab(activeTab);

  const getSaveButtonLabel = () => {
    switch (activeTab) {
      case 0:
        return 'Create Asset';
      case 1:
        return 'Create List';
      case 2:
        return 'Download';
      default:
        return 'Save';
    }
  };

  const mapHierarchyRecursively = (nodes: HierarchyNode[]): any[] => {
    if (!nodes || nodes.length === 0) {
      return [
        {
          id: 'no-data',
          name: '-',
          hierarchy_type_title: 'No Assets Available',
          children: [],
        },
      ];
    }
    const mapped = nodes.map((node) => ({
      id: node.hierarchy_id,
      name: node.hierarchy_name,
      hierarchy_type_title: node.hierarchy_type_title,
      children: node.children ? mapHierarchyRecursively(node.children) : [],
    }));
    return mapped;
  };

  const mapHierarchyForNodeChart = (nodes: any[]): any[] => {
    if (!nodes || nodes.length === 0) {
      return [
        {
          name: '-',
          backgroundColor: '#f5f5f5',
          borderColor: '',
          textColor: '#999999',
          Areas: [],
        },
      ];
    }
    const mappedForChart = nodes.map((node) => ({
      name: node.name || node.hierarchy_name,
      backgroundColor: '#e3f2fd',
      borderColor: '',
      textColor: '#424242',
      Areas: node.children ? mapHierarchyForNodeChart(node.children) : [],
    }));
    return mappedForChart;
  };

  const getDisplayData = () => {
    const displayData = mapHierarchyRecursively(hierarchicalData);
    return displayData;
  };

  const getFlattenedTableData = () => {
    const flattened: any[] = [];

    const flattenNode = (node: any, level: number = 0, parentPath: string = '') => {
      const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;

      flattened.push({
        id: node.id || node.hierarchy_id,
        name: node.name || node.hierarchy_name,
        type: node.hierarchy_type_title,
        level: level,
        path: currentPath,
        count: node.count || 0,
        parent: parentPath || 'Root',
      });

      if (node.children && node.children.length > 0) {
        node.children.forEach((child: any) => flattenNode(child, level + 1, currentPath));
      }
    };

    const displayData = getDisplayData();
    displayData.forEach((node) => flattenNode(node));

    return flattened;
  };

  const fetchAssetsTableData = async () => {
    setIsLoadingAssetsData(true);
    try {
      const response = await fetch(`${BACKEND_URL}/assets`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();

      if (data.status === 'success' || data.success === true) {
        // Process data using dynamic utility functions
        const { tableData: flattenedData, columns: generatedColumns } = processHierarchyDataForTable(data.data || [], {
          includeMeterNo: true,
          includeLastCommunication: false,
          meterNoConfig: {
            statusIndicator: {},
            isActive: (_value: any, row: any) => {
              const status = String(row?.lastCommunication || '').toLowerCase();
              return status !== 'no data' && status !== '-';
            },
          },
        });
        setAssetsTableData(flattenedData);
        setDynamicColumns(generatedColumns);
        setServerPagination((prev) => ({
          ...prev,
          totalCount: flattenedData.length,
          totalPages: Math.ceil(flattenedData.length / prev.limit),
        }));
      } else {
        setErrorMessages((prev) => {
          if (!prev.includes('Failed to fetch assets data')) {
            return [...prev, 'Failed to fetch assets data'];
          }
          return prev;
        });
      }
    } catch (error) {
      setErrorMessages((prev) => {
        if (!prev.includes('Failed to fetch assets data')) {
          return [...prev, 'Failed to fetch assets data'];
        }
        return prev;
      });
    } finally {
      setIsLoadingAssetsData(false);
    }
  };

  const nonEmptyErrors = errorMessages.filter((msg) => msg && msg.trim().length > 0);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Page
        sections={[
          ...(nonEmptyErrors.length > 0
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
                              visibleErrors: nonEmptyErrors,
                              showRetry: true,
                              maxVisibleErrors: 3,
                              onRetry: retryAllAPIs,
                              onClose: removeError,
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
                  layout: 'row',
                  columns: [
                    {
                      name: 'PageHeader',
                      props: {
                        title: 'Asset Management',
                        onBackClick: () => window.history.back(),
                        backButtonText: 'Back to Dashboard',
                        showMenu: true,
                        buttonsLabel: 'Add Asset',
                        onClick: () => setIsBulkUploadModalOpen(true),
                        buttons: [
                          {
                            label: 'Add Asset',
                            variant: 'secondary',
                            onClick: () => setIsAddAssetModalOpen(true),
                          },
                          {
                            label: isExporting ? 'Exporting...' : 'Export',
                            variant: 'primary',
                            onClick: handleExportToExcel,
                            loading: isExporting,
                          },
                        ],
                        menuItems: [
                          {
                            id: 'Table View',
                            label: 'Table View',
                          },
                          {
                            id: 'HierarchyView',
                            label: 'Hierarchy View',
                          },
                        ],
                        onMenuItemClick: handleMenuClick,
                      },
                    },
                  ],
                },
              ],
            },
          },
          ...(viewMode === 'hierarchy'
            ? [
                {
                  layout: {
                    type: 'grid',
                    columns: 4,
                    className: 'h-full',
                    rows: [
                      {
                        layout: 'row',
                        className:
                          'border border-primary-border dark:border-dark-border rounded-3xl overflow-hidden',
                        columns: [
                          {
                            name: 'TopLevelHierarchy',
                            props: {
                              nodes: getDisplayData(),
                              title: 'Asset Hierarchy',
                              actions: assetManagementActions,
                              onActionClick: handleAssetAction,
                              showActions: true,
                            },
                          },
                        ],
                      },

                      {
                        layout: 'row',
                        span: { col: 3, row: 1 },
                        className:
                          'h-full border border-primary-border dark:border-dark-border rounded-3xl overflow-hidden',
                        columns: [
                          {
                            name: 'NodeChart',
                            props: {
                              data: (() => {
                                const displayData = getDisplayData();
                                const chartData = mapHierarchyForNodeChart(displayData);
                                return {
                                  Location: chartData,
                                };
                              })(),
                              width: '100%',
                              height: '100%',
                              type: 'hierarchy',
                              enableZoom: true,
                              minZoom: 0.3,
                              maxZoom: 2,
                              initialZoom: 0.8,
                              layout: 'horizontal',
                              EdgeStyleLayout: 'polyline',
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
              ]
            : [
                {
                  layout: {
                    type: 'flex' as const,
                    direction: 'row' as const,
                    gap: 'gap-4',
                    columns: 1,
                    className: 'w-full flex flex-col gap-4',
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
                              data: viewMode === 'table' ? assetsTableData : getFlattenedTableData(),
                              showHeader: false,
                              availableTimeRanges: [],
                              columns:
                                viewMode === 'table'
                                  ? (dynamicColumns.length > 0 
                                      ? dynamicColumns 
                                      : processedColumns.length > 0 
                                        ? processedColumns 
                                        : [
                                            {
                                              key: 'slNo',
                                              label: 'S.No',
                                              sortable: true,
                                            },
                                          ])
                                  : [
                                      {
                                        key: 'feedersCount',
                                        label: 'Feeders Count',
                                        sortable: true,
                                      },
                                      {
                                        key: 'commStatus',
                                        label: 'Communication-Status',
                                        statusIndicator: {},
                                        isActive: (
                                          value: string | number | boolean | null | undefined
                                        ) => String(value).toLowerCase() === 'active',
                                      },
                                      {
                                        key: 'lastCommunication',
                                        label: 'Last Communication',
                                        sortable: true,
                                      },
                                    ],
                              loading: viewMode === 'table' ? isLoadingAssetsData : false,
                              emptyMessage:
                                viewMode === 'table' ? 'No assets found' : 'No assets found',
                              searchable: true,
                              sortable: true,
                              pagination: true,
                              showFilterButton: true,
                              showPagination: true,
                              pageSize: viewMode === 'table' ? serverPagination.limit : 10,
                               rowsPerPageOptions: [10, 25, 50, 100],
                              initialRowsPerPage:
                                viewMode === 'table' ? serverPagination.limit : 10,
                              itemsPerPage: viewMode === 'table' ? serverPagination.limit : 10,
                              serverPagination: undefined, // Client-side pagination for assets
                              onPageChange: undefined,
                              onPageSizeChange: undefined,
                              onSearch: undefined,
                              showActions: false,
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
              ]),
          {
            layout: {
              type: 'column',
              gap: 'gap-0',
              rows: [
                {
                  layout: 'row',
                  columns: [
                    {
                      name: 'Modal',
                      props: {
                        isOpen: isAddAssetModalOpen,
                        onClose: () => {
                          setIsAddAssetModalOpen(false);
                          setActiveTab(0);
                          setIsSubNodeChecked(false);
                        },
                        title: 'Add New Asset',
                        size: '2xl',
                        showCloseIcon: true,
                        showTabs: true,
                        tabs: tabs,
                        activeTabIndex: activeTab,
                        onTabChange: handleTabChange,
                        showForm: true,
                        formFields: currentFormFields,
                        onSave: async (formData: Record<string, any>) => {
                          try {
                            let apiData;

                            switch (activeTab) {
                              case 0:
                                apiData = {
                                  location_type_name: formData.assetTitle,
                                  location_names: formData.assetName ? [formData.assetName] : [],
                                  parent_location:
                                    formData.isSubNode && formData.parentAssetSearch
                                      ? formData.parentAssetSearch
                                      : null,
                                };
                                break;

                              case 1:
                                setIsAddAssetModalOpen(false);
                                return;

                              case 2:
                                setIsAddAssetModalOpen(false);
                                return;

                              default:
                                apiData = formData;
                            }

                            const response = await fetch(`${BACKEND_URL}/assets`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify(apiData),
                            });

                            const result = await response.json();

                            if (result.status === 'success') {
                              window.location.reload();
                            } else {
                              alert(`Failed to add asset: ${result.message}`);
                            }
                          } catch (error) {
                            alert('Error adding asset. Please try again.');
                          }

                          setIsAddAssetModalOpen(false);
                        },
                        saveButtonLabel: getSaveButtonLabel(),
                        cancelButtonLabel: 'Cancel',
                        cancelButtonVariant: 'secondary',
                        confirmButtonVariant: 'primary',
                        formId: 'add-asset-form',
                        gridLayout: {
                          gridRows: currentFormFields.length,
                          gridColumns: 1,
                          gap: 'gap-4',
                        },
                        tabsSize: 'md',
                        tabsShowTabIcons: true,
                        tabsShowTabLabels: true,
                        tabsTabListClassName: 'bg-primary-lightest border-primary-border',
                        tabsActiveTabButtonClassName: 'bg-primary text-white',
                        tabsInactiveTabButtonClassName: 'text-neutral hover:bg-primary-lightest',
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
