import React from 'react';
import type { Column, TableData } from '../types/module';
import { formatTableDate } from './dateFormat';

export const calculateDaysPending = (dateTime: string): number => {
  try {
    const date = new Date(dateTime);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  } catch {
    return 0;
  }
};


export const formatDuration = (dateTime: string): string => {
  try {
    const date = new Date(dateTime);
    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - date.getTime());

    const totalMinutes = Math.floor(diffTime / (1000 * 60));
    const totalHours = Math.floor(diffTime / (1000 * 60 * 60));
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;

    if (days > 0) {
      const result = `${days}d ${hours}h`;
      return result;
    } else if (totalHours > 0) {
      const result = `${totalHours}h ${minutes}m`;
      return result;
    } else {
      const result = `${totalMinutes}m`;
      return result;
    }
  } catch (error) {
    console.error(`[formatDuration] Error formatting duration for "${dateTime}":`, error);
    return 'NA';
  }
};

/** Parse "00d 00h 30m 00s" (or partial) into { d, h, m, s }. Missing parts default to 0. */
const parseDurationString = (raw: string): { d: number; h: number; m: number; s: number } | null => {
  const trimmed = raw.trim();
  const dMatch = trimmed.match(/(\d+)\s*d/i);
  const hMatch = trimmed.match(/(\d+)\s*h/i);
  const mMatch = trimmed.match(/(\d+)\s*m/i);
  const sMatch = trimmed.match(/(\d+)\s*s/i);
  if (!dMatch && !hMatch && !mMatch && !sMatch) return null;
  return {
    d: dMatch ? parseInt(dMatch[1], 10) : 0,
    h: hMatch ? parseInt(hMatch[1], 10) : 0,
    m: mMatch ? parseInt(mMatch[1], 10) : 0,
    s: sMatch ? parseInt(sMatch[1], 10) : 0,
  };
};

/**
 * Format parsed duration per display rules:
 * - Only sec → "Xs"
 * - Min + sec → "Xm Xs"
 * - Hours (and min/sec) → "Xh Xm" (show only hours and minutes)
 * - Days (and h/m/s) → "Xd Xh" (show only days and hours)
 */
const formatApiDuration = (raw: string): string => {
  const parsed = parseDurationString(raw);
  if (!parsed) return raw;
  const { d, h, m, s } = parsed;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
};

const isPreformattedDurationString = (raw: string): boolean => {
  if (!raw.trim()) return false;
  return parseDurationString(raw) !== null;
};

interface MapStatusAndDurationOptions {
  statusKey?: string;
  durationKey?: string;
  dateTimeKey?: string;
}

const detectColumnKeys = (columns: Column[]): { statusKey?: string; durationKey?: string; dateTimeKey?: string } => {
  const statusPatterns = ['status', 'issuestatus', 'state', 'currentstatus', 'alertstatus'];
  const durationPatterns = ['duration', 'timeelapsed', 'elapsed', 'pendingtime', 'waittime'];
  const dateTimePatterns = ['datetime', 'date', 'occuredon', 'occurredon', 'createdat', 'updatedat', 'lastcommunication', 'timestamp', 'time'];

  let detectedStatusKey: string | undefined;
  let detectedDurationKey: string | undefined;
  let detectedDateTimeKey: string | undefined;

  columns.forEach(column => {
    const keyLower = column.key.toLowerCase();
    
    if (!detectedStatusKey && statusPatterns.some(pattern => keyLower.includes(pattern))) {
      detectedStatusKey = column.key;
    }
    if (!detectedDurationKey && durationPatterns.some(pattern => keyLower.includes(pattern))) {
      detectedDurationKey = column.key;
    }
    

    if (!detectedDateTimeKey && dateTimePatterns.some(pattern => keyLower.includes(pattern))) {
      detectedDateTimeKey = column.key;
    }
  });

  return {
    statusKey: detectedStatusKey,
    durationKey: detectedDurationKey,
    dateTimeKey: detectedDateTimeKey,
  };
};

export const mapStatusAndDurationColumns = (
  columns: Column[],
  options: MapStatusAndDurationOptions = {}
): Column[] => {

  const detectedKeys = detectColumnKeys(columns);
  // console.log('detectedKeys', detectedKeys);

  const statusKey = options.statusKey ?? detectedKeys.statusKey ?? 'issueStatus';
  const durationKey = options.durationKey ?? detectedKeys.durationKey ?? 'duration';
  const dateTimeKey = options.dateTimeKey ?? detectedKeys.dateTimeKey ?? 'dateTime';


  const normalizeStatus = (raw: string): 'Resolved' | 'Active' => {
    const value = raw.trim().toLowerCase();

    if (
      value === 'resolved' ||
      value === 'closed' ||
      value === 'completed' ||
      value === 'success'
    ) {
      return 'Resolved';
    }

    return 'Active';
  };

  const mappedColumns = columns.map((column: Column): Column => {
    if (column.key === dateTimeKey && column.key !== statusKey && column.key !== durationKey) {
      return {
        ...column,
        render: (value: TableData[string]) => {
          if (!value) {
            return React.createElement('span', { className: 'whitespace-nowrap' }, 'NA');
          }
          try {
            const formattedDate = formatTableDate(String(value));
            return React.createElement('span', { className: 'whitespace-nowrap' }, formattedDate);
          } catch (error) {
            return React.createElement('span', { className: 'whitespace-nowrap' }, String(value));
          }
        },
      };
    }

    if (column.key !== statusKey && column.key !== durationKey) {
      return column;
    }

    if (column.key === statusKey) {
      const statusColumn: Column = {
        ...column,
        render: (value: TableData[string]) => {
          const raw = String(value ?? '');
          const normalized = normalizeStatus(raw);

          const isResolved = normalized === 'Resolved';
          const iconSrc = isResolved ? 'icons/resolvedIcon.svg' : 'icons/in-progess.svg';
          const iconClasses = isResolved ? 'w-4 h-4' : 'w-4 h-4 animate-spin-slow';
          
          const statusClasses = isResolved
            ? 'flex items-center justify-start gap-2 px-2 py-1 rounded-full text-xs font-medium bg-secondary-light w-24 text-positive'
            : 'flex items-center justify-start gap-2 px-2 py-1 rounded-full text-xs font-medium bg-warning-light w-24 text-warning';

          return React.createElement(
            'span',
            {
              className: statusClasses,
            },
            React.createElement('img', {
              src: iconSrc,
              alt: `${normalized} icon`,
              className: iconClasses,
            }),
            normalized
          );
        },
      };

      return statusColumn;
    }

  
    if (column.key === durationKey) {
      const durationColumn: Column = {
        ...column,
        render: (value: TableData[string], row: TableData) => {
          // If API sends duration as "00d 00h 30m 00s", format per rules: sec only → "Xs"; min+sec → "Xm Xs"; h+m+s → "Xh Xm"; d+h+m+s → "Xd Xh"
          const rawDuration = value != null ? String(value).trim() : '';
          if (rawDuration && isPreformattedDurationString(rawDuration)) {
            const displayDuration = formatApiDuration(rawDuration);
            return React.createElement(
              'span',
              { className: 'whitespace-nowrap' },
              displayDuration
            );
          }

          // Fallback: compute duration from dateTime
          const rawDate = row[dateTimeKey];
          if (typeof rawDate !== 'string') {
            return React.createElement(
              'span',
              { className: 'whitespace-nowrap' },
              rawDuration || 'NA'
            );
          }

          const formattedDuration = formatDuration(rawDate);
          return React.createElement(
            'span',
            { className: 'whitespace-nowrap' },
            formattedDuration
          );
        },
      };

      return durationColumn;
    }

    return column;
  });

  return mappedColumns;
};

