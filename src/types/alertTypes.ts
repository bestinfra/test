// Alert Categories
export const AlertCategory = {
  PHASE_MISSING: 'Phase Missing',
  CT_ISSUES: 'CT Issues',
  LOAD: 'Load',
  VOLTAGE: 'Voltage',
  CURRENT: 'Current',
  POWER_FACTOR: 'Power Factor',
  POWER_REVERSAL: 'Power Reversal',
  TAMPER: 'Tamper',
  SECURITY: 'Security',
  MANUFACTURER: 'Manufacturer Specific',
} as const;

export type AlertCategoryType = (typeof AlertCategory)[keyof typeof AlertCategory];

// Alert Severity Levels
export const AlertSeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type AlertSeverityType = (typeof AlertSeverity)[keyof typeof AlertSeverity];

// Alert Type Definitions and Color Mappings
export interface AlertType {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverityType;
  color: string;
  category: AlertCategoryType;
}

// Tamper Descriptions to Alert Type Mapping
export const tamperAlertMapping: Record<string, AlertType> = {
  // Phase Missing - Critical
  'R_PH Missing': {
    id: 'phase_missing_r',
    name: 'R Phase Missing',
    description: 'R phase is not detected in the meter readings',
    severity: AlertSeverity.CRITICAL,
    color: 'var(--color-danger)',
    category: AlertCategory.PHASE_MISSING,
  },
  'Y_PH Missing': {
    id: 'phase_missing_y',
    name: 'Y Phase Missing',
    description: 'Y phase is not detected in the meter readings',
    severity: AlertSeverity.CRITICAL,
    color: 'var(--color-danger)',
    category: AlertCategory.PHASE_MISSING,
  },
  'B_PH Missing': {
    id: 'phase_missing_b',
    name: 'B Phase Missing',
    description: 'B phase is not detected in the meter readings',
    severity: AlertSeverity.CRITICAL,
    color: 'var(--color-danger)',
    category: AlertCategory.PHASE_MISSING,
  },
  'Potential Missing': {
    id: 'potential_missing',
    name: 'Potential Missing',
    description: 'Potential/voltage reference is missing',
    severity: AlertSeverity.CRITICAL,
    color: 'var(--color-danger)',
    category: AlertCategory.PHASE_MISSING,
  },

  // CT Issues - High
  'R_PH CT Reversed': {
    id: 'ct_reversed_r',
    name: 'R Phase CT Reversed',
    description: 'Current transformer for R phase is connected in reverse',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-warning)',
    category: AlertCategory.CT_ISSUES,
  },
  'Y_PH CT Reversed': {
    id: 'ct_reversed_y',
    name: 'Y Phase CT Reversed',
    description: 'Current transformer for Y phase is connected in reverse',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-warning)',
    category: AlertCategory.CT_ISSUES,
  },
  'B_PH CT Reversed': {
    id: 'ct_reversed_b',
    name: 'B Phase CT Reversed',
    description: 'Current transformer for B phase is connected in reverse',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-warning)',
    category: AlertCategory.CT_ISSUES,
  },
  'CT Short': {
    id: 'ct_short',
    name: 'CT Short Circuit',
    description: 'Current transformer is short-circuited',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-warning)',
    category: AlertCategory.CT_ISSUES,
  },
  'CT Open': {
    id: 'ct_open',
    name: 'CT Open Circuit',
    description: 'Current transformer circuit is open',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-warning)',
    category: AlertCategory.CT_ISSUES,
  },
  'Current Reversa': {
    id: 'current_reversal',
    name: 'Current Reversal',
    description: 'Current flow direction is reversed',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-warning)',
    category: AlertCategory.CT_ISSUES,
  },

  // Load Issues - High
  'Load Imbalance': {
    id: 'load_imbalance',
    name: 'Load Imbalance',
    description: 'Uneven distribution of load across phases',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-warning-alt)',
    category: AlertCategory.LOAD,
  },
  Overload: {
    id: 'overload',
    name: 'System Overload',
    description: 'System is operating beyond rated capacity',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-warning-alt)',
    category: AlertCategory.LOAD,
  },
  'Under Load (Apparent Power)': {
    id: 'underload_apparent',
    name: 'Under Load - Apparent Power',
    description: 'System is operating below expected apparent power levels',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-warning-alt)',
    category: AlertCategory.LOAD,
  },

  // Voltage Issues - Medium
  'High Voltage': {
    id: 'high_voltage',
    name: 'High Voltage',
    description: 'System voltage exceeds safe operating limits',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-secondary)',
    category: AlertCategory.VOLTAGE,
  },
  'Low Voltage': {
    id: 'low_voltage',
    name: 'Low Voltage',
    description: 'System voltage is below minimum operating limits',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-secondary)',
    category: AlertCategory.VOLTAGE,
  },
  'Voltage Imbalance': {
    id: 'voltage_imbalance',
    name: 'Voltage Imbalance',
    description: 'Uneven voltage distribution across phases',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-secondary)',
    category: AlertCategory.VOLTAGE,
  },

  // Current Issues - Medium
  'Low Current': {
    id: 'low_current',
    name: 'Low Current',
    description: 'Current levels are below expected values',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-secondary-positive)',
    category: AlertCategory.CURRENT,
  },
  'Current Missing': {
    id: 'current_missing',
    name: 'Current Missing',
    description: 'No current detected in the system',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-secondary-positive)',
    category: AlertCategory.CURRENT,
  },
  'High Neutral Current': {
    id: 'high_neutral_current',
    name: 'High Neutral Current',
    description: 'Neutral current exceeds normal operating levels',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-secondary-positive)',
    category: AlertCategory.CURRENT,
  },

  // Power Factor Issues - Medium
  'Low PF': {
    id: 'low_pf_general',
    name: 'Low Power Factor',
    description: 'Overall system power factor is below acceptable levels',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-primary-light)',
    category: AlertCategory.POWER_FACTOR,
  },
  'Low PF - R Phase': {
    id: 'low_pf_r',
    name: 'Low Power Factor - R Phase',
    description: 'R phase power factor is below acceptable levels',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-primary-light)',
    category: AlertCategory.POWER_FACTOR,
  },
  'Low PF - Y Phase': {
    id: 'low_pf_y',
    name: 'Low Power Factor - Y Phase',
    description: 'Y phase power factor is below acceptable levels',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-primary-light)',
    category: AlertCategory.POWER_FACTOR,
  },
  'Low PF - B Phase': {
    id: 'low_pf_b',
    name: 'Low Power Factor - B Phase',
    description: 'B phase power factor is below acceptable levels',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-primary-light)',
    category: AlertCategory.POWER_FACTOR,
  },

  // Power Reversal Issues - High
  'Power Reversal': {
    id: 'power_reversal_general',
    name: 'Power Reversal',
    description: 'Power flow direction is reversed',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-primary-dark-light)',
    category: AlertCategory.POWER_REVERSAL,
  },
  'Power reversed - R phase': {
    id: 'power_reversal_r',
    name: 'Power Reversal - R Phase',
    description: 'R phase power flow direction is reversed',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-primary-dark-light)',
    category: AlertCategory.POWER_REVERSAL,
  },
  'Power reversed - Y phase': {
    id: 'power_reversal_y',
    name: 'Power Reversal - Y Phase',
    description: 'Y phase power flow direction is reversed',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-primary-dark-light)',
    category: AlertCategory.POWER_REVERSAL,
  },
  'Power reversed - B phase': {
    id: 'power_reversal_b',
    name: 'Power Reversal - B Phase',
    description: 'B phase power flow direction is reversed',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-primary-dark-light)',
    category: AlertCategory.POWER_REVERSAL,
  },
  'Meter Power Fail': {
    id: 'meter_power_fail',
    name: 'Meter Power Failure',
    description: 'Meter has lost power supply',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-primary-dark-light)',
    category: AlertCategory.POWER_REVERSAL,
  },

  // Tamper Issues - High
  'Magnet Tamper': {
    id: 'magnet_tamper',
    name: 'Magnet Tamper',
    description: 'Magnetic tampering detected on the meter',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-primary-deep)',
    category: AlertCategory.TAMPER,
  },
  'High second harmonics': {
    id: 'high_second_harmonics',
    name: 'High Second Harmonics',
    description: 'Excessive second harmonic distortion detected',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-primary-deep)',
    category: AlertCategory.TAMPER,
  },
  'High total harmonics distortion current': {
    id: 'high_thd_current',
    name: 'High THD Current',
    description: 'Total harmonic distortion in current exceeds limits',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-primary-deep)',
    category: AlertCategory.TAMPER,
  },
  'Neutral Disturbance': {
    id: 'neutral_disturbance',
    name: 'Neutral Disturbance',
    description: 'Disturbance detected in neutral conductor',
    severity: AlertSeverity.HIGH,
    color: 'var(--color-primary-deep)',
    category: AlertCategory.TAMPER,
  },

  // Security Issues - Medium
  'Meter Cover Open': {
    id: 'meter_cover_open',
    name: 'Meter Cover Open',
    description: 'Meter protective cover has been opened',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-primary-transparent)',
    category: AlertCategory.SECURITY,
  },
  'RTC Change': {
    id: 'rtc_change',
    name: 'Real-Time Clock Change',
    description: 'System real-time clock has been modified',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-primary-transparent)',
    category: AlertCategory.SECURITY,
  },
  'Energy Corruption': {
    id: 'energy_corruption',
    name: 'Energy Data Corruption',
    description: 'Energy measurement data corruption detected',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-primary-transparent)',
    category: AlertCategory.SECURITY,
  },
  'Plug in Communication module removal': {
    id: 'communication_module_removal',
    name: 'Communication Module Removal',
    description: 'Communication module has been removed from the meter',
    severity: AlertSeverity.MEDIUM,
    color: 'var(--color-primary-transparent)',
    category: AlertCategory.SECURITY,
  },

  // Manufacturer Specific - Low
  '603 (Man. Spec.)': {
    id: 'manufacturer_603',
    name: 'Manufacturer Specific 603',
    description: 'Manufacturer specific alert code 603',
    severity: AlertSeverity.LOW,
    color: 'var(--color-neutral-lightest)',
    category: AlertCategory.MANUFACTURER,
  },
  '604 (Man. Spec.)': {
    id: 'manufacturer_604',
    name: 'Manufacturer Specific 604',
    description: 'Manufacturer specific alert code 604',
    severity: AlertSeverity.LOW,
    color: 'var(--color-neutral-lightest)',
    category: AlertCategory.MANUFACTURER,
  },
};

export const getAlertType = (tamperDescription: string): AlertType | null => {
  return tamperAlertMapping[tamperDescription] || null;
};

export const getAlertsByCategory = (category: AlertCategoryType): AlertType[] => {
  return Object.values(tamperAlertMapping).filter(alert => alert.category === category);
};

export const getAlertsBySeverity = (severity: AlertSeverityType): AlertType[] => {
  return Object.values(tamperAlertMapping).filter(alert => alert.severity === severity);
};

export const getAlertColor = (tamperDescription: string): string => {
  const alertType = getAlertType(tamperDescription);
  return alertType?.color || 'var(--color-neutral-light)';
};

export const getAlertSeverity = (tamperDescription: string): AlertSeverityType | null => {
  const alertType = getAlertType(tamperDescription);
  return alertType?.severity || null;
};

export const tamperColors = Object.fromEntries(
  Object.entries(tamperAlertMapping).map(([key, value]) => [key, value.color])
);
