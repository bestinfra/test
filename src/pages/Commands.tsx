import React, { useState, useEffect, useRef, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import BACKEND_URL from '../config';
import * as XLSX from 'xlsx';
const Page = lazy(() => import('SuperAdmin/Page'));

interface MeterInfo {
  serialNumber: string;
  uscNo?: string;
  consumerName: string;
  phase: string;
  dtr?: string;
  feeder?: string;
}

const Commands: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTab, setSelectedTab] = useState<string>('Single Meter');
  const [searchValue, setSearchValue] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [meterInfo, setMeterInfo] = useState<MeterInfo | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<string>('');
  const [selectedMeterId, setSelectedMeterId] = useState<number | null>(null);
  const [isExecutingCommand, setIsExecutingCommand] = useState<boolean>(false);
  const [errorMessages, setErrorMessages] = useState<any[]>([]);
  const [commandResponseMessage, setCommandResponseMessage] = useState<string | null>(null);
  const [commandIsSuccess, setCommandIsSuccess] = useState<boolean | null>(null);
  const [commandHistory, setCommandHistory] = useState<any[]>([]);
  const [allCommandHistory, setAllCommandHistory] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(10);
  const [historyTotalRecords, setHistoryTotalRecords] = useState<number>(0);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState<number>(0);
  const [historyFilters, setHistoryFilters] = useState<{
    command: string;
    status: string;
    dateRange: { start: string; end: string };
  }>({
    command: 'all',
    status: 'all',
    dateRange: { start: '', end: '' },
  });
  const [bulkCommands, setBulkCommands] = useState<
    { meterSerialNo: string; command: 'connect' | 'disconnect' }[]
  >([]);
  const isUpdatingFromUrl = useRef(false);
  const isInitialMount = useRef(true);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExecutingCommandRef = useRef(false);

  const tabToParamMap: Record<string, string> = {
    'Single Meter': 'single',
    'Bulk Actions': 'bulk',
    // 'Scheduled': 'scheduled',
  };

  const paramToTabMap: Record<string, string> = {
    single: 'Single Meter',
    bulk: 'Bulk Actions',
    // scheduled: 'Scheduled',
  };

  // 🔁 Refresh Command History when meter OR command execution changes
  useEffect(() => {
    if (!meterInfo?.serialNumber) return;

    fetchMeterDetails(meterInfo.serialNumber);

    console.log('📊 [Commands] Command History refreshed');
  }, [meterInfo?.serialNumber, refreshHistoryTrigger]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');

    if (tabParam) {
      const mappedTab = paramToTabMap[tabParam.toLowerCase()];
      if (mappedTab && mappedTab !== selectedTab) {
        isUpdatingFromUrl.current = true;
        setSelectedTab(mappedTab);
        setTimeout(() => {
          isUpdatingFromUrl.current = false;
        }, 0);
      }
    } else if (isInitialMount.current) {
      isUpdatingFromUrl.current = true;
      setSearchParams({ tab: 'single' }, { replace: true });
      setSelectedTab('Single Meter');
      setTimeout(() => {
        isUpdatingFromUrl.current = false;
      }, 0);
    }

    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [searchParams]);

  useEffect(() => {
    if (isInitialMount.current || isUpdatingFromUrl.current) return;

    const tabParam = tabToParamMap[selectedTab];
    const currentTabParam = searchParams.get('tab');

    if (tabParam && currentTabParam !== tabParam) {
      isUpdatingFromUrl.current = true;
      setSearchParams({ tab: tabParam }, { replace: true });
      setTimeout(() => {
        isUpdatingFromUrl.current = false;
      }, 0);
    }
  }, [selectedTab]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Search consumers using the same `/consumers/search` API pattern as AppLayout
  const searchConsumers = async (query: string) => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const fullUrl = `${BACKEND_URL}/consumers/search?query=${encodeURIComponent(trimmedQuery)}`;
      const response = await fetch(fullUrl, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        setSearchResults([]);
        return;
      }

      const result = await response.json();
      if (result?.success && Array.isArray(result.data) && result.data.length > 0) {
        const suggestions = result.data.map((item: any, index: number) => {
          return {
            id: `consumer-${index}`,
            // Display label: Consumer No • Meter No • Name
            name: `${item.consumerNumber || 'N/A'} • ${item.meterNumber || 'N/A'} • ${item.name || ''}`,
            consumerNumber: item.consumerNumber,
            meterNumber: item.meterNumber,
            uid: item.uid || item.consumerNumber,
            // Keep originals for navigation behaviour consistent with AppLayout
            originalConsumerNumber: item.consumerNumber,
            originalName: item.name,
            originalMeterNumber: item.meterNumber,
            _originalData: item,
            _searchType: 'consumer',
          };
        });
        setSearchResults(suggestions);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('🔍 [Commands] Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchMeterDetails = async (meterSerialOrNumber: string) => {
    if (!meterSerialOrNumber) {
      setMeterInfo(null);
      return;
    }

    const url = `${BACKEND_URL}/commands/meter/${encodeURIComponent(String(meterSerialOrNumber))}`;

    try {
      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json().catch(() => null);

      console.log('🔌 [Commands] Meter commands API response (for Meter Information)', {
        url,
        status: res.status,
        ok: res.ok,
        data,
      });

      // API shape:
      // {
      //   status: "success" | "error",
      //   message: "...",
      //   data: {
      //     meterInfo: { ... },
      //     commandHistory: [ ... ]
      //   },
      //   error?: { code: string; message: string; details?: string },
      //   meta: {},
      //   timestamp: "...",
      //   traceId: "..."
      // }
      const payload = data?.data ?? data;

      if (!res.ok) {
        const backendMessage =
          data?.error?.message ||
          data?.message ||
          'Failed to fetch meter information. Please try again.';
        addError(backendMessage);
        // Keep existing meterInfo / commandHistory so the UI does not reset
        return;
      }

      if (payload?.meterInfo) {
        const mi = payload.meterInfo;
        // Prefer backend meterNumber as the canonical "serial" used for commands
        const effectiveMeterNumber = mi.meterNumber || mi.serialNumber || meterSerialOrNumber;

        const mapped: MeterInfo = {
          serialNumber: effectiveMeterNumber,
          uscNo: mi.uscNo,
          consumerName: mi.consumerName || '',
          phase: mi.phase || '',
          dtr: mi.dtr || '',
          feeder: mi.feeder || '',
          // status: mi.status || '',
        };
        setMeterInfo(mapped);
      }

      // Populate command history (for Command History section / History tab)
      if (Array.isArray(payload?.commandHistory)) {
        setCommandHistory(payload.commandHistory);
      }
    } catch (error) {
      console.error('🔌 [Commands] Meter commands API error (Meter Information)', error);
      addError('Failed to fetch meter information. Please try again.');
      // Keep existing meterInfo / commandHistory so the UI does not reset
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchConsumers(value);
      }, 300);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handleSearchResultClick = (result: any) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    const consumerNumber =
      result.originalConsumerNumber ??
      result.consumerNumber ??
      result._originalData?.consumerNumber;
    const meterNumber = result.originalMeterNumber ?? result.meterNumber;
    const name = result.originalName ?? result.name;

    const displayValue = [consumerNumber || 'N/A', meterNumber || 'N/A', name || '']
      .filter(Boolean)
      .join(' • ');

    setSearchValue(displayValue);

    setSearchResults([]);
    setIsSearching(false);

    // Do NOT navigate – instead keep behaviour local to the Commands page.
    // 1) Set selected meter for command execution
    const meterId = result._originalData?.meterId ?? result.meterId ?? result.id;
    if (meterId) {
      setSelectedMeterId(meterId);
    }

    // 2) Call commands API with clicked meter serial / meter number and populate Meter Information
    const serialOrMeter =
      result.originalMeterNumber ??
      result.meterNumber ??
      result.serialNumber ??
      result._originalData?.meterNumber ??
      result._originalData?.serialNumber;

    console.log('🔍 [Commands] Selected from search', {
      consumerNumber,
      meterNumber,
      name,
      meterId,
      serialOrMeter,
    });

    if (serialOrMeter) {
      fetchMeterDetails(String(serialOrMeter));
    }
  };

  const handleSearchClick = () => {
    if (searchValue.trim()) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchConsumers(searchValue.trim());
    }
  };

  const handleSendCommand = async (command: string) => {
    if (isExecutingCommandRef.current) {
      // Prevent double-triggered clicks from sending duplicate requests
      return;
    }

    if (!selectedMeterId || !meterInfo?.serialNumber) {
      const msg = 'Please select a meter first before executing a command.';
      addError(msg);
      setCommandResponseMessage(msg);
      setCommandIsSuccess(false);
      return;
    }

    // Only CONNECT and DISCONNECT are supported by backend APIs
    const validCommands = ['CONNECT', 'DISCONNECT'];
    const normalizedCommand = command.toUpperCase().replace(' ', '_');
    if (!validCommands.includes(normalizedCommand)) {
      const msg = `Invalid command type: ${command}. Valid commands are: ${validCommands.join(', ')}`;
      addError(msg);
      setCommandResponseMessage(msg);
      setCommandIsSuccess(false);
      return;
    }

    // Clear previous command status before executing a new one
    setCommandResponseMessage(null);
    setCommandIsSuccess(null);

    setIsExecutingCommand(true);
    isExecutingCommandRef.current = true;

    try {
      const meterNumber = meterInfo.serialNumber;
      const payload = {
        meterSerialNo: meterNumber,
      };

      let endpoint: string | null = null;

      if (normalizedCommand === 'CONNECT') {
        endpoint = `${BACKEND_URL}/commands/connect`;
      } else if (normalizedCommand === 'DISCONNECT') {
        endpoint = `${BACKEND_URL}/commands/disconnect`;
      }

      if (!endpoint) {
        // For now, we only wire real APIs for CONNECT/DISCONNECT
        const msg = `No API configured for command: ${command}`;
        addError(msg);
        setCommandResponseMessage(msg);
        setCommandIsSuccess(false);
        return;
      }

      console.log('🔌 [Commands] Sending connect/disconnect request', {
        command: normalizedCommand,
        endpoint,
        payload,
      });

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = 'Failed to send command. Please try again.';
        addError(msg);
        setCommandResponseMessage(msg);
        setCommandIsSuccess(false);
      } else {
        const prettyCommand =
          normalizedCommand === 'CONNECT'
            ? 'Connect'
            : normalizedCommand === 'DISCONNECT'
              ? 'Disconnect'
              : command;

        const msg = `${prettyCommand} command executed successfully`;
        setCommandResponseMessage(msg);
        setCommandIsSuccess(true);

        // 🔥 Trigger useEffect instead of calling API directly
        setRefreshHistoryTrigger((prev) => prev + 1);
      }

      const data = await res.json().catch(() => null);

      console.log('🔌 [Commands] Command execution response', {
        endpoint,
        status: res.status,
        ok: res.ok,
        data,
      });

      if (!res.ok) {
        const msg = 'Failed to send command. Please try again.';
        addError(msg);
        setCommandResponseMessage(msg);
        setCommandIsSuccess(false);
      } else {
        const prettyCommand =
          normalizedCommand === 'CONNECT'
            ? 'Connect'
            : normalizedCommand === 'DISCONNECT'
              ? 'Disconnect'
              : command;
        const msg = `${prettyCommand} command executed successfully`;
        setCommandResponseMessage(msg);
        setCommandIsSuccess(true);
      }
    } catch (error: any) {
      console.error('🔌 [Commands] Command execution error', error);
      const msg =
        error?.message || `Error executing "${command}" on meter ${meterInfo.serialNumber}`;
      addError(msg);
      setCommandResponseMessage(msg);
      setCommandIsSuccess(false);
    } finally {
      setIsExecutingCommand(false);
      isExecutingCommandRef.current = false;
      setSelectedCommand('');
    }
  };
  //  adding use Effect for table

  const addError = (errorMessage: string) => {
    if (!errorMessage || typeof errorMessage !== 'string') {
      return;
    }

    setErrorMessages((prev) => {
      const trimmedMessage = errorMessage.trim();
      if (!prev.includes(trimmedMessage)) {
        return [...prev, trimmedMessage];
      }
      return prev;
    });
  };

  const removeError = (indexToRemove: number) => {
    setErrorMessages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const clearErrors = () => {
    setErrorMessages([]);
  };

  const retryAllAPIs = () => {
    clearErrors();
  };

  // Helpers for History tab filters and API
  const formatDateForHistory = (input: any): string => {
    if (!input) return '';
    const d = typeof input === 'string' ? new Date(input) : input;
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const handleHistoryCommandChange = (value: string) => {
    setHistoryFilters((prev) => ({ ...prev, command: value }));
    setHistoryPage(1);
  };

  const handleHistoryStatusChange = (value: string) => {
    setHistoryFilters((prev) => ({ ...prev, status: value }));
    setHistoryPage(1);
  };

  const handleHistoryDateRangeChange = (dates: any, dateStrings?: [string, string]) => {
    let start = '';
    let end = '';

    if (Array.isArray(dateStrings) && dateStrings[0] && dateStrings[1]) {
      start = formatDateForHistory(dateStrings[0]);
      end = formatDateForHistory(dateStrings[1]);
    } else if (Array.isArray(dates) && dates[0] && dates[1]) {
      start = formatDateForHistory(dates[0]);
      end = formatDateForHistory(dates[1]);
    } else if (dates && (dates.start || dates.end)) {
      start = formatDateForHistory(dates.start);
      end = formatDateForHistory(dates.end);
    }

    if (start && end) {
      setHistoryFilters((prev) => ({
        ...prev,
        dateRange: { start, end },
      }));
      setHistoryPage(1);
    }
  };

  const fetchHistoryData = async (page: number = historyPage, limit: number = historyPageSize) => {
    setIsHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));

      if (historyFilters.command && historyFilters.command !== 'all') {
        params.set('command', historyFilters.command);
      }

      if (historyFilters.status && historyFilters.status !== 'all') {
        params.set('status', historyFilters.status);
      }

      if (historyFilters.dateRange.start && historyFilters.dateRange.end) {
        params.set('startDate', historyFilters.dateRange.start);
        params.set('endDate', historyFilters.dateRange.end);
      }

      const url = `${BACKEND_URL}/commands/history?${params.toString()}`;

      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json().catch(() => null);
      const payload = data?.data ?? data;

      if (!res.ok) {
        const msg =
          data?.error?.message ||
          data?.message ||
          'Failed to fetch command history. Please try again.';
        addError(msg);
        return;
      }

      let rows: any[] = [];
      if (Array.isArray(payload?.history)) {
        rows = payload.history;
      } else if (Array.isArray(payload?.items)) {
        rows = payload.items;
      } else if (Array.isArray(payload?.commandHistory)) {
        rows = payload.commandHistory;
      } else if (Array.isArray(payload)) {
        rows = payload;
      }

      setAllCommandHistory(rows);

      const total =
        typeof payload?.meta?.pagination?.totalCount === 'number'
          ? payload.meta.pagination.totalCount
          : typeof payload?.total === 'number'
            ? payload.total
            : typeof payload?.totalRecords === 'number'
              ? payload.totalRecords
              : rows.length;
      setHistoryTotalRecords(total);
    } catch (_error) {
      addError('Failed to fetch command history. Please try again.');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Fetch history when History tab, filters, or pagination change
  useEffect(() => {
    if (selectedTab !== 'History') return;
    fetchHistoryData(historyPage, historyPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedTab,
    historyPage,
    historyPageSize,
    historyFilters.command,
    historyFilters.status,
    historyFilters.dateRange.start,
    historyFilters.dateRange.end,
  ]);

  const getMeterInformationData = (info: MeterInfo) => {
    const rows: any[] = [
      {
        label: 'Serial Number',
        value: info.serialNumber,
        showDot: true,
      },
      {
        label: 'USC Number',
        value: info.uscNo ?? '',
      },
      {
        label: 'Consumer Name',
        value: info.consumerName,
      },
      {
        label: 'Phase',
        value: info.phase,
      },
    ];

    // Only show DTR and Feeder when backend actually sends values
    if (info.dtr) {
      rows.splice(4, 0, {
        label: 'DTR',
        value: info.dtr,
      });
    }

    if (info.feeder) {
      // Insert Feeder after DTR / before Status
      const statusIndex = rows.findIndex((r) => r.label === 'Status');
      const insertIndex = statusIndex === -1 ? rows.length : statusIndex;
      rows.splice(insertIndex, 0, {
        label: 'Feeder',
        value: info.feeder,
      });
    }

    return rows;
  };

  const formatRequestedTime = (input: any): string => {
    if (!input || input === '-') return '-';

    const date = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return String(input);
    }

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;

    return `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`;
  };

  const getCommandHistoryRows = (source: any[] = []) => {
    return source.map((item: any, index: number) => {
      // Backend-provided keys for command history rows
      const requestId = item.request_id ?? item.id ?? '-';
      const commandName = item.command_name ?? item.commandName ?? item.command ?? '-';
      const selectionType = item.selection_type ?? item.selectionType ?? 'METER';
      const requestedTimeRaw =
        item.requested_time ?? item.requestedTime ?? item.request_time ?? '-';
      const requestedTime = formatRequestedTime(requestedTimeRaw);
      const status = item.status ?? '-';
      const selected = item['selected_meter(s)'] ?? item.selected_meters ?? item.selected ?? '-';
      const consumerName =
        item.meterInfo?.consumerName ??
        item.meterInfo?.consumer_name ??
        item.user_id ??
        item.requested_by ??
        '-';
      const action = item.action ?? '-';
      const hesStatusCode = item.hes_status_code ?? '-';

      const normalizedCommandName = String(commandName).toUpperCase();
      const isDisconnect = normalizedCommandName === 'DISCONNECT';
      const isConnect = normalizedCommandName === 'CONNECT';

      return {
        'S.No': index + 1,
        'Request ID': requestId,
        requestId,
        'Command Name': (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              isDisconnect
                ? 'bg-danger-light text-danger'
                : isConnect
                  ? 'bg-secondary-light text-secondary'
                  : ''
            }`}
          >
            {commandName}
          </span>
        ),
        commandName,
        Selected: selected,
        selected,
        'selected_meter(s)': selected,
        'Selection Type': selectionType,
        selectionType,
        'Requested Time': requestedTime,
        requestedTime,
        Status: status,
        status,
        'Consumer Name': consumerName,
        consumerName,
        Action: action,
        action,
        'HES Status Code': hesStatusCode,
        hesStatusCode,
      };
    });
  };

  const handleDownloadBulkTemplate = () => {
    // Simple CSV template that Excel can open directly
    // Columns:
    // 1. meterSerialNo – meter serial number
    // 2. Command – either connect or disconnect (case-insensitive)
    const headers = ['meterSerialNo', 'Command'];
    const csvContent = `${headers.join(',')}\n`;

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bulk-meter-commands-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBulkFileSelected = async (file: File | null | undefined) => {
    if (!file) {
      setBulkCommands([]);
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      const parsed: { meterSerialNo: string; command: 'connect' | 'disconnect' }[] = [];

      json.forEach((row) => {
        const serial = String(row.meterSerialNo || row.MeterSerialNo || '').trim();
        const cmdRaw = String(row.Command || row.command || '')
          .trim()
          .toLowerCase();

        if (!serial || !cmdRaw) return;
        if (cmdRaw !== 'connect' && cmdRaw !== 'disconnect') return;

        parsed.push({
          meterSerialNo: serial,
          command: cmdRaw as 'connect' | 'disconnect',
        });
      });

      setBulkCommands(parsed);

      console.log('🔌 [Commands] Parsed bulk commands from file', {
        file: file.name,
        totalRows: json.length,
        validCommands: parsed.length,
      });
    } catch (error) {
      console.error('🔌 [Commands] Failed to parse bulk upload file', error);
      addError('Failed to read bulk upload file. Please check the format.');
      setBulkCommands([]);
    }
  };

  const handleExecuteBulkCommands = async () => {
    if (!bulkCommands.length) {
      addError('No valid bulk commands found. Please upload a template with data first.');
      return;
    }

    setIsExecutingCommand(true);

    const results: { meterSerialNo: string; command: string; ok: boolean; message: string }[] = [];

    try {
      for (const item of bulkCommands) {
        const endpoint =
          item.command === 'connect'
            ? `${BACKEND_URL}/commands/connect`
            : `${BACKEND_URL}/commands/disconnect`;

        try {
          const payload = { meterSerialNo: item.meterSerialNo };
          console.log('🔌 [Commands] Bulk connect/disconnect request', {
            command: item.command,
            endpoint,
            payload,
          });
          const res = await fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          const data = await res.json().catch(() => null);
          const ok = res.ok;
          const message =
            data?.message ||
            (ok
              ? `Command ${item.command} executed successfully`
              : `Command ${item.command} failed`);

          results.push({
            meterSerialNo: item.meterSerialNo,
            command: item.command,
            ok,
            message,
          });

          console.log('🔌 [Commands] Bulk command response', {
            endpoint,
            meterSerialNo: item.meterSerialNo,
            status: res.status,
            ok,
            data,
          });
        } catch (err: any) {
          console.error('🔌 [Commands] Bulk command error', err);
          results.push({
            meterSerialNo: item.meterSerialNo,
            command: item.command,
            ok: false,
            message: err?.message || 'Network / unknown error',
          });
        }
      }

      const successCount = results.filter((r) => r.ok).length;
      const failureCount = results.length - successCount;

      addError(`Bulk execution completed. Success: ${successCount}, Failed: ${failureCount}.`);
    } finally {
      setIsExecutingCommand(false);
    }
  };

  const getContentSections = (): any[] => {
    if (selectedTab === 'Single Meter') {
      return [
        {
          layout: {
            type: 'grid' as const,
            columns: 2,
            gap: 'gap-4',
            className:
              'w-full border border-primary-border dark:border-dark-border rounded-lg p-4 bg-background-secondary dark:bg-primary-dark-light',
            rows: [
              {
                layout: 'row',
                columns: [
                  {
                    name: 'PageHeader',
                    props: {
                      title: 'Search Meter',
                      titleClassName: 'text-md font-semibold text-text-primary dark:text-white m-0',
                    },
                  },
                ],
                span: { col: 1, row: 1 },
              },
              {
                layout: 'row',
                columns: [
                  {
                    name: 'Search',
                    props: {
                      placeholder: 'Enter meter serial number',
                      value: searchValue,
                      onChange: handleSearchChange,
                      results: searchResults,
                      isLoading: isSearching,
                      onResultClick: handleSearchResultClick,
                      showShortcut: false,
                      className: 'max-w-md',
                    },
                  },
                  {
                    name: 'Button',
                    props: {
                      label: 'Search',
                      variant: 'primary',
                      onClick: handleSearchClick,
                      disabled: !searchValue.trim(),
                    },
                  },
                ],
                span: { col: 2, row: 1 },
              },
            ],
          },
        },
        ...(meterInfo
          ? [
              {
                layout: {
                  type: 'grid' as const,
                  columns: 2,
                  gap: 'gap-4',
                  rows: [
                    {
                      layout: 'column',
                      className:
                        'border border-primary-border dark:border-dark-border rounded-lg p-4 ',
                      columns: [
                        {
                          name: 'PageHeader',
                          props: {
                            title: 'Meter Information',
                            titleClassName:
                              'text-md font-semibold text-text-primary dark:text-white',
                          },
                        },
                        {
                          name: 'Information',
                          props: {
                            title: '',
                            itemClassName: 'w-full flex-row justify-between',
                            data: getMeterInformationData(meterInfo),
                            loading: true,
                          },
                        },
                      ],
                      span: { col: 1, row: 1 },
                    },
                    {
                      layout: 'column',
                      className:
                        'border border-primary-border dark:border-dark-border rounded-lg p-4 h-full bg-background-secondary dark:bg-primary-dark-light',
                      columns: [
                        {
                          name: 'PageHeader',
                          props: {
                            title: 'Command Execution',
                            titleClassName:
                              'text-md font-semibold text-text-primary dark:text-white m-0 mb-4',
                          },
                        },
                        {
                          name: 'Command',
                          props: {
                            selectedCommand: selectedCommand,
                            onCommandChange: setSelectedCommand,
                            onSendCommand: handleSendCommand,
                            onViewStatus: () => {},
                            className: 'w-full h-full',
                            disabled: !selectedMeterId,
                            loading: isExecutingCommand,
                            autoClearLoading: true,
                            responseMessage: commandResponseMessage,
                            isSuccess: commandIsSuccess,
                            onClearMessage: () => {
                              setCommandResponseMessage(null);
                              setCommandIsSuccess(null);
                            },
                            // Only connect / disconnect are supported now
                            commandOptions: [
                              { label: 'Connect', value: 'connect' },
                              { label: 'Disconnect', value: 'disconnect' },
                            ],
                          },
                        },
                      ],
                      span: { col: 1, row: 1 },
                    },
                  ],
                },
              },
            ]
          : []),
        ...(meterInfo
          ? [
              {
                layout: {
                  type: 'column' as const,
                  className: 'w-full',
                  rows: [
                    {
                      layout: 'row',
                      columns: [
                        {
                          name: 'Table',
                          props: {
                            className: 'w-full mb-3',
                            headerTitle: 'Command History',
                            data: getCommandHistoryRows(commandHistory),
                            selectable: false,
                            showHeader: true,

                            columns: [
                              { key: 'S.No', label: 'S.No' },
                              { key: 'Request ID', label: 'Request ID' },
                              { key: 'Command Name', label: 'Command Name' },
                              { key: 'selected_meter(s)', label: 'Selected Meter(s)' },
                              { key: 'Selection Type', label: 'Selection Type' },
                              { key: 'Requested Time', label: 'Requested Time' },
                              { key: 'Status', label: 'Status' },
                              { key: 'Consumer Name', label: 'Requested By' },
                            ],
                            showDownload: true,
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            ]
          : []),
      ];
    }

    if (selectedTab === 'Bulk Actions') {
      return [
        {
          layout: {
            type: 'column' as const,
            gap: 'gap-4',
            className: 'rounded-lg bg-background-secondary border border-primary-border p-4',
            rows: [
              {
                layout: 'column',
                className: 'w-full',
                columns: [
                  {
                    name: 'PageHeader',
                    props: {
                      title: 'Upload Meter List',
                      titleClassName: 'text-md font-bold text-text-primary dark:text-white m-0',
                    },
                  },
                  {
                    name: 'Form',
                    props: {
                      border: 'none',
                      padding: 'p-0',
                      formBackground: 'bg-none ',
                      inputs: [
                        {
                          name: 'chosenfile',
                          type: 'chosenfile',
                          minHeight: 'min-h-[400px]',
                          label: 'Drag and Drop to add meters',
                          placeholder: 'Drag and Drop to add meters',
                          contentClassName: 'bg-white',
                          downloadLink: {
                            text: 'Download Template',
                            icon: 'download',
                            onClick: handleDownloadBulkTemplate,
                          },
                          accept: '.xlsx,.xls,.csv',
                          onChange: (event: any) => {
                            const file: File | null =
                              event?.target?.files?.[0] ?? event?.file ?? null;
                            handleBulkFileSelected(file);
                          },
                        },
                      ],
                      gridLayout: {
                        gridColumns: 1,
                        gridRows: 1,
                        gap: 'gap-4',
                        className: 'w-full',
                      },
                    },
                  },
                ],
                span: {
                  row: 1,
                  col: 3,
                },
              },
              {
                layout: 'row',
                className: 'w-full',
                columns: [
                  {
                    name: 'Dropdown',
                    props: {
                      placeholder: 'Select Command',
                      searchable: false,
                      options: [
                        // { label: 'Ping', value: 'ping' },
                        { label: 'Connect', value: 'connect' },
                        { label: 'Disconnect', value: 'disconnect' },
                        // { label: 'Relay Status', value: 'relayStatus' },
                      ],
                    },
                  },
                  {
                    name: 'Button',
                    props: {
                      className: 'w-full',
                      label: 'Execute Bulk Command',
                      variant: 'primary',
                      onClick: handleExecuteBulkCommands,
                      disabled: isExecutingCommand || !bulkCommands.length,
                    },
                  },
                  {
                    name: 'Button',
                    props: {
                      className: 'w-full',
                      label: 'Download Reject List',
                      variant: 'danger',
                    },
                  },
                ],
              },
            ],
          },
        },
      ];
    }

    if (selectedTab === 'Scheduled') {
      return [
        {
          layout: {
            type: 'column' as const,
            gap: 'gap-4',
            rows: [
              {
                layout: 'column',
                className: 'border border-primary-border rounded-lg p-6 bg-background-secondary',
                columns: [
                  {
                    name: 'PageHeader',
                    props: {
                      title: 'Schedule New Command',
                      subtitle2: 'Set up automated command execution at specified times.',
                    },
                  },
                  {
                    name: 'Form',
                    props: {
                      border: 'none',
                      padding: 'p-0',
                      formBackground: 'bg-none',
                      inputs: [
                        {
                          name: 'targetSelection',
                          type: 'dropdown',
                          label: 'Target Selection',
                          placeholder: 'Choose target',
                          row: 1,
                          col: 1,
                          options: [
                            { label: 'Single Meter', value: 'single' },
                            { label: 'Bulk Meters', value: 'bulk' },
                            { label: 'Group', value: 'group' },
                          ],
                          onChange: (_value: string) => {},
                        },
                        {
                          name: 'scheduleTime',
                          type: 'choosetime',
                          label: 'Schedule Time',
                          placeholder: 'Select time',
                          row: 2,
                          col: 1,
                          onChange: (_value: string) => {},
                        },
                        {
                          name: 'scheduleCommandButton',
                          type: 'button',
                          label: 'Schedule Command',
                          className: 'w-full',
                          icon: 'clock',
                          row: 3,
                          col: 1,
                          colSpan: 2,
                          onClick: () => {},
                        },
                        {
                          name: 'commandType',
                          type: 'dropdown',
                          label: 'Command Type',
                          placeholder: 'Select command',
                          row: 1,
                          col: 2,
                          options: [
                            // { label: 'Ping', value: 'ping' },
                            { label: 'Connect', value: 'connect' },
                            { label: 'Disconnect', value: 'disconnect' },
                            // { label: 'Relay Status', value: 'relayStatus' },
                          ],
                          onChange: (_value: string) => {},
                        },
                        {
                          name: 'frequency',
                          type: 'dropdown',
                          label: 'Frequency',
                          placeholder: 'Select frequency',
                          row: 2,
                          col: 2,
                          options: [
                            { label: 'Once', value: 'once' },
                            { label: 'Daily', value: 'daily' },
                            { label: 'Weekly', value: 'weekly' },
                            { label: 'Monthly', value: 'monthly' },
                          ],
                          onChange: (_value: string) => {},
                        },
                      ],
                      gridLayout: {
                        gridColumns: 2,
                        gridRows: 3,
                        gap: 'gap-4',
                        className: 'w-full',
                      },
                    },
                  },
                ],
              },
              {
                layout: 'column',
                className: 'border border-primary-border rounded-lg p-6 bg-background-secondary',
                columns: [
                  {
                    name: 'PageHeader',
                    props: {
                      title: 'Scheduled Jobs',
                    },
                  },
                  {
                    name: 'ActivityLog',
                    props: {
                      title: '',
                      entries: [],
                      className: 'border-none bg-transparent p-0',
                      maxHeight: 'h-auto',
                      showScrollbar: false,
                    },
                  },
                ],
              },
            ],
          },
        },
      ];
    }

    if (selectedTab === 'History') {
      return [
        {
          layout: {
            type: 'grid' as const,
            columns: 5,
            gap: 'gap-4',
            className: 'w-full',
            rows: [
              {
                layout: 'row',
                className: 'w-full bg-background-secondary rounded-xl p-4 items-center',
                columns: [
                  {
                    name: 'Search',
                    props: {
                      placeholder: 'Search Command History',
                      value: searchValue,
                      onChange: handleSearchChange,
                      showShortcut: false,
                      className: 'max-w-2xl',
                      span: {
                        row: 1,
                        col: 1,
                      },
                    },
                  },
                  {
                    name: 'RangePicker',
                    props: {
                      onChange: handleHistoryDateRangeChange,
                      picker: 'date',
                      dateFormat: 'DD-MM-YYYY',
                    },
                  },
                  {
                    name: 'Dropdown',
                    props: {
                      placeholder: 'Select Command',
                      options: [
                        { label: 'All Commands', value: 'all' },
                        { label: 'Connect', value: 'CONNECT' },
                        { label: 'Disconnect', value: 'DISCONNECT' },
                      ],
                      value: historyFilters.command,
                      onChange: (e: any) =>
                        handleHistoryCommandChange(
                          typeof e === 'string' ? e : (e?.target?.value ?? 'all')
                        ),
                      className: 'max-w-md',
                    },
                  },
                  {
                    name: 'Button',
                    props: {
                      label: 'Clear Filters',
                      variant: 'secondary',
                      onClick: () => {
                        setHistoryFilters({
                          command: 'all',
                          status: 'all',
                          dateRange: { start: '', end: '' },
                        });
                        setHistoryPage(1);
                      },
                      className: 'max-w-lg',
                    },
                  },
                ],
                span: {
                  row: 1,
                  col: 5,
                },
              },
              {
                layout: 'grid',

                className: 'w-full',
                columns: [
                  {
                    name: 'Table',
                    props: {
                      data: getCommandHistoryRows(allCommandHistory),
                      showHeader: false,
                      searchable: false,
                      searchContainerClassName: 'bg-background-secondary p-4 rounded-3xl',
                      showSearchBarDownload: false,
                      headerTitle: 'Command History',
                      selectable: true,
                      searchbarDownload: true,
                      customFilterOptions: [
                        {
                          label: 'Command',
                          type: 'dropdown',
                          options: [
                            { value: 'all', label: 'All Commands' },
                            { value: 'CONNECT', label: 'Connect' },
                            { value: 'DISCONNECT', label: 'Disconnect' },
                          ],
                          value: historyFilters.command,
                          onChange: (value: string) => handleHistoryCommandChange(value),
                        },
                        {
                          label: 'Status',
                          type: 'dropdown',
                          options: [
                            { value: 'all', label: 'All Status' },
                            { value: 'PROCESSED', label: 'Processed' },
                            { value: 'PENDING', label: 'Pending' },
                            { value: 'FAILED', label: 'Failed' },
                          ],
                          value: historyFilters.status,
                          onChange: (value: string) => handleHistoryStatusChange(value),
                        },
                        {
                          label: 'Date Range',
                          type: 'rangePicker',
                          placeholder: 'Select Date Range',
                          startDate: historyFilters.dateRange.start,
                          endDate: historyFilters.dateRange.end,
                          onChange: handleHistoryDateRangeChange,
                        },
                      ],
                      columns: [
                        {
                          key: 'S.No',
                          label: 'S.No',
                        },

                        { key: 'commandName', label: 'Command Name' },
                        { key: 'selected_meter(s)', label: 'Selected Meter(s)' },
                        { key: 'selectionType', label: 'Selection Type' },
                        { key: 'requestedTime', label: 'Requested Time' },
                        { key: 'status', label: 'Status' },
                        // { key: 'consumerName', label: 'Consumer Name' },
                        { key: 'consumerName', label: 'Requested By' },
                        { key: 'action', label: 'Action' },
                        // { key: 'hesStatusCode', label: 'HES Status Code' },
                      ],
                      showPagination: true,
                      currentPage: historyPage,
                      totalRecords: historyTotalRecords,
                      pageSize: historyPageSize,
                      onPageChange: (page: number) => setHistoryPage(page),
                      onPageSizeChange: (size: number) => {
                        setHistoryPageSize(size);
                        setHistoryPage(1);
                      },
                      loading: isHistoryLoading,
                    },
                  },
                ],
                span: {
                  row: 1,
                  col: 5,
                },
              },
            ],
          },
        },
      ];
    }

    return [];
  };

  return (
    <Page
      sections={[
        ...(errorMessages.length > 0
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
                            visibleErrors: errorMessages,
                            onRetry: retryAllAPIs,
                            onClose: () => removeError(0),
                            showRetry: true,
                            maxVisibleErrors: 4,
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
                      title: 'Commands',
                      onBackClick: () => window.history.back(),
                      backButtonText: 'Back to Dashboard',
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          layout: {
            type: 'column',
            gap: 'gap-4',
            rows: [
              {
                layout: 'row',
                columns: [
                  {
                    name: 'TimeRangeSelector',
                    props: {
                      availableTimeRanges: ['Single Meter', 'Bulk Actions', 'History'],
                      selectedTimeRange: selectedTab,
                      handleTimeRangeChange: (value: string) => {
                        setSelectedTab(value);
                      },
                      className: 'bg-background-secondary',
                    },
                  },
                ],
              },
            ],
          },
        },
        ...getContentSections(),
      ]}
    />
  );
};

export default Commands;
