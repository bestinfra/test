import { lazy } from 'react';
import React, {useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BACKEND_URL from '../config';
import { getAuthHeaders } from '../api/apiUtils';
import type { Column, TableData } from '../types/module';
const Page = lazy(() => import('SuperAdmin/Page'));
const IndividualDetailPage: React.FC = () => {
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [serverPagination, setServerPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const navigate = useNavigate();

  useEffect(() => {
    fetchOverallData();
  }, [searchParams]);

  const fetchOverallData = async () => {
    try {
      setLoading(true);

      const data = searchParams.get('data');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');

      let apiUrl = `${BACKEND_URL}/dashboard/widget-data?data=${data}&startDate=${startDate}&endDate=${endDate}&page=${page}&limit=${limit}`;

      const response = await fetch(apiUrl, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch widget data');
      }

      const result = await response.json();

      if (( result.success === true) && Array.isArray(result.data)) {
        setTableData(result.data);

        const pagination = result.meta?.pagination || result.pagination || {};
        setServerPagination({
          currentPage: pagination.currentPage || page,
          totalPages: pagination.totalPages || 1,
          totalCount: pagination.totalCount || result.data.length,
          limit: pagination.limit || limit,
          hasNextPage: pagination.hasNextPage || false,
          hasPrevPage: pagination.hasPrevPage || false,
        });
      } else {
        setTableData([]);
        setServerPagination({
          currentPage: 1,
          totalPages: 1,
          totalCount: 0,
          limit: 10,
          hasNextPage: false,
          hasPrevPage: false,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setTableData([]);
      setServerPagination({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        limit: 10,
        hasNextPage: false,
        hasPrevPage: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number, limit?: number) => {
    const newLimit = limit || serverPagination.limit;
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('page', page.toString());
    newSearchParams.set('limit', newLimit.toString());
    setSearchParams(newSearchParams);
  };

  const dataType = searchParams.get('data');
  const getTableColumns = (): Column[] => {
    const baseColumns: Column[] = [
      { key: 'S.No', label: 'S.No' },
      { key: 'Consumer Name', label: 'Consumer Name' },
      { key: 'Meter SI No', label: 'Meter SI No' },
      { key: 'USC No', label: 'USC No' },
      { key: 'CIRCLE', label: 'Circle' },
      { key: 'DIVISION', label: 'Division' },
      { key: 'SUB-DIVISION', label: 'SubDivision' },
      { key: 'SECTION', label: 'Section' },
      { key: 'cmd', label: 'CMD' },
      {
        key: "Secondary Consumption(kWh)",
        label: "Consumption(kWh)",
        align: "right",
    },

      
      // { key: 'Consumer Number', label: 'Consumer Number' },
      // { key: 'UID', label: 'UID' },
      // { key: 'Consumer Name', label: 'Consumer Name' },
      // { key: 'Meter SI No', label: 'Meter SI No' },
    ];

    if (dataType === 'high-usage') {
      return [...baseColumns, { key: 'Consumption(kVAh)', label: 'Consumption(kVAh)' }];
    }

    if (dataType === 'all-consumers') {
      return [...baseColumns, { key: 'Consumption(kVAh)', label: 'Consumption(kVAh)' }];
    }

    return baseColumns;
  };

  const tableColumns = getTableColumns();

  const getPageTitle = () => {
    switch (dataType) {
      case 'all-consumers':
        return 'All Consumers Details';
      case 'high-usage':
        return 'High Usage Consumers Details';
      case 'electricity-usage-daily':
        return 'Daily Electricity Usage Details';
      case 'electricity-usage-monthly':
        return 'Monthly Electricity Usage Details';
      case 'chart-daily-consumption':
        return 'Daily Consumption Details';
      case 'chart-monthly-consumption':
        return 'Monthly Consumption Details';
      case 'communicating':
        return 'Communicating Meters Details';
      case 'non-communicating':
        return 'Non-Communicating Meters Details';
      default:
        return 'Individual Details';
    }
  };

  return (
    <Page
      sections={[
        {
          layout: {
            type: 'column',
            gap: 'gap-6',
            className: '',
            rows: [
              {
                layout: 'row',
                columns: [
                  {
                    name: 'PageHeader',
                    props: {
                      title: getPageTitle(),
                      onBackClick: () => navigate('/dashboard'),
                      backButtonText: 'Back to Dashboard',
                      showMenu: false,
                      showDropdown: false,
                    },
                  },
                ],
              },
              {
                layout: 'row',
                columns: [
                  {
                    name: 'Table',
                    props: {
                      data: tableData,
                      columns: tableColumns,
                      loading: loading,
                      searchable: true,
                      sortable: true,
                      pagination: true,
                      showActions: true,
                      serverPagination: serverPagination,
                      onPageChange: handlePageChange,
                      onView: (row: TableData) => {
                        navigate(`/consumers/${row['Consumer Number'] || row.consumerNumber}`);
                      },
                      onRowClick: (row: TableData) =>
                        navigate(
                          `/consumers/${row['Consumer Number'] || row.consumerNumber || ''}`
                        ),
                      headerTitle: `${getPageTitle()} ${
                        dataType === 'high-usage' ? '(High Usage)' : ''
                      }`,
                      dateRange: `Date Range: ${searchParams.get(
                        'startDate'
                      )} to ${searchParams.get('endDate')}`,
                      text: `${getPageTitle()} Table`,
                      className: 'w-full',
                      emptyMessage: loading ? 'Loading data...' : 'No data available',
                    },
                  },
                ],
              },
            ],
          },
        },
      ]}
    />
  );
};

export default IndividualDetailPage;
