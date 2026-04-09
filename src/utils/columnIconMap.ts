/**
 * Column Icon Mapping Utility
 *
 * Pattern-based system for automatically detecting and applying icons and status indicators
 * to table columns. This helps identify which sub-app has which columns by showing
 * visual indicators (icons) in the table headers.
 *
 * Usage: When autoDetectColumnIcons is enabled in Table component,
 * columns without explicit icons will automatically get icons from this map.
 */

export interface ColumnIconConfig {
  icon?: string;
  iconPosition?: 'left' | 'right';
  iconSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string;
  statusIndicator?: {
    activeColor?: string;
    inactiveColor?: string;
  };
  isActive?: (value: string | number | boolean | null | undefined) => boolean;
}

/**
 * Column Type Patterns
 * Uses regex patterns to match column keys to their types
 */
interface ColumnPattern {
  pattern: RegExp;
  config: ColumnIconConfig;
}

/**
 * Helper function to create meter status indicator config
 */
const createMeterStatusConfig = (): ColumnIconConfig => ({
  icon: 'icons/meter.svg',
  iconPosition: 'left',
  iconSize: 'sm',
  statusIndicator: {
    activeColor: 'bg-secondary',
    inactiveColor: 'bg-danger',
  },
  isActive: (value: string | number | boolean | null | undefined) =>
    value !== null &&
    value !== undefined &&
    String(value).trim() !== '' &&
    String(value) !== '0' &&
    !String(value).toLowerCase().includes('not assigned'),
});

/**
 * Helper function to create status column config
 */
const createStatusConfig = (): ColumnIconConfig => ({
  icon: 'icons/status.svg',
  iconPosition: 'left',
  iconSize: 'sm',
  statusIndicator: {
    activeColor: 'bg-secondary',
    inactiveColor: 'bg-danger',
  },
  isActive: (value: string | number | boolean | null | undefined) =>
    String(value).toLowerCase() === 'active' ||
    String(value).toLowerCase() === 'connected' ||
    String(value).toLowerCase() === 'online' ||
    String(value).toLowerCase() === 'running',
});

/**
 * Column patterns - order matters! More specific patterns should come first
 */
const COLUMN_PATTERNS: ColumnPattern[] = [
  // Meter columns with status indicator (most specific - must come first)
  {
    pattern: /^(meter|metersi|meter_si|meterno|meter_no|meternumber|meter_number)$/i,
    config: createMeterStatusConfig(),
  },
  // Status columns
  {
    pattern: /^status$/i,
    config: createStatusConfig(),
  },
  // Consumer name columns
  {
    pattern: /^(consumer)?name|consumer_name$/i,
    config: { icon: 'icons/user.svg', iconPosition: 'left', iconSize: 'sm' },
  },
  // DTR name columns
  {
    pattern: /^(dtr|transformer)(name|_name)?$/i,
    config: { icon: 'icons/dtr.svg', iconPosition: 'left', iconSize: 'sm' },
  },
  // UID/ID columns
  {
    pattern: /^(uid|id|unitid|unit_id|consumerid|consumer_id|consumernumber|consumer_number)$/i,
    config: { icon: 'icons/list.svg', iconPosition: 'left', iconSize: 'sm' },
  },
  // Location/Address columns
  {
    pattern: /^(location|address|flatno|flat_no|flatnumber)$/i,
    config: { icon: 'icons/location.svg', iconPosition: 'left', iconSize: 'sm' },
  },
  // Date columns
  {
    pattern: /(date|created|updated|occurred|possession|billdate|duedate|opening|closing)/i,
    config: { icon: 'icons/calendar.svg', iconPosition: 'left', iconSize: 'sm' },
  },
  // Amount/Money columns
  {
    pattern: /(amount|balance|overdue|price|cost|charges|billamount|demand|energy|penal)/i,
    config: { icon: 'icons/rupee.svg', iconPosition: 'right', iconSize: 'sm' },
  },
  // Units/Consumption columns
  {
    pattern: /(units|consumption|reading|kwh|kvah|kva|kw|md)/i,
    config: { icon: 'icons/consumption.svg', iconPosition: 'right', iconSize: 'sm' },
  },
  // Contact columns
  {
    pattern:
      /^(email|emailaddress|email_address|mobile|phone|mobilenumber|mobile_number|phonenumber|phone_number)$/i,
    config: { icon: 'icons/email.svg', iconPosition: 'left', iconSize: 'sm' },
  },
  {
    pattern: /^(phone|phonenumber|phone_number|mobile|mobilenumber|mobile_number)$/i,
    config: { icon: 'icons/phone.svg', iconPosition: 'left', iconSize: 'sm' },
  },
  // Company/Organization columns
  {
    pattern: /(company|aldcompany|unitname|unit_name)$/i,
    config: { icon: 'icons/app.svg', iconPosition: 'left', iconSize: 'sm' },
  },
  // Feeder columns
  {
    pattern: /^(feeder|feeder_name)$/i,
    config: { icon: 'icons/feeder.svg', iconPosition: 'left', iconSize: 'sm' },
  },
  // Type/Category columns
  {
    pattern: /^(type|category|unittype|unit_type)$/i,
    config: { icon: 'icons/type.svg', iconPosition: 'left', iconSize: 'sm' },
  },
  // Duration/Time columns
  {
    pattern: /^(duration|time)$/i,
    config: { icon: 'icons/time-twenty-four.svg', iconPosition: 'right', iconSize: 'sm' },
  },
  // Event/Description columns
  {
    pattern: /(event|description|tamper|tampertype|eventdescription|event_description)$/i,
    config: { icon: 'icons/eventAlertIcon.svg', iconPosition: 'left', iconSize: 'sm' },
  },
  // Serial number columns
  {
    pattern: /^(sno|s_no|serialnumber|serial_number)$/i,
    config: { icon: 'icons/list.svg', iconPosition: 'left', iconSize: 'sm' },
  },
];

/**
 * Direct column mappings for exact matches (fallback for specific cases)
 * These are used when pattern matching doesn't work or for very specific column names
 */
const COLUMN_DIRECT_MAP: Record<string, ColumnIconConfig> = {
  // Exact matches that might not be caught by patterns
  meter: createMeterStatusConfig(),
  meterNumber: createMeterStatusConfig(),
  meterNo: createMeterStatusConfig(),
  meterSI: createMeterStatusConfig(),
  meterSINo: createMeterStatusConfig(),
  'Meter SI No': createMeterStatusConfig(),
};

/**
 * Get icon configuration for a column key using pattern matching
 * @param columnKey - The column key to look up
 * @returns Icon configuration if found, undefined otherwise
 */
export function getColumnIcon(columnKey: string): ColumnIconConfig | undefined {
  if (!columnKey) return undefined;

  // Normalize the key: lowercase and trim
  const normalizedKey = columnKey.toLowerCase().trim();

  // First, try direct map for exact matches
  if (COLUMN_DIRECT_MAP[columnKey] || COLUMN_DIRECT_MAP[normalizedKey]) {
    return COLUMN_DIRECT_MAP[columnKey] || COLUMN_DIRECT_MAP[normalizedKey];
  }

  // Then try pattern matching (order matters - first match wins)
  for (const { pattern, config } of COLUMN_PATTERNS) {
    if (pattern.test(normalizedKey) || pattern.test(columnKey)) {
      return config;
    }
  }

  return undefined;
}

/**
 * Apply auto-detected icons and status indicators to columns if they don't already have them
 * @param columns - Array of column definitions
 * @returns Array of columns with auto-detected icons and status indicators applied
 */
export function applyAutoDetectedIcons<
  T extends { key: string; icon?: string; statusIndicator?: any; isActive?: any },
>(columns: T[]): T[] {
  return columns.map(column => {
    // Try to get config from map
    const iconConfig = getColumnIcon(column.key);
    if (!iconConfig) {
      return column;
    }

    // Build the updated column config
    const updatedColumn: any = { ...column };

    // Apply icon if column doesn't already have one
    if (iconConfig.icon && !column.icon) {
      updatedColumn.icon = iconConfig.icon;
      updatedColumn.iconPosition = iconConfig.iconPosition || 'left';
      updatedColumn.iconSize = iconConfig.iconSize || 'sm';
    }

    // Apply status indicator if column doesn't already have one
    if (iconConfig.statusIndicator && !column.statusIndicator) {
      updatedColumn.statusIndicator = iconConfig.statusIndicator;
    }

    // Apply isActive function if column doesn't already have one
    if (iconConfig.isActive && !column.isActive) {
      updatedColumn.isActive = iconConfig.isActive;
    }

    return updatedColumn as T;
  });
}

/**
 * Add a new column pattern (for extending the system)
 * @param pattern - Regex pattern to match column keys
 * @param config - Icon configuration to apply
 */
export function addColumnPattern(pattern: RegExp, config: ColumnIconConfig): void {
  COLUMN_PATTERNS.unshift({ pattern, config }); // Add to beginning for priority
}

/**
 * Add a new direct column mapping (for specific column names)
 * @param columnKey - Exact column key
 * @param config - Icon configuration to apply
 */
export function addColumnMapping(columnKey: string, config: ColumnIconConfig): void {
  COLUMN_DIRECT_MAP[columnKey] = config;
}
