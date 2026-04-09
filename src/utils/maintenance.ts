export type MaintenanceAssetType = 'meters' | 'modems';

export const normalizeMaintenanceAssetType = (
  rawType?: string | null
): MaintenanceAssetType => {
  if (!rawType) return 'modems';
  const normalized = rawType.toLowerCase();

  if (normalized.startsWith('meter')) {
    return 'meters';
  }

  return 'modems';
};

export const getMaintenanceCopy = (assetType: MaintenanceAssetType) => {
  const isMeter = assetType === 'meters';
  const singular = isMeter ? 'Meter' : 'Modem';
  const plural = isMeter ? 'Meters' : 'Modems';

  return {
    assetType,
    singular,
    plural,
    serialLabel: `${singular} SI No`,
    idLabel: `${singular} ID`,
    basePath: `/maintenance-application/${assetType}`,
    dashboardTitle: `${singular} Maintenance Module`,
    issueListTitle: `${singular} Issues`,
    pendingIssuesTitle: `Pending ${singular} Issues`,
    disconnectedTitle: `Disconnected ${plural}`,
    detailTitle: `${singular} Issue Details`,
  };
};

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const tryParseCustomMaintenanceDate = (raw: string): Date | null => {
  // Handles strings like "05 May 2025 13:34:04 AM"
  const match =
    raw
      .trim()
      .match(
        /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i
      );

  if (!match) return null;

  const [, d, mon, y, h, m, s = '0', ampm] = match;
  const day = Number(d);
  const year = Number(y);
  const monthIdx = MONTH_MAP[mon.toLowerCase()];
  if (monthIdx === undefined || Number.isNaN(day) || Number.isNaN(year)) {
    return null;
  }

  let hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s);

  // If hour <= 12 and AM/PM present, treat as 12‑hour.
  // If hour > 12, treat as 24‑hour and ignore AM/PM (fixes values like "13:34:04 AM").
  if (hours <= 12 && ampm) {
    const isPM = ampm.toUpperCase() === 'PM';
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
  }

  const date = new Date(year, monthIdx, day, hours, minutes, seconds);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatMaintenanceDate = (dateTime: string): string => {
  try {
    let date = new Date(dateTime);

    // If native parsing fails, try our custom parser
    if (Number.isNaN(date.getTime())) {
      const parsed = tryParseCustomMaintenanceDate(dateTime);
      if (!parsed) return dateTime;
      date = parsed;
    }

    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    return `${month} ${day}, ${year} ${displayHours}:${minutes} ${ampm}`;
  } catch {
    return dateTime;
  }
};
