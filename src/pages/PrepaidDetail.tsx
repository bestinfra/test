import { lazy } from 'react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import BACKEND_URL from '../config';
import type { Column, TableData } from '../types/module';

const Page = lazy(() => import('SuperAdmin/Page'));

const WIDGET_TITLE_MAP: Record<string, string> = {
  cummulativeCurrentBalance: 'Cummulative Current Balance',
  lowBalance: 'Low Balance Consumers',
  adhocCredit: 'Adhoc Credit Issued',
  adhocRecovered: 'Adhoc Credit Recovered',
};

/** Humanize key to label: s.no -> S.No, meterNumber -> Meter Number */
const keyToLabel = (key: string): string => {
  const special: Record<string, string> = {
    's.no': 'S.No',
    uscNo: 'USC No',
    meterNumber: 'Meter Number',
    consumerName: 'Consumer Name',
    amount: 'Amount',
  };
  if (special[key]) return special[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[._-]/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

/** Generate dynamic columns from data keys (AssetManagement-style) */
const DEFAULT_COLUMNS: Column[] = [
  { key: 's.no', label: 'S.No' },
  { key: 'meterNumber', label: 'Meter Number' },
  { key: 'uscNo', label: 'USC No' },
  { key: 'consumerName', label: 'Consumer Name' },
  {
    key: 'amount',
    label: 'Amount',
    align: 'right',
    render: (value) => {
      const num = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(num)
        ? new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
          }).format(num)
        : String(value ?? '');
    },
  },
];

const generateColumnsFromData = (data: TableData[]): Column[] => {
  if (!data || data.length === 0) return DEFAULT_COLUMNS;
  const firstRow = data[0];
  const keys = Object.keys(firstRow).filter((k) => firstRow[k] !== undefined);
  return keys.map((key) => {
    const col: Column = {
      key,
      label: keyToLabel(key),
    };
    if (key.toLowerCase().includes('amount') || key === 'amount') {
      col.align = 'right';
      col.render = (value) => {
        const num = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(num)
          ? new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 2,
            }).format(num)
          : String(value ?? '');
      };
    }
    return col;
  });
};

const PrepaidDetail: React.FC = () => {
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
  const { widgetType: widgetTypeParam } = useParams<{ widgetType: string }>();
  const widgetType = widgetTypeParam || 'cummulativeCurrentBalance';

  useEffect(() => {
    fetchWidgetDetails();
  }, [widgetType, searchParams]);

  const fetchWidgetDetails = async () => {
    try {
      setLoading(true);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');

      const params = new URLSearchParams({
        widgetType,
        page: String(page),
        limit: String(limit),
      });

      const response = await fetch(
        `${BACKEND_URL}/prepaid/widget-details?${params.toString()}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch widget details');
      }

      const result = await response.json();
      const isSuccess =
        result?.status === 'success' || result?.success === true;
      const data = result?.data;

      if (isSuccess && data) {
        const rows = Array.isArray(data.data) ? data.data : data;
        const pagination = data.pagination || result.pagination || {};

        setTableData(rows);
        setServerPagination({
          currentPage: pagination.currentPage ?? page,
          totalPages: pagination.totalPages ?? 1,
          totalCount: pagination.totalCount ?? rows.length,
          limit: pagination.limit ?? limit,
          hasNextPage: pagination.hasNextPage ?? false,
          hasPrevPage: pagination.hasPrevPage ?? false,
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
      console.error('Error fetching widget details:', error);
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

  const pageTitle =
    WIDGET_TITLE_MAP[widgetType] || 'Prepaid Widget Details';

  const tableColumns = useMemo(
    () => generateColumnsFromData(tableData),
    [tableData]
  );

  const handleView = (row: TableData) => {
    const consumerNumber =
      row.consumerNumber ?? row['Consumer Number'] ?? row.uscNo ?? row.consumerId;
    if (consumerNumber) {
      navigate(`/consumers/${consumerNumber}`);
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
                      title: pageTitle,
                      onBackClick: () => navigate('/bills/prepaid'),
                      backButtonText: 'Back to Prepaid',
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
                      loading,
                      searchable: true,
                      sortable: true,
                      pagination: true,
                      searchbarDownload: true,
                      showActions: true,
                      serverPagination: serverPagination,
                      onPageChange: handlePageChange,
                      onView: handleView,
                      onRowClick: handleView,
                      actions: [
                        {
                          label: 'View',
                          icon: 'icons/eye.svg',
                          onClick: handleView,
                        },
                      ],
                      headerTitle: pageTitle,
                      text: `${pageTitle} Table`,
                      className: 'w-full',
                      emptyMessage: loading
                        ? 'Loading data...'
                        : 'No data available',
                      rowsPerPageOptions: [5, 10, 15, 25],
                      initialRowsPerPage: 10,
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

export default PrepaidDetail;
