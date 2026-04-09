import { lazy } from 'react';
import { FILTER_STYLES, type IconFilterStyle } from '../contexts/FilterStyleContext';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
const Page = lazy(() => import('SuperAdmin/Page'));

import BACKEND_URL from '../config';
import meterConnectionAPI, { MeterConnectionAPI } from '../api/meterConnection';

type WidgetKey =
  | 'rPhaseVoltage'
  | 'yPhaseVoltage'
  | 'bPhaseVoltage'
  | 'rPhaseCurrent'
  | 'yPhaseCurrent'
  | 'bPhaseCurrent'
  | 'rPhasePf'
  | 'yPhasePf'
  | 'bPhasePf'
  | 'apparentPower'
  | 'mdKva'
  | 'neutralCurrent'
  | 'frequency'
  | 'pf'
  | 'avgPf'
  | 'activePower'
  | 'ipData';
type PhaseType = 1 | 3;

const getDaySuffix = (day: number) => {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
};

const formatDateWithSuffix = (date: Date) => {
  const day = date.getDate();
  const suffix = getDaySuffix(day);
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  return `${day}${suffix} ${month} ${year}`;
};

const getYesterdayFormatted = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatDateWithSuffix(date);
};

const getLastMonthFormatted = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return formatDateWithSuffix(date);
};

/** Static columns for Prepaid Transaction History - remove/add columns as needed */
const PREPAID_TRANSACTION_COLUMNS = [
  { key: 'S.No', label: 'S.No' },
  { key: 'transactionId', label: 'Transaction ID' },
  // { key: 'transactionType', label: 'Type' },
  { key: 'consumptionKWh', label: 'Consumption (kWh)' },
  { key: 'balanceBefore', label: 'Balance Before' },
  { key: 'balanceAfter', label: 'Balance After' },
  
  { key: 'description', label: 'Description' },
  { key: 'createdAt', label: 'Created At' },
  // { key: 'readingDate', label: 'Reading Date' },
  { key: 'amount', label: 'Amount' },
  {
    key: 'status',
    label: 'Status',
    render: (value: string) => (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'COMPLETED'
            ? 'bg-positive text-white'
            : value === 'FAILED'
              ? 'bg-danger-light text-danger'
              : value === 'Pending'
                ? 'bg-warning-light text-warning'
                : 'bg-gray-200 text-gray-700'
        }`}
      >
        {value}
      </span>
    ),
  },
];

/** Columns for Prepaid Consumption History */
const PREPAID_CONSUMPTION_COLUMNS = [
  { key: 'S.No', label: 'S.No' },
  { key: 'readingDate', label: 'Reading Date' },
  { key: 'previousReading', label: 'Previous Reading' },
  { key: 'currentReading', label: 'Current Reading' },
  { key: 'unitsConsumed', label: 'Consumption (kWh)' },
  { key: 'totalAmount', label: 'Amount' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'createdAt', label: 'Created At' },
];

const WIDGET_CONFIG: Record<
  WidgetKey,
  {
    title: string;
    subtitle1: string;
    icon: string;
    bg: string;
    iconClassName: string;
    width: string;
    height: string;
    iconStyle?: IconFilterStyle;
  }
> = {
  rPhaseVoltage: {
    title: 'R-Phase Voltage',
    subtitle1: 'Volts',
    icon: 'icons/r-phase-voltage.svg',
    bg: 'bg-danger',
    iconClassName: 'w-4 h-4',
    width: 'w-8',
    height: 'h-8',
  },
  yPhaseVoltage: {
    title: 'Y-Phase Voltage',
    subtitle1: 'Volts',
    icon: 'icons/r-phase-voltage.svg',
    bg: 'bg-warning-alt',
    iconClassName: 'w-5 h-5',
    width: 'w-8',
    height: 'h-8',
  },
  bPhaseVoltage: {
    title: 'B-Phase Voltage',
    subtitle1: 'Volts',
    icon: 'icons/r-phase-voltage.svg',
    bg: 'bg-primary',
    iconClassName: 'w-4 h-4',
    width: 'w-8',
    height: 'h-8',
  },
  rPhaseCurrent: {
    title: 'R-Phase Current',
    subtitle1: 'Amps',
    icon: 'icons/r-phase-current.svg',
    bg: 'bg-danger',
    iconClassName: 'w-4 h-4',
    width: 'w-8',
    height: 'h-8',
  },
  yPhaseCurrent: {
    title: 'Y-Phase Current',
    subtitle1: 'Amps',
    icon: 'icons/r-phase-current.svg',
    bg: 'bg-warning-alt',
    iconClassName: 'w-5 h-5',
    width: 'w-8',
    height: 'h-8',
  },
  bPhaseCurrent: {
    title: 'B-Phase Current',
    subtitle1: 'Amps',
    icon: 'icons/r-phase-current.svg',
    bg: 'bg-primary',
    iconClassName: 'w-5 h-5',
    width: 'w-8',
    height: 'h-8',
  },
  rPhasePf: {
    title: 'R-Phase PF',
    subtitle1: 'Power Factor',
    icon: 'icons/power-factor.svg',
    bg: 'bg-danger',
    iconClassName: 'w-5 h-5',
    width: 'w-8',
    height: 'h-8',
  },
  yPhasePf: {
    title: 'Y-Phase PF',
    subtitle1: 'Power Factor',
    icon: 'icons/power-factor.svg',
      bg: 'bg-warning-alt',
    iconClassName: 'w-5 h-5',
    width: 'w-8',
    height: 'h-8',
  },
  bPhasePf: {
    title: 'B-Phase PF',
    subtitle1: 'Power Factor',
    icon: 'icons/power-factor.svg',
    bg: 'bg-primary',
    iconClassName: 'w-5 h-5',
    width: 'w-8',
    height: 'h-8',
  },
  apparentPower: {
    title: 'Apparent Power',
    subtitle1: 'kVA',
    icon: 'icons/consumption.svg',
    bg: 'bg-stat-icon-gradient',  
    iconStyle: FILTER_STYLES.BRAND_GREEN,
    iconClassName: 'w-5 h-5',
    width: 'w-8',
    height: 'h-8',
  },
  mdKva: {
    title: 'MD-kVA',
    subtitle1: 'kVA',
    icon: 'icons/consumption.svg',
    bg: 'bg-stat-icon-gradient',
    iconStyle: FILTER_STYLES.BRAND_GREEN,
    iconClassName: 'w-4 h-4',
    width: 'w-8',
    height: 'h-8',
  },
  neutralCurrent: {
    title: 'Neutral Current',
    subtitle1: 'Amps',
    icon: 'icons/consumption.svg',
    iconStyle: FILTER_STYLES.BRAND_GREEN,
    bg: 'bg-stat-icon-gradient',
    iconClassName: 'w-4 h-4',
    width: 'w-8',
    height: 'h-8',
  },
  frequency: {
    title: 'Frequency',
    subtitle1: 'Hz',
    icon: 'icons/time-twenty-four.svg',
    iconStyle: FILTER_STYLES.BRAND_GREEN,
    bg: 'bg-stat-icon-gradient',
    iconClassName: 'w-4 h-4',
    width: 'w-8',
    height: 'h-8',
  },
  pf: {
    title: 'PF',
    subtitle1: 'Power Factor',
    icon: 'icons/eventAlertIcon.svg',
    bg: 'bg-stat-icon-gradient',
    iconClassName: 'w-4 h-4',
    width: 'w-8',
    height: 'h-8',
  },
  avgPf: {
    title: 'Avg PF',
    iconStyle: FILTER_STYLES.BRAND_GREEN,
    subtitle1: 'Power Factor',
    icon: 'icons/power-factor.svg',
    bg: 'bg-stat-icon-gradient',
    iconClassName: 'w-5 h-5',
    width: 'w-8',
    height: 'h-8',
  },
  activePower: {
    title: 'Active Power',
    subtitle1: 'kW',
    icon: 'icons/consumption.svg',
    bg: 'bg-stat-icon-gradient',
    iconStyle: FILTER_STYLES.BRAND_GREEN,
    iconClassName: 'w-5 h-5',
    width: 'w-8',
    height: 'h-8',
  },
  ipData: {
    title: 'Export kWh',
    subtitle1: '',
    icon: 'icons/signal.svg',
    bg: 'bg-stat-icon-gradient',
    iconStyle: FILTER_STYLES.BRAND_GREEN,
    iconClassName: 'w-5 h-5',
    width: 'w-8',
    height: 'h-8',
  },
};

const PHASE_WIDGET_MAP: Record<PhaseType, WidgetKey[]> = {
  // Single phase: R-phase voltage, Apparent Power, Frequency | R-phase Current, Active Power, R-phase PF
  1: [
    // Row 1: R-phase voltage, Apparent Power, Frequency
    'rPhaseVoltage',
    'apparentPower',
    'frequency',
    // Row 2: R-phase Current, Active Power, R-phase PF
    'rPhaseCurrent',
    'activePower',
    'rPhasePf',
    // Ip Data
    'ipData',
  ],
  3: [
    // Row 1: Voltages + Apparent Power + MD-kVA
    'rPhaseVoltage',
    'yPhaseVoltage',
    'bPhaseVoltage',
    'apparentPower',
    'mdKva',
    // Row 2: Currents + Neutral + Frequency
    'rPhaseCurrent',
    'yPhaseCurrent',
    'bPhaseCurrent',
    'neutralCurrent',
    'frequency',
    // Row 3: PFs + Active Power + Ip Data
    'rPhasePf',
    'yPhasePf',
    'bPhasePf',
    'avgPf',
    'activePower',
    'ipData',
  ],
};

const generateWidgets = (consumer: any) => {
  let meterPhase = consumer?.meterPhase as PhaseType;

  if (!meterPhase) {
    const hasYPhaseVoltage =
      consumer?.yPhaseVoltage !== undefined &&
      consumer?.yPhaseVoltage !== null &&
      consumer?.yPhaseVoltage !== '' &&
      Number(consumer?.yPhaseVoltage) !== 0;
    const hasBPhaseVoltage =
      consumer?.bPhaseVoltage !== undefined &&
      consumer?.bPhaseVoltage !== null &&
      consumer?.bPhaseVoltage !== '' &&
      Number(consumer?.bPhaseVoltage) !== 0;
    const hasYPhaseCurrent =
      consumer?.yPhaseCurrent !== undefined &&
      consumer?.yPhaseCurrent !== null &&
      consumer?.yPhaseCurrent !== '' &&
      Number(consumer?.yPhaseCurrent) !== 0;
    const hasBPhaseCurrent =
      consumer?.bPhaseCurrent !== undefined &&
      consumer?.bPhaseCurrent !== null &&
      consumer?.bPhaseCurrent !== '' &&
      Number(consumer?.bPhaseCurrent) !== 0;

    if ((hasYPhaseVoltage && hasBPhaseVoltage) || (hasYPhaseCurrent && hasBPhaseCurrent)) {
      meterPhase = 3;
    } else {
      meterPhase = 1;
    }
  }

  const widgetKeys = PHASE_WIDGET_MAP[meterPhase] || PHASE_WIDGET_MAP[1];

  return widgetKeys.map((key: WidgetKey) => {
    const config = WIDGET_CONFIG[key];
    let rawValue: any;

    switch (key) {
      case 'apparentPower':
        rawValue = consumer?.kVA;
        break;
      case 'activePower':
        rawValue = consumer?.kW;
        break;
      case 'ipData':
        rawValue = consumer?.kWh_E;
        break;
      case 'rPhasePf':
      case 'yPhasePf':
      case 'bPhasePf':
        rawValue = consumer?.pf;
        break;
      default:
        rawValue = consumer?.[key];
        break;
    }

    // For instantaneous widgets, default missing/null values to 0 (no skeletons/blanks)
    // ipData (Export Kw) uses kWh_E - numeric value
    let value: any;
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      value = 0;
    } else if (typeof rawValue === 'number') {
      value = rawValue;
    } else if (!isNaN(Number(rawValue))) {
      value = Number(rawValue);
    } else {
      value = rawValue;
    }

    return {
      key,
      title: config.title,
      value,
      subtitle1: config.subtitle1,
      icon: config.icon,
      bg: config.bg,
      valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
      iconStyle: config.iconStyle ?? FILTER_STYLES.WHITE,
      iconClassName: config.iconClassName,
      width: config.width,
      height: config.height,
    };
  });
};

/** Bottom row: MD-kVA, Frequency, Active Power, Export Kw - 4 columns only */
const BOTTOM_ROW_WIDGET_KEYS: WidgetKey[] = ['mdKva', 'frequency', 'activePower', 'ipData'];

const maskKeepFirstN = (raw: unknown, keep = 2) => {
  const str = String(raw ?? '').trim();
  if (!str) return '';
  if (str.length <= keep) return str;
  return `${str.slice(0, keep)}${'*'.repeat(str.length - keep)}`;
};

const maskPhone = (raw: unknown) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return maskKeepFirstN(digits, 2);
};

const maskEmail = (raw: unknown) => {
  const email = String(raw ?? '').trim();
  if (!email) return '';
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return maskKeepFirstN(email, 2);
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  return `${maskKeepFirstN(local, 2)}${domain}`;
};

const ConsumerDetailView: React.FC = () => {
  const { consumerId, consumerNumber } = useParams<{
    consumerId?: string;
    consumerNumber?: string;
  }>();
  const navigate = useNavigate();
  const [searchParams, _setSearchParams] = useSearchParams();

  const currentId = consumerNumber || consumerId;
  const isFetchingRef = useRef(false);

  const [consumer, setConsumer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [meterConnectionStatus, setMeterConnectionStatus] = useState<
    'connected' | 'disconnected' | null
  >(null);

  const [failedApis, setFailedApis] = useState<
    Array<{
      id: string;
      name: string;
      retryFunction: () => Promise<void>;
      errorMessage: string;
    }>
  >([]);

  const [selectedTimeRange, setSelectedTimeRange] = useState<'Daily' | 'Monthly'>('Daily');

  const formatDailyEnergyData = (chartData: any) => {
    if (!chartData || !chartData.daily) {
      return {
        xAxisData: [],
        seriesData: [
          {
            name: 'Energy Consumption',
            data: [],
            clickableData: [],
          },
        ],
        seriesColors: ['#163b7c', 'rgb(223, 244, 227)'],
        dateRange: 'No data available',
      };
    }

    const daily = chartData.daily;

    const clickableData = (daily.originalDates || daily.xAxisData).map(
      (date: string, index: number) => ({
        date: date,
        value: daily.seriesData[0].data[index] || 0,
        seriesName: 'Energy Consumption',
        timeRange: 'Daily',
      })
    );

    return {
      xAxisData: daily.xAxisData || [],
      seriesData: [
        {
          name: 'Energy Consumption',
          data: daily.seriesData[0].data || [],
          clickableData: clickableData,
        },
      ],
      seriesColors: ['#163b7c', 'rgb(223, 244, 227)'],
      dateRange: daily.dateRange || 'No data available',
    };
  };

  const formatMonthlyEnergyData = (chartData: any) => {
    if (!chartData || !chartData.monthly) {
      return {
        xAxisData: [],
        seriesData: [
          {
            name: 'Energy Consumption',
            data: [],
            clickableData: [],
          },
        ],
        seriesColors: ['#163b7c', 'rgb(223, 244, 227)'],
        dateRange: 'No data available',
      };
    }

    const monthly = chartData.monthly;

    const formattedXAxisData = monthly.xAxisData;
    const clickableData = monthly.xAxisData.map((monthKey: string, index: number) => ({
      date: monthKey,
      value: monthly.seriesData[0].data[index] || 0,
      seriesName: 'Energy Consumption',
      timeRange: 'Daily',
    }));

    return {
      xAxisData: formattedXAxisData,
      seriesData: [
        {
          name: 'Energy Consumption',
          data: monthly.seriesData[0].data || [],
          clickableData: clickableData,
        },
      ],
      seriesColors: ['#163b7c', 'rgb(223, 244, 227)'],
      dateRange: monthly.dateRange || 'No data available',
    };
  };

  // Initial placeholder: single-phase layout with zeros (avoids 3-phase flash)
  // Start with no instantaneous cards; render them only after consumer data is loaded
  const [consumerStats, setConsumerStats] = useState<any[]>([]);
  const [_currentPhase, setCurrentPhase] = useState<PhaseType>(1);
  const [consumerInfoRow1, setConsumerInfoRow1] = useState<any[]>([]);
  const [consumerInfoRow2, setConsumerInfoRow2] = useState<any[]>([]);
  const [consumerInfoRow3, setConsumerInfoRow3] = useState<any[]>([]);
  const [billDetailsRow, setBillDetailsRow] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [consumptionSummaryCards, setConsumptionSummaryCards] = useState<any[]>([
    {
      title: 'Monthly Consumption (kVAh)',
      value: '',
      subtitle1: 'Last Month: ',
      icon: 'icons/electric.svg',
      bg: 'bg-stat-icon-gradient',
      valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
      iconStyle: 'BRAND_GREEN',
    },
    {
      title: 'Daily Consumption (kVAh)',
      value: '',
      subtitle1: 'Yesterday: ',
      icon: 'icons/coins.svg',
      bg: 'bg-stat-icon-gradient',
      valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
      iconStyle: 'BRAND_GREEN',
    },
    {
      title: 'Total Outstanding (Rs.)',
      value: '',
      subtitle1: 'Last Month: ',
      icon: 'icons/search.svg',
      bg: 'bg-stat-icon-gradient',
      valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
      iconStyle: 'BRAND_GREEN',
    },
    {
      title: 'Bill Status',
      value: '',
      subtitle1: 'Due Date: ',
      icon: 'icons/bills2.svg',
      bg: 'bg-stat-icon-gradient',
      valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
      iconStyle: 'BRAND_GREEN',
    },
  ]);
  const [currentChartData, setCurrentChartData] = useState<any>({});
  const [firstChartData, setFirstChartData] = useState<any>({});
  const [_billingPieData, setBillingPieData] = useState<any[]>([]);
  const [_meterReadingsData, setMeterReadingsData] = useState<any[]>([]);
  const [_paymentHistoryData, setPaymentHistoryData] = useState<any[]>([]);
  const [alertsData, setAlertsData] = useState<any[]>([]);
  const [alertsPagination, setAlertsPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [_billingHistoryData, setBillingHistoryData] = useState<any[]>([]);
  const [_billingHistoryPagination, setBillingHistoryPagination] = useState<any>(null);

  const [billingHistoryToggle, setBillingHistoryToggle] = useState<'Current Bill' | 'History'>(
    'Current Bill'
  );

  const [selectedBarData, setSelectedBarData] = useState<any>(null);
  const [modalLineChartData, setModalLineChartData] = useState<any>({
    data: [],
    xAxisData: [],
    rawData: [],
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedPointData, setSelectedPointData] = useState<any>(null);
  const [selectedDataType, setSelectedDataType] = useState<string>('kvaImport');
  const retrySpecificAPI = (apiId: string) => {
    const api = failedApis.find((a) => a.id === apiId);
    if (api) {
      api.retryFunction();
    }
  };
  useEffect(() => {
    if (consumer && failedApis.length === 0) {
      // Determine phase strictly from API + Y/B presence so layout is stable
      let meterPhase = consumer?.meterPhase as PhaseType;
      if (!meterPhase) {
        const hasYPhaseVoltage =
          consumer?.yPhaseVoltage !== undefined &&
          consumer?.yPhaseVoltage !== null &&
          consumer?.yPhaseVoltage !== '' &&
          Number(consumer?.yPhaseVoltage) !== 0;
        const hasBPhaseVoltage =
          consumer?.bPhaseVoltage !== undefined &&
          consumer?.bPhaseVoltage !== null &&
          consumer?.bPhaseVoltage !== '' &&
          Number(consumer?.bPhaseVoltage) !== 0;
        const hasYPhaseCurrent =
          consumer?.yPhaseCurrent !== undefined &&
          consumer?.yPhaseCurrent !== null &&
          consumer?.yPhaseCurrent !== '' &&
          Number(consumer?.yPhaseCurrent) !== 0;
        const hasBPhaseCurrent =
          consumer?.bPhaseCurrent !== undefined &&
          consumer?.bPhaseCurrent !== null &&
          consumer?.bPhaseCurrent !== '' &&
          Number(consumer?.bPhaseCurrent) !== 0;

        if ((hasYPhaseVoltage && hasBPhaseVoltage) || (hasYPhaseCurrent && hasBPhaseCurrent)) {
          meterPhase = 3;
        } else {
          meterPhase = 1;
        }
      }

      setCurrentPhase(meterPhase || 1);
      setConsumerStats(generateWidgets({ ...consumer, meterPhase }));
      setConsumerInfoRow1([
        {
          title: 'Consumer No',
          value: consumer.consumerNumber,
        },
        {
          title: 'Unique ID',
          value: consumer.uniqueIdentificationNo,
        },
        {
          title: 'Meter SL No',
          value:
            consumer.meterSerialNumber && meterConnectionStatus
              ? `${consumer.meterSerialNumber} - [${
                  meterConnectionStatus === 'disconnected' ? 'Disconnected' : 'Connected'
                }]`
              : consumer.meterSerialNumber,
          statusIndicator: true,
          valueClassName: 'font-semibold text-text-primary rounded-md',
        },
        {
          title: 'Meter Make',
          value: consumer.meterMake,
        },
      ]);

      setConsumerInfoRow2([
        {
          title: 'USC No',
          value: consumer.use,
        },
        {
          title: 'CMD',
          value: consumer.cmd ? `${consumer.cmd} kVA` : '',
        },
        {
          title: 'Installed On',
          value: consumer.installedOn
            ? (() => {
                const str = String(consumer.installedOn);
                return str.replace(/:\d{2}(?=\s+[AP]M)/i, '');
              })()
            : '',
        },
        {
          title: 'Occupancy Status',
          value: consumer.occupancyStatus,
          onClick: handleOccupancyStatusClick,
          clickable: true,
          className: 'hover:text-primary ',
          valueIcon: 'icons/arrow-left.svg',
          valueIconPosition: 'right',
          valueIconClassName: 'h-5 w-5 bg-danger rotate-180 rounded-full',
          valueClassName: 'font-semibold text-text-secondary bg-white custom-shadow rounded-md',
        },
      ]);
      setConsumerInfoRow3([
        {
          title: 'Permanent Address',
          value: consumer.permanentAddress,
        },
        {
          title: 'Billing Address',
          value: consumer.billingAddress,
        },
        {
          title: 'Mobile No',
          value: consumer.mobileNo ? `+91 ${maskPhone(consumer.mobileNo)}` : '',
        },
        {
          title: 'Email ID',
          value: maskEmail(consumer.emailId),
        },
      ]);

      setBillDetailsRow([
        {
          title: 'Billing Month',
          value: consumer.billingMonth,
        },
        { title: 'Bill Period', value: consumer.billPeriod },
        { title: 'Due Date', value: consumer.dueDate },
      ]);

      setConsumptionSummaryCards([
        {
          title: 'Monthly Consumption (kVAh)',
          value: consumer.monthlyConsumption || '0',
          subtitle1: `${getLastMonthFormatted()}`,
          subtitle2: `${consumer.lastMonthConsumption || '0'}`,
          icon: 'icons/electric.svg',
          bg: 'bg-stat-icon-gradient',
          valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
          iconStyle: 'BRAND_GREEN',
        },
        {
          title: 'Daily Consumption (kVAh)',
          value: consumer.dailyConsumption || '0',
          subtitle1: `${getYesterdayFormatted()}`,
          subtitle2: `${consumer.yesterdayConsumption || '0'}`,
          icon: 'icons/coins.svg',
          bg: 'bg-stat-icon-gradient',
          valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
          iconStyle: 'BRAND_GREEN',
        },
        {
          title: 'Total Outstanding (Rs.)',
          value: consumer.totalOutstanding || '0',
          subtitle1: `Last Month: ${consumer.lastMonthOutstanding || '0'}`,
          icon: 'icons/search.svg',
          bg: 'bg-stat-icon-gradient',
          valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
          iconStyle: 'BRAND_GREEN',
        },
        {
          title: 'Bill Status',
          value: consumer.billStatus === 'Pending' ? 'To Be Generated' : (consumer.billStatus || '0'),
          subtitle1: `Due Date: ${consumer.dueDate || '0'}`,
          icon: 'icons/bills2.svg',
          bg: 'bg-stat-icon-gradient',
          valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
          iconStyle: 'BRAND_GREEN',
        },
      ]);

      setBillingPieData(consumer?.billingDistribution || []);
      setMeterReadingsData(consumer?.meterReadings || []);
      setPaymentHistoryData(consumer?.paymentHistory || []);
      setAlertsData(consumer?.alerts || []);
      setAlertsPagination(
        consumer?.alertsPagination || {
          currentPage: 1,
          totalPages: 1,
          totalCount: 0,
          limit: 10,
          hasNextPage: false,
          hasPrevPage: false,
        }
      );

      fetchBillingHistoryData(consumer.id);
    } else {
      setCurrentPhase(1);
      setConsumerStats([]);
      setConsumerInfoRow1([
        { title: 'Consumer No', value: '' },
        { title: 'Unique ID', value: '' },
        { title: 'Meter SL No', value: '' },
        {
          title: 'Meter Make',
          value: consumer?.meterMake ,
        },
        // {
        //   title: 'Occupancy Status',
        //   value: '',
        //   onClick: handleOccupancyStatusClick,
        //   clickable: true,
        //   className: 'hover:text-primary',
        // },
      ]);

      setConsumerInfoRow2([
        { title: 'USC', value: '' },
        { title: 'Billing Address', value: '' },
        { title: 'Mobile No', value: '' },
        { title: 'Email ID', value: '' },
      ]);
      setConsumerInfoRow3([
        { title: 'Permanent Address', value: '' },
        { title: 'Billing Address', value: '' },
        { title: 'Mobile No', value: '' },
        { title: 'Email ID', value: '' },
      ]);

      setBillDetailsRow([
        { title: 'Billing Month', value: '' },
        { title: 'Bill Period', value: '' },
        { title: 'Due Date', value: '' },
      ]);

      setConsumptionSummaryCards([
        {
          title: 'Monthly Consumption (kVAh)',
          value: '',
          subtitle1: 'Last Month: ',
          icon: 'icons/electric.svg',
          bg: 'bg-stat-icon-gradient',
          valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
          iconStyle: 'BRAND_GREEN',
        },
        {
          title: 'Daily Consumption (kVAh)',
          value: '',
          subtitle1: 'Yesterday: ',
          icon: 'icons/coins.svg',
          bg: 'bg-stat-icon-gradient',
          valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
          iconStyle: 'BRAND_GREEN',
        },
        {
          title: 'Total Outstanding (Rs.)',
          value: '',
          subtitle1: 'Last Month: ',
          icon: 'icons/search.svg',
          bg: 'bg-stat-icon-gradient',
          valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
          iconStyle: 'BRAND_GREEN',
        },
        {
          title: 'Bill Status',
          value: '',
          subtitle1: 'Due Date: ',
          icon: 'icons/bills2.svg',
          bg: 'bg-stat-icon-gradient',
          valueFontSize: 'text-lg lg:text-xl md:text-lg sm:text-base',
          iconStyle: 'BRAND_GREEN',
        },
      ]);

      setBillingPieData([]);
      setMeterReadingsData([]);
      setPaymentHistoryData([]);
      setAlertsData([]);
      setBillingHistoryData([]);
    }

    const chartData = consumer && failedApis.length === 0 ? consumer.chartData : null;
    const dailyData = formatDailyEnergyData(chartData);
    const monthlyData = formatMonthlyEnergyData(chartData);

    setFirstChartData(dailyData);
    setCurrentChartData(monthlyData);
  }, [consumer, failedApis.length, meterConnectionStatus]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const meterSerialNo = String(consumer?.meterSerialNumber ?? '').trim();
      if (!meterSerialNo || failedApis.length > 0) {
        setMeterConnectionStatus(null);
        return;
      }

      try {
        const status = await meterConnectionAPI.getMeterStatus(meterSerialNo);
        const parsed = MeterConnectionAPI.parseConnectionStatus(status?.isConnected ?? '2');
        if (!cancelled) setMeterConnectionStatus(parsed);
      } catch {
        if (!cancelled) setMeterConnectionStatus('disconnected');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [consumer?.meterSerialNumber, failedApis.length]);

  const handleOccupancyStatusClick = () => {
    const meterSerialNumber = consumer?.meterSerialNumber;
    const consumerNumber = consumer?.consumerNumber;

    if (!meterSerialNumber) {
      return;
    }
    if (consumerNumber) {
      navigate(`/occupancy-status/${meterSerialNumber}?consumerNumber=${consumerNumber}`);
    } else {
      navigate(`/occupancy-status/${meterSerialNumber}`);
    }
  };

  const handleBillingHistoryToggle = (timeRange: string) => {
    setBillingHistoryToggle(timeRange as 'Current Bill' | 'History');
  };

  // const handleBillingHistoryPageChange = (page: number) => {
  //   if (consumer?.id) {
  //     fetchBillingHistoryData(consumer.id, page, 10);
  //   }
  // };

  // const handleBillingHistoryPageSizeChange = (pageSize: number) => {
  //   if (consumer?.id) {
  //     fetchBillingHistoryData(consumer.id, 1, pageSize);
  //   }
  // };

  // const billingHistoryColumns = [
  //   { key: 'sno', label: 'S.No' },
  //   { key: 'billMonth', label: 'Billing Month' },
  //   { key: 'invoiceNo', label: 'Invoice No' },
  //   { key: 'billDate', label: 'Bill From Date' },
  //   { key: 'toDate', label: 'Bill To Date' },
  //   { key: 'dueDate', label: 'Due Date' },
  //   { key: 'noOfUnits', label: 'No. of Units' },
  //   {
  //     key: 'totalBill',
  //     label: 'Total Bill (₹)',
  //     render: (value: any) => {
  //       if (!value || value === 0) return '₹0';
  //       return `₹${parseFloat(value).toLocaleString('en-IN', {
  //         minimumFractionDigits: 2,
  //         maximumFractionDigits: 2,
  //       })}`;
  //     },
  //   },
  // ];

  const alertsColumns = [
    { key: 'sno', label: 'S.No' },
    { key: 'meterNumber', label: 'Meter Number' },
    { key: 'tamperTypeDesc', label: 'Tamper Type' },
    { key: 'occurredOn', label: 'Occurred On' },
    { key: 'resolvedOn', label: 'Resolved On' },
    { key: 'status', label: 'Status' },
    { key: 'duration', label: 'Duration' },
  ];

  const menuItems = [{ id: 'refresh', label: 'Edit', icon: 'icons/Edit.svg' }];

  const handleAlertsPageChange = (page: number, limit?: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('alertsPage', String(page));
    if (limit) {
      params.set('alertsLimit', String(limit));
    }
    _setSearchParams(params);
  };

  const handleAlertsSearch = (searchTerm: string) => {
    const params = new URLSearchParams(searchParams);
    const trimmed = searchTerm.trim();
    params.set('alertsPage', '1');
    if (trimmed) {
      params.set('alertsSearch', trimmed);
    } else {
      params.delete('alertsSearch');
    }
    _setSearchParams(params);
  };

  const handleAlertsClearSearch = () => {
    const params = new URLSearchParams(searchParams);
    params.set('alertsPage', '1');
    params.delete('alertsSearch');
    _setSearchParams(params);
  };

  const handleBackClick = () => {
    navigate('/consumers');
  };

  const handleEditClick = () => {};

  const handleChartDownload = () => {};

  const formatDateForAPI = (dateStr: string): string => {
    if (dateStr.includes('-') && dateStr.length === 10) {
      return dateStr;
    }

    if (
      dateStr.includes('th,') ||
      dateStr.includes('st,') ||
      dateStr.includes('nd,') ||
      dateStr.includes('rd,')
    ) {
      try {
        const parts = dateStr.split(' ');
        if (parts.length >= 2) {
          const monthName = parts[0];
          const dayWithSuffix = parts[1];
          const day = dayWithSuffix.replace(/\D/g, '');
          const currentYear = new Date().getFullYear();
          const monthMap: { [key: string]: string } = {
            Jan: '01',
            Feb: '02',
            Mar: '03',
            Apr: '04',
            May: '05',
            Jun: '06',
            Jul: '07',
            Aug: '08',
            Sep: '09',
            Oct: '10',
            Nov: '11',
            Dec: '12',
          };
          const month = monthMap[monthName];
          if (month && day) {
            const formattedDate = `${currentYear}-${month}-${day.padStart(2, '0')}`;
            return formattedDate;
          }
        }
      } catch (error) {}
    }

    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime()) && date.getFullYear() > 2020) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        return formattedDate;
      }
    } catch (error) {}

    const currentYear = new Date().getFullYear();
    const monthMap: { [key: string]: string } = {
      Jan: '01',
      Feb: '02',
      Mar: '03',
      Apr: '04',
      May: '05',
      Jun: '06',
      Jul: '07',
      Aug: '08',
      Sep: '09',
      Oct: '10',
      Nov: '11',
      Dec: '12',
    };

    const parts = dateStr.split(' ');
    if (parts.length === 2) {
      const day = parts[0].padStart(2, '0');
      const month = monthMap[parts[1]];
      if (month) {
        const formattedDate = `${currentYear}-${month}-${day}`;
        return formattedDate;
      }
    }

    return dateStr;
  };

  const fetchHourlyConsumption = async (date: string, meterId: number) => {
    setModalLoading(true);
    try {
      const formattedDate = formatDateForAPI(date);
      const endpoint = `${BACKEND_URL}/lsdata/consumption?meterId=${meterId}&startDate=${formattedDate}&endDate=${formattedDate}`;

      const response = await fetch(endpoint, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!( ( result.success === true) && Array.isArray(result.data) && result.data.length > 0 )) {
        const dateObj = new Date(formattedDate);
        const startDate = new Date(dateObj);
        startDate.setDate(dateObj.getDate() - 7);

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = formattedDate;

        const fallbackEndpoint = `${BACKEND_URL}/lsdata/consumption?meterId=${meterId}&startDate=${startDateStr}&endDate=${endDateStr}`;

        const fallbackResponse = await fetch(fallbackEndpoint, {
          credentials: 'include',
        });

        if (!fallbackResponse.ok) {
          throw new Error(`HTTP error! status: ${fallbackResponse.status}`);
        }

        let result = await fallbackResponse.json();

        if (!( ( result.success === true) && Array.isArray(result.data) && result.data.length > 0 ) &&
          meterId !== 13
        ) {
          const meter13Endpoint = `${BACKEND_URL}/lsdata/consumption?meterId=13&startDate=${formattedDate}&endDate=${formattedDate}`;
          const meter13Response = await fetch(meter13Endpoint, {
            credentials: 'include',
          });
          if (meter13Response.ok) {
            result = await meter13Response.json();
          }
        }
      }

      if (!(( result.success === true))) {
        throw new Error(result.message || 'Failed to fetch hourly consumption data');
      }

      if (( result.success === true) && Array.isArray(result.data)) {
        const generateTimeSlots = () => {
          const timeSlots = [];
          for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
              const time = new Date();
              time.setHours(hour, minute, 0, 0);
              const timeString = time.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              });
              timeSlots.push(timeString);
            }
          }
          return timeSlots;
        };

        const allTimeSlots = generateTimeSlots();

        const dataMap = new Map();
        result.data.forEach((item: any) => {
          const dateTimeStr = item.timestamp || item.dateTime;

          const timeMatch = dateTimeStr.match(/(\d{1,2}):(\d{2}):(\d{2})\s?(AM|PM)/i);

          if (timeMatch) {
            let hour = timeMatch[1].padStart(2, '0');
            const minute = timeMatch[2];
            const second = timeMatch[3];
            const ampm = timeMatch[4].toUpperCase();
            const timeKey = `${hour}:${minute}:${second} ${ampm}`;
            const processedItem = {
              consumption: item.energies?.kvaImport || item.consumption || 0,
              voltage: item.voltage || null,
              current: item.current || null,
              energies: item.energies || null,
            };
            dataMap.set(timeKey, processedItem);
          }
        });

        const data = allTimeSlots.map((timeSlot) => dataMap.get(timeSlot)?.consumption || 0);
        const xAxisData = allTimeSlots;

        const rawData = allTimeSlots.map((timeSlot) => dataMap.get(timeSlot) || null);

        const transformedData = {
          data,
          xAxisData,
          rawData,
        };
        setModalLineChartData(transformedData);
      } else {
        setModalLineChartData({ data: [], xAxisData: [], rawData: [] });
      }
    } catch (err: any) {
      setModalLineChartData({ data: [], xAxisData: [] });
    } finally {
      setModalLoading(false);
    }
  };

  // Unused function - commented out
  // const _handleBarClick = (data: {
  //     date: string;
  //     value: number;
  //     seriesName: string;
  //     timeRange: string;
  // }) => {
  //     setSelectedBarData(data);
  //     setIsModalOpen(true);
  //
  //     if (consumer?.meterId) {
  //         fetchHourlyConsumption(data.date, consumer.meterId);
  //     } else {
  //         setModalLineChartData({ data: [], xAxisData: [] });
  //     }
  // };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedBarData(null);
    setModalLineChartData({ data: [], xAxisData: [], rawData: [] });
    setModalLoading(false);
    setSelectedPointData(null);
    setSelectedDataType('kvaImport');
  };

  const handlePreviousDay = () => {
    if (!selectedBarData || !consumer?.meterId) return;
    const dateStr = selectedBarData.date;
    let currentDate: Date;

    if (dateStr.includes(',')) {
      const parts = dateStr.split(' ');
      const month = parts[0];
      const day = parts[1].replace(/\D/g, '');
      const currentYear = new Date().getFullYear();
      currentDate = new Date(`${month} ${day}, ${currentYear}`);
    } else {
      const currentYear = new Date().getFullYear();
      currentDate = new Date(`${dateStr} ${currentYear}`);
    }

    currentDate.setDate(currentDate.getDate() - 1);

    const day = currentDate.getDate();
    const month = currentDate.toLocaleDateString('en-US', { month: 'short' });
    const newDateStr = `${day} ${month}`;

    setSelectedBarData({
      ...selectedBarData,
      date: newDateStr,
    });

    fetchHourlyConsumption(newDateStr, consumer.meterId);
  };

  const handleNextDay = () => {
    if (!selectedBarData || !consumer?.meterId) return;
    const dateStr = selectedBarData.date;
    let currentDate: Date;

    if (dateStr.includes(',')) {
      const parts = dateStr.split(' ');
      const month = parts[0];
      const day = parts[1].replace(/\D/g, '');
      const currentYear = new Date().getFullYear();
      currentDate = new Date(`${month} ${day}, ${currentYear}`);
    } else {
      const currentYear = new Date().getFullYear();
      currentDate = new Date(`${dateStr} ${currentYear}`);
    }

    currentDate.setDate(currentDate.getDate() + 1);

    const day = currentDate.getDate();
    const month = currentDate.toLocaleDateString('en-US', { month: 'short' });
    const newDateStr = `${day} ${month}`;

    setSelectedBarData({
      ...selectedBarData,
      date: newDateStr,
    });

    fetchHourlyConsumption(newDateStr, consumer.meterId);
  };

  const handleDataTypeChange = (dataType: string) => {
    setSelectedDataType(dataType);
    setSelectedPointData(null);
  };

  const handleLineChartPointClick = (dataIndex: number) => {
    if (modalLineChartData.rawData && modalLineChartData.rawData[dataIndex]) {
      setSelectedPointData({
        time: modalLineChartData.xAxisData[dataIndex],
        ...modalLineChartData.rawData[dataIndex],
      });
    }
  };

  const prepaidBalanceAmount = (() => {
    if (!consumer?.prepaidTransactions) return 0;

    // Case 1: prepaidTransactions is an object with a balance key
    if (!Array.isArray(consumer.prepaidTransactions)) {
      return Number(consumer.prepaidTransactions.balance ?? 0);
    }

    // Case 2: prepaidTransactions is an array; use balance from first element
    if (consumer.prepaidTransactions.length > 0) {
      return Number(consumer.prepaidTransactions[0]?.balance ?? 0);
    }

    return 0;
  })();

  const prepaidTransactionsTableData = useMemo(() => {
    const formatDate = (d: string | null | undefined) => {
      if (!d) return '-';
      try {
        const date = new Date(d);
        return date.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return String(d);
      }
    };
    const formatINR = (n: number | null | undefined) => {
      const val = Number(n);
      return Number.isFinite(val)
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val)
        : '-';
    };

    // Prefer prepaidTransactions.transactions (recharge data from API)
    const pt = consumer?.prepaidTransactions;
    if (pt && pt.transactions && Array.isArray(pt.transactions) && pt.transactions.length > 0) {
      return pt.transactions.map((t: any, idx: number) => ({
        'S.No': idx + 1,
        transactionId: t.rechargeId ?? t.transactionId ?? t.id ?? '-',
        consumptionKWh: '-',
        balanceBefore: '-',
        balanceAfter: '-',
        description: t.rechargeType ?? t.paymentMethod ?? t.gatewayName ?? '-',
        createdAt: formatDate(t.createdAt ?? t.created_at),
        amount: formatINR(t.amount),
        status: t.paymentStatus ?? t.status ?? '-',
      }));
    }

    return [];
  }, [consumer?.prepaidTransactions]);

  const prepaidConsumptionTableData = useMemo(() => {
    const pc = consumer?.prepaidConsumption;
    const consumption = Array.isArray(pc) ? pc : pc?.consumption;
    if (!consumption || consumption.length === 0) return [];
    const formatDate = (d: string | null | undefined) => {
      if (!d) return '-';
      try {
        const date = new Date(d);
        return date.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return String(d);
      }
    };
    const formatINR = (n: number | null | undefined) => {
      const val = Number(n);
      return Number.isFinite(val)
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val)
        : '-';
    };
    return consumption.map((t: any, idx: number) => ({
      'S.No': idx + 1,
      readingDate: formatDate(t.reading_date),
      previousReading: t.previous_reading != null ? String(t.previous_reading) : '-',
      currentReading: t.current_reading != null ? String(t.current_reading) : '-',
      unitsConsumed: (t.units_consumed ?? t.consumptionKWh) != null ? Number(t.units_consumed ?? t.consumptionKWh).toFixed(3) : '-',
      totalAmount: formatINR(t.total_amount ?? t.amount),
      remarks: t.remarks ?? t.description ?? '-',
      createdAt: formatDate(t.created_at ?? t.createdAt),
    }));
  }, [consumer?.prepaidConsumption]);

  const prepaidBalanceDisplay =
    !Number.isNaN(prepaidBalanceAmount) && prepaidBalanceAmount !== null
      ? `₹ ${prepaidBalanceAmount.toLocaleString('en-IN', {
          maximumFractionDigits: 2,
        })}`
      : '₹ 0';

  const getChartDataByType = (rawData: any[], dataType: string) => {
    if (!rawData || rawData.length === 0) {
      return {
        data: [],
        seriesData: [],
        yAxisLabel: '',
        tooltipLabel: '',
      };
    }

    let seriesData: any[] = [];
    let yAxisLabel = '';
    let tooltipLabel = '';

    switch (dataType) {
      case 'kvaImport':
        seriesData = [
          {
            name: 'kVA Import',
            data: rawData.map((item) => item?.energies?.kvaImport || 0),
            color: '#2563eb',
          },
        ];
        yAxisLabel = 'kVAh';
        tooltipLabel = 'kVA Import';
        break;

      case 'kwImport':
        seriesData = [
          {
            name: 'kW Import',
            data: rawData.map((item) => item?.energies?.kwImport || 0),
            color: '#16a34a',
          },
        ];
        yAxisLabel = 'kVAh';
        tooltipLabel = 'kW Import';
        break;

      case 'voltage':
        seriesData = [
          {
            name: 'R-Phase Voltage',
            data: rawData.map((item) => item?.voltage?.r || 0),
            color: '#dc2626',
          },
          {
            name: 'Y-Phase Voltage',
            data: rawData.map((item) => item?.voltage?.y || 0),
            color: '#eab308',
          },
          {
            name: 'B-Phase Voltage',
            data: rawData.map((item) => item?.voltage?.b || 0),
            color: '#2563eb',
          },
        ];
        yAxisLabel = 'V';
        tooltipLabel = 'Voltage';
        break;

      case 'current':
        seriesData = [
          {
            name: 'R-Phase Current',
            data: rawData.map((item) => item?.current?.r || 0),
            color: '#dc2626',
          },
          {
            name: 'Y-Phase Current',
            data: rawData.map((item) => item?.current?.y || 0),
            color: '#eab308',
          },
          {
            name: 'B-Phase Current',
            data: rawData.map((item) => item?.current?.b || 0),
            color: '#2563eb',
          },
        ];
        yAxisLabel = 'A';
        tooltipLabel = 'Current';
        break;

      default:
        seriesData = [
          {
            name: 'kVA Import',
            data: rawData.map((item) => item?.energies?.kvaImport || 0),
            color: '#2563eb',
          },
        ];
        yAxisLabel = 'kVAh';
        tooltipLabel = 'kVA Import';
    }

    return {
      data: seriesData[0].data,
      seriesData,
      yAxisLabel,
      tooltipLabel,
    };
  };

  const handleTimeRangeChange = (timeRange: string) => {
    setSelectedTimeRange(timeRange as 'Daily' | 'Monthly');
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const fetchBillingHistoryData = async (consumerId: number, page = 1, limit = 10) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/billing/consumer/${consumerId}?page=${page}&limit=${limit}`,
        {
          credentials: 'include',
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (!(( result.success === true) && Array.isArray(result.data))) {
        throw new Error(
          result.meta?.message || result.error?.message || 'Failed to fetch billing history data'
        );
      }
      setBillingHistoryData(result.data);
      setBillingHistoryPagination(result.pagination || result.meta?.pagination || null);
    } catch (err: any) {
      setBillingHistoryData([]);
      setBillingHistoryPagination(null);
    }
  };

  const fetchConsumerData = async (alertsPage = 1, alertsLimit = 10, alertsSearch = '') => {
    if (!currentId) {
      setFailedApis([
        {
          id: 'consumer',
          name: 'Consumer Data',
          retryFunction: fetchConsumerData,
          errorMessage: 'No consumer ID provided. Please try again.',
        },
      ]);
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    setFailedApis([]);

    try {
      const params = new URLSearchParams();
      if (alertsPage > 1) params.append('alertsPage', alertsPage.toString());
      if (alertsLimit !== 10) params.append('alertsLimit', alertsLimit.toString());
      if (alertsSearch.trim()) params.append('alertsSearch', alertsSearch.trim());

      const endpoint = `${BACKEND_URL}/consumers/${currentId}${
        params.toString() ? '?' + params.toString() : ''
      }`;

      const response = await fetch(endpoint, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (!(result && result.success === true && result.data)) {
        throw new Error(
          result.meta?.message || result.error?.message || 'Failed to fetch consumer data'
        );
      }
      setConsumer(result.data);
    } catch (err: any) {
      setConsumer(null);
      setFailedApis([
        {
          id: 'consumer',
          name: 'Consumer Data',
          retryFunction: () => fetchConsumerData(alertsPage, alertsLimit, alertsSearch),
          errorMessage: 'Failed to load Consumer Data. Please try again.',
        },
        {
          id: 'billing',
          name: 'Billing Data',
          retryFunction: () => fetchConsumerData(alertsPage, alertsLimit, alertsSearch),
          errorMessage: 'Failed to load Billing Data. Please try again.',
        },
        {
          id: 'consumption',
          name: 'Consumption Data',
          retryFunction: () => fetchConsumerData(alertsPage, alertsLimit, alertsSearch),
          errorMessage: 'Failed to load Consumption Data. Please try again.',
        },
        {
          id: 'meterReadings',
          name: 'Meter Readings',
          retryFunction: () => fetchConsumerData(alertsPage, alertsLimit, alertsSearch),
          errorMessage: 'Failed to load Meter Readings. Please try again.',
        },
        {
          id: 'paymentHistory',
          name: 'Payment History',
          retryFunction: () => fetchConsumerData(alertsPage, alertsLimit, alertsSearch),
          errorMessage: 'Failed to load Payment History. Please try again.',
        },
        {
          id: 'alerts',
          name: 'Alerts Data',
          retryFunction: () => fetchConsumerData(alertsPage, alertsLimit, alertsSearch),
          errorMessage: 'Failed to load Alerts Data. Please try again.',
        },
        {
          id: 'chartData',
          name: 'Chart Data',
          retryFunction: () => fetchConsumerData(alertsPage, alertsLimit, alertsSearch),
          errorMessage: 'Failed to load Chart Data. Please try again.',
        },
        {
          id: 'statistics',
          name: 'Statistics',
          retryFunction: () => fetchConsumerData(alertsPage, alertsLimit, alertsSearch),
          errorMessage: 'Failed to load Statistics. Please try again.',
        },
        {
          id: 'occupancyStatus',
          name: 'Occupancy Status',
          retryFunction: () => fetchConsumerData(alertsPage, alertsLimit, alertsSearch),
          errorMessage: 'Failed to load Occupancy Status. Please try again.',
        },
        {
          id: 'realTimeData',
          name: 'Real-time Data',
          retryFunction: () => fetchConsumerData(alertsPage, alertsLimit, alertsSearch),
          errorMessage: 'Failed to load Real-time Data. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const urlParams = useMemo(
    () => ({
      alertsPage: parseInt(searchParams.get('alertsPage') || '1'),
      alertsLimit: parseInt(searchParams.get('alertsLimit') || '10'),
      alertsSearch: searchParams.get('alertsSearch') || '',
    }),
    [searchParams]
  );

  useEffect(() => {
    if (currentId) {
      fetchConsumerData(urlParams.alertsPage, urlParams.alertsLimit, urlParams.alertsSearch);
    }
  }, [currentId, urlParams.alertsPage, urlParams.alertsLimit, urlParams.alertsSearch]);

  useEffect(() => {
    if (billingHistoryToggle === 'History' && consumer?.id) {
      fetchBillingHistoryData(consumer.id, 1, 10);
    }
  }, [billingHistoryToggle, consumer?.id]);

  return (
    <Page
      sections={[
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
        {
          layout: {
            type: 'column',
            gap: 'gap-4',
          },
          components: [
            {
              name: 'PageHeader',
              props: {
                title: consumer ? consumer.meterSerialNumber : 'Consumer Details',
                menuItems: menuItems,
                showMenu: false,
                showDropdown: true,
                variant: 'primary',
                onClick: handleEditClick,
                onBackClick: handleBackClick,
                backButtonText: 'Back to Consumers',
              },
            },
          ],
        },
        {
          layout: {
            type: 'grid',
            columns: 2,
            className: 'border border-primary-border rounded-3xl p-4 ',
            rows: [
              {
                layout: 'row',
                className: 'justify-between w-full items-center',
                span: { col: 2, row: 1 },
                columns: [
                  {
                    name: 'SectionHeader',
                    props: {
                      title: 'Consumer Details',
                      titleVariant: 'primary-dark',
                      titleWeight: 'normal',
                      titleSize: 'md',
                      titleAlign: 'left',
                      layout: 'horizontal',
                      gap: 'gap-4',
                      className: 'w-full items-center',
                      rightComponent: {
                        name: 'LastComm',
                        
                        props: {
                          label: 'Balance ',
                          value: prepaidBalanceDisplay,
                          valueClassName: 'font-bold text-lg ',
                          labelClassName: 'text-md',
                        },
                      },

                    },
                  },
                  // {
                  //   name: 'SectionHeader',
                  //   props: {
                  //     title: 'Balance : ₹ 0.00',
                  //     titleVariant: 'primary-dark',
                  //     titleWeight: 'normal',
                  //     titleSize: 'md',
                  //     titleClassName: 'text-right',
                  //     titleAlign: 'right',
                  //     layout: 'horizontal',
                  //     gap: 'gap-4',
                  //     className: 'w-full justify-end',

                  //   },
                  // },

                ],
              },
              {
                layout: 'row' as const,
                className: 'border border-primary-border rounded-3xl p-4 bg-background-secondary',
                span: { col: 2, row: 1 },
                columns: [
                  {
                    name: 'PageInformation',
                    props: {
                      gridColumns: 4,
                      loading: false,
                      skeletonColor: 'bg-primary/10',
                      rows: [
                        {
                          layout: 'row',
                          className: 'justify-between w-full',
                          span: { col: 4, row: 1 },
                          skeletonColor: 'bg-primary/10',
                          items: consumerInfoRow1.map((item) => ({
                            title: item.title,
                            value: item.value,
                            align: 'start',
                            gap: 'gap-1',
                            statusIndicator: item.statusIndicator,
                            onClick: item.onClick,
                            clickable: item.clickable,
                            className: item.className,
                            valueIcon: item.valueIcon,
                            valueIconPosition: item.valueIconPosition,
                            valueIconClassName: item.valueIconClassName,
                            valueClassName: item.valueClassName,
                          })),
                        },
                      ],
                    },
                  },
                ],
              },
          
              {
                layout: 'row' as const,
                className: 'justify-between w-full px-4',
                span: { col: 2, row: 1 },
                columns: [
                  {
                    name: 'PageInformation',
                    props: {
                      loading: false,
                      skeletonColor: 'bg-primary/10',
                      gridColumns: 4,
                      rows: [
                        {
                          layout: 'row',
                          className: 'justify-between w-full',
                          span: { col: 4, row: 1 },

                          items: consumerInfoRow3.map((item) => ({
                            title: item.title,
                            value: item.value,
                            align: 'start',
                            gap: 'gap-1',
                           
                          })),
                        },
                      ],
                    },
                  },
                ],
              },
              {
                layout: 'row' as const,

                className: 'border border-primary-border rounded-3xl p-4 bg-background-secondary',
                span: { col: 2, row: 1 },
                columns: [
                  {
                    name: 'PageInformation',
                    props: {
                      loading: false,
                      skeletonColor: 'bg-primary/10',
                      gridColumns: 4,
                      rows: [
                        {
                          layout: 'row',
                          className: 'justify-between w-full',
                          span: { col: 4, row: 1 },

                          items: consumerInfoRow2.map((item) => ({
                            title: item.title,
                            value: item.value,
                            align: 'start',
                            gap: 'gap-1',
                            onClick: item.onClick,
                            clickable: item.clickable,
                            className: item.className,
                            valueIcon: item.valueIcon,
                            valueIconPosition: item.valueIconPosition,
                            valueIconClassName: item.valueIconClassName,
                            valueClassName: item.valueClassName,
                          })),
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          layout: {
            type: 'grid' as const,
            columns: 1,
            className:
              'w-full p-4 border border-primary-border rounded-3xl bg-background-secondary',
            rows: [
              {
                layout: 'row' as const,
                className: 'justify-between w-full',
                span: { col: 1, row: 1 },
                columns: [
                  {
                    name: 'SectionHeader',
                    props: {
                      title: 'Instantaneous Data',
                      titleLevel: 2,
                      titleSize: 'md',
                      titleVariant: 'primary-dark',
                      titleWeight: 'normal',
                      titleAlign: 'left',
                      className: 'w-full',
                      rightComponent: {
                        name: 'LastComm',
                        props: {
                          label: 'Last Communication',
                          value: consumer?.readingDate || '',
                        },
                      },
                    },
                    span: { col: 1, row: 1 },
                  },
                ],
              },
              ...(consumer && consumerStats.length > 0 && failedApis.length === 0
                ? (() => {
                    const mainStats = consumerStats.filter(
                      (s) => !BOTTOM_ROW_WIDGET_KEYS.includes(s.key as WidgetKey)
                    );
                    const bottomRowStats = BOTTOM_ROW_WIDGET_KEYS
                      .map((k) => consumerStats.find((s) => s.key === k))
                      .filter(Boolean);
                    const gridCols = 4;
                    return [
                      ...(mainStats.length > 0
                        ? [
                            {
                              layout: 'grid' as const,
                              gridColumns: gridCols,
                              className: 'w-full gap-4',
                              columns: mainStats.map((stat) => ({
                                name: 'Card',
                                props: {
                                  title: stat.title,
                                  value: stat.value,
                                  subtitle1: stat.subtitle1,
                                  icon: stat.icon,
                                  bg: stat.bg || 'bg-stat-icon-gradient',
                                  valueFontSize:
                                    stat.valueFontSize || 'text-lg lg:text-xl md:text-lg sm:text-base',
                                  iconStyle: stat.iconStyle || 'BRAND_GREEN',
                                  iconClassName: stat.iconClassName,
                                  width: stat.width,
                                  height: stat.height,
                                  loading: false,
                                },
                                span: { col: 1, row: 1 },
                              })),
                            },
                          ]
                        : []),
                      ...(bottomRowStats.length > 0
                        ? [
                            {
                              layout: 'grid' as const,
                              gridColumns: 4,
                              className: 'w-full gap-4',
                              columns: bottomRowStats.map((stat) => ({
                                name: 'Card',
                                props: {
                                  title: stat.title,
                                  value: stat.value,
                                  subtitle1: stat.subtitle1,
                                  icon: stat.icon,
                                  bg: stat.bg || 'bg-stat-icon-gradient',
                                  valueFontSize:
                                    stat.valueFontSize || 'text-lg lg:text-xl md:text-lg sm:text-base',
                                  iconStyle: stat.iconStyle || 'BRAND_GREEN',
                                  iconClassName: stat.iconClassName,
                                  width: stat.width,
                                  height: stat.height,
                                  loading: false,
                                },
                                span: { col: 1, row: 1 },
                              })),
                            },
                          ]
                        : []),
                    ];
                  })()
                : []),
            ],
          },
        },
        {
          layout: {
            type: 'grid' as const,
            className: '',
            columns: 1,
          },
          components: [
            {
              name: 'BarChart',
              props: {
                xAxisData:
                  selectedTimeRange === 'Daily'
                    ? firstChartData.xAxisData
                    : currentChartData.xAxisData,
                seriesData:
                  selectedTimeRange === 'Daily'
                    ? firstChartData.seriesData
                    : currentChartData.seriesData,
                seriesColors:
                  selectedTimeRange === 'Daily'
                    ? firstChartData.seriesColors
                    : currentChartData.seriesColors,
                dateRange:
                  selectedTimeRange === 'Daily'
                    ? firstChartData.dateRange
                    : currentChartData.dateRange,
                height: 300,
                showLegendInteractions: true,
                yAxisUnit: 'kVAh',
                showHeader: true,
                headerTitle: `${selectedTimeRange} Energy Consumption (kVAh)`,
                prependTimeRangeInTitle: false,
                availableTimeRanges: ['Daily', 'Monthly'],
                initialTimeRange: selectedTimeRange,
                onTimeRangeChange: handleTimeRangeChange,
                showDownloadButton: true,
                onDownload: () => handleChartDownload(),
                isLoading: loading,
              },
            },
          ],
        },
        {
          layout: {
            type: 'column',
            gap: 'gap-0',
          },
          components: [
            {
              name: 'Modal',
              props: {
                isOpen: isModalOpen,
                onClose: handleModalClose,
                title: selectedBarData ? (
                  <div className="flex items-center justify-between w-full gap-4">
                    <button
                      onClick={handlePreviousDay}
                      className="p-2 rounded-lg hover:bg-primary-lightest dark:hover:bg-primary-dark-light transition-colors group"
                      aria-label="Previous day"
                      type="button"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-neutral-dark dark:text-surface group-hover:text-primary"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <span className="flex-1 text-center font-semibold text-lg">
                      15-Minute Energy Consumption - {selectedBarData.date}
                    </span>
                    <button
                      onClick={handleNextDay}
                      className="p-2 rounded-lg hover:bg-primary-lightest dark:hover:bg-primary-dark-light transition-colors group"
                      aria-label="Next day"
                      type="button"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-neutral-dark dark:text-surface group-hover:text-primary"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  '15-Minute Energy Consumption'
                ),
                size: '6xl',
                showCloseIcon: true,
                backdropClosable: true,
                centered: true,
                showPageC: true,
                pageCSections: isModalOpen
                  ? [
                      {
                        layout: {
                          type: 'column' as const,
                          gap: 'gap-2',
                          className: 'w-full',
                        },
                        components: [
                          {
                            name: 'SectionHeader',
                            props: {
                              title: 'Select Data Type',
                              titleVariant: 'primary-dark',
                              titleWeight: 'semibold',
                              titleSize: 'sm',
                              titleAlign: 'left',
                            },
                          },
                          {
                            name: 'TimeRangeSelector',
                            props: {
                              availableTimeRanges: [
                                'kVA Import',
                                'kW Import',
                                'Voltage',
                                'Current',
                              ],
                              selectedTimeRange:
                                selectedDataType === 'kvaImport'
                                  ? 'kVA Import'
                                  : selectedDataType === 'kwImport'
                                  ? 'kW Import'
                                  : selectedDataType === 'voltage'
                                  ? 'Voltage'
                                  : 'Current',
                              handleTimeRangeChange: (range: string) => {
                                const typeMap: Record<string, string> = {
                                  'kVA Import': 'kvaImport',
                                  'kW Import': 'kwImport',
                                  Voltage: 'voltage',
                                  Current: 'current',
                                };
                                handleDataTypeChange(typeMap[range]);
                              },
                              className: 'w-full',
                            },
                          },
                        ],
                      },
                      {
                        layout: {
                          type: 'column' as const,
                          gap: 'gap-4',
                          className: 'w-full',
                        },
                        components: [
                          {
                            name: 'LineChart',
                            props: (() => {
                              const computedData = getChartDataByType(
                                modalLineChartData.rawData || [],
                                selectedDataType
                              );
                              return {
                                data: computedData.data || [],
                                xAxisData: modalLineChartData.xAxisData || [],
                                seriesData: computedData.seriesData || [],
                                yAxisLabel: computedData.yAxisLabel || 'kVAh',
                                tooltipLabel: computedData.tooltipLabel || 'kVA Import',
                                height: 400,
                                showHeader: false,
                                isLoading: modalLoading,
                                showTooltipTimestamp: true,
                                showXAxisLabel: true,
                                timeFormat: '15min',
                                isTimeFormat: true,
                                timeInterval: 15,
                                onPointClick: handleLineChartPointClick,
                                showLegend:
                                  selectedDataType === 'voltage' || selectedDataType === 'current',
                                forceShowLegend: true,
                              };
                            })(),
                          },
                        ],
                      },
                      ...(selectedPointData
                        ? [
                            {
                              layout: {
                                type: 'column' as const,
                                gap: 'gap-4',
                                className:
                                  'w-full border border-primary-border rounded-2xl p-4 bg-background-secondary',
                              },
                              components: [
                                {
                                  name: 'SectionHeader',
                                  props: {
                                    title: `Detailed Data - ${selectedPointData.time}`,
                                    titleVariant: 'primary-dark',
                                    titleWeight: 'semibold',
                                    titleSize: 'md',
                                    titleAlign: 'left',
                                  },
                                },
                                {
                                  name: 'PageInformation',
                                  props: {
                                    gridColumns: 3,
                                    rows: [
                                      {
                                        layout: 'row',
                                        className: 'justify-between w-full gap-4',
                                        span: {
                                          col: 3,
                                          row: 1,
                                        },
                                        items: [
                                          {
                                            title: 'R-Phase Voltage',
                                            value: selectedPointData?.voltage?.r || '',
                                            align: 'start',
                                            gap: 'gap-1',
                                          },
                                          {
                                            title: 'Y-Phase Voltage',
                                            value: selectedPointData?.voltage?.y || '',
                                            align: 'start',
                                            gap: 'gap-1',
                                          },
                                          {
                                            title: 'B-Phase Voltage',
                                            value: selectedPointData?.voltage?.b || '',
                                            align: 'start',
                                            gap: 'gap-1',
                                          },
                                        ],
                                      },
                                      {
                                        layout: 'row',
                                        className: 'justify-between w-full gap-4',
                                        span: {
                                          col: 3,
                                          row: 1,
                                        },
                                        items: [
                                          {
                                            title: 'R-Phase Current',
                                            value: selectedPointData?.current?.r || '',
                                            align: 'start',
                                            gap: 'gap-1',
                                          },
                                          {
                                            title: 'Y-Phase Current',
                                            value: selectedPointData?.current?.y || '',
                                            align: 'start',
                                            gap: 'gap-1',
                                          },
                                          {
                                            title: 'B-Phase Current',
                                            value: selectedPointData?.current?.b || '',
                                            align: 'start',
                                            gap: 'gap-1',
                                          },
                                        ],
                                      },
                                      {
                                        layout: 'row',
                                        className: 'justify-between w-full gap-4',
                                        span: {
                                          col: 3,
                                          row: 1,
                                        },
                                        items: [
                                          {
                                            title: 'kVA Import',
                                            value: selectedPointData?.energies?.kvaImport || '0',
                                            align: 'start',
                                            gap: 'gap-1',
                                          },
                                          {
                                            title: 'kW Import',
                                            value: selectedPointData?.energies?.kwImport || '0',
                                            align: 'start',
                                            gap: 'gap-1',
                                          },
                                          {
                                            title: 'Consumption',
                                            value: selectedPointData?.consumption || '0',
                                            align: 'start',
                                            gap: 'gap-1',
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                },
                              ],
                            },
                          ]
                        : []),
                    ]
                  : [],
              },
            },
          ],
        },
        {
          layout: {
            type: 'grid',
            columns: 2,
            className: 'border border-primary-border rounded-3xl  p-4 justify-between w-full',
            rows: [
              {
                layout: 'row',
                className: 'justify-between w-full',
                span: { col: 1, row: 1 },
                columns: [
                  {
                    name: 'SectionHeader',
                    span: { col: 1, row: 2 },
                    props: {
                      title: 'Billing, Consumption & History',
                      titleVariant: 'primary-dark',
                      titleWeight: 'normal',
                      titleSize: 'md',
                      titleAlign: 'left',
                      layout: 'vertical',
                      gap: 'gap-4',
                      className: 'w-full',
                    },
                  },
                ],
              },
              {
                layout: 'row' as const,
                className: 'justify-end w-full',
                span: { col: 1, row: 1 },
                columns: [
                  {
                    name: 'TimeRangeSelector',
                    span: { col: 1, row: 2 },
                    props: {
                      availableTimeRanges: ['Current Bill', 'History'],
                      selectedTimeRange: billingHistoryToggle,
                      handleTimeRangeChange: handleBillingHistoryToggle,
                      className: ' bg-background-secondary',
                      width: '',
                    },
                  },
                ],
              },
              ...(billingHistoryToggle === 'Current Bill'
                ? [
                    {
                      layout: 'row' as const,
                      className: 'justify-between w-full',
                      span: { col: 2, row: 1 },
                      columns: consumptionSummaryCards.map((item) => ({
                        name: 'Card',
                        props: {
                          title: item.title,
                          value: item.value,
                          subtitle1: item.subtitle1,
                          subtitle2: item.subtitle2,
                          icon: item.icon,
                          width: 2,
                          height: 2,
                          bg: item.bg,
                          valueFontSize: item.valueFontSize,
                          iconStyle: item.iconStyle,
                          className: 'bg-background-secondary border border-primary-border',
                          loading: false,
                        },
                      })),
                    },
                    
                  ]
                : []),
              ...(billingHistoryToggle === 'History'
                ? [
                    {
                      layout: 'column' as const,
                      className: '',
                      span: { col: 2, row: 1 },
                      columns: [
                        {
                          name: 'Table',
                          props: {
                            headerTitle: 'Prepaid Transaction History',
                            showDownload: true,
                            showHeader: false,
                            data: prepaidTransactionsTableData,
                            columns: PREPAID_TRANSACTION_COLUMNS,
                            className: 'w-full',
                            emptyMessage: 'No prepaid transactions found',
                            searchable: true,
                            pagination: prepaidTransactionsTableData.length > 10,
                            rowsPerPageOptions: [10, 25, 50],
                            initialRowsPerPage: 10,
                          },
                        },
                      ],
                    },
                    {
                      layout: 'column' as const,
                      className: '',
                      span: { col: 2, row: 1 },
                      columns: [
                        {
                          name: 'Table',
                          props: {
                            headerTitle: 'Prepaid Consumption History',
                            showDownload: true,
                            showHeader: true,
                            data: prepaidConsumptionTableData,
                            columns: PREPAID_CONSUMPTION_COLUMNS,
                            className: 'w-full',
                            emptyMessage: 'No prepaid consumption found',
                            searchable: true,
                            pagination: prepaidConsumptionTableData.length > 10,
                            rowsPerPageOptions: [10, 25, 50],
                            initialRowsPerPage: 10,
                          },
                        },
                      ],
                    },
                  ]
                : []),
              ...(billingHistoryToggle === 'Current Bill'
                ? [
                    {
                      layout: 'row' as const,
                      className:
                        'border border-primary-border rounded-3xl p-4 bg-background-secondary',
                      span: { col: 2, row: 1 },
                      columns: [
                        {
                          name: 'PageInformation',
                          props: {
                            gridColumns: 3,
                            loading: false,
                            skeletonColor: 'bg-primary/10',
                            rows: [
                              {
                                layout: 'row',
                                className: 'justify-between w-full',
                                span: {
                                  col: 3,
                                  row: 1,
                                },
                                items: billDetailsRow.map((item) => ({
                                  title: item.title,
                                  value: item.value,
                                  align: 'start',
                                  gap: 'gap-1',
                                })),
                              },
                            ],
                          },
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
        },
        {
          layout: {
            type: 'grid',
            columns: 1,
            rows: [
              {
                layout: 'row',
                className: 'justify-between w-full pb-4',
                span: { col: 1, row: 1 },
                columns: [
                  {
                    name: 'Table',
                    props: {
                      headerTitle: 'Tamper Alerts',
                      showHeader: true,
                      data: alertsData,
                      useStatusDurationMapping: true,
                      columns: alertsColumns,
                      searchable: true,
                      pagination: true,
                      availableTimeRanges: [],
                      initialRowsPerPage: alertsPagination.limit || 10,
                      pageSize: alertsPagination.limit || 10,
                      itemsPerPage: alertsPagination.limit || 10,
                      rowsPerPageOptions: [3, 5, 10],
                      loading: loading,
                      serverPagination: alertsPagination,
                      onPageChange: handleAlertsPageChange,
                      onSearch: handleAlertsSearch,
                      onClearSearch: handleAlertsClearSearch,
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

export default ConsumerDetailView;
  