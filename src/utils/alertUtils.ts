import type { AlertType, AlertCategoryType, AlertSeverityType } from '../types/alertTypes';
import {
  AlertCategory,
  AlertSeverity,
  tamperAlertMapping,
  getAlertType,
  getAlertsByCategory,
  getAlertsBySeverity,
  getAlertColor,
  getAlertSeverity,
} from '../types/alertTypes';

// Alert Statistics Interface
export interface AlertStats {
  total: number;
  byCategory: Record<AlertCategoryType, number>;
  bySeverity: Record<AlertSeverityType, number>;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

// Alert Filter Options
export interface AlertFilter {
  category?: AlertCategoryType;
  severity?: AlertSeverityType;
  searchTerm?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Process alert data and get statistics
export const processAlertStats = (alerts: string[]): AlertStats => {
  const stats: AlertStats = {
    total: alerts.length,
    byCategory: {} as Record<AlertCategoryType, number>,
    bySeverity: {} as Record<AlertSeverityType, number>,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
  };

  // Initialize category counts
  Object.values(AlertCategory).forEach(category => {
    stats.byCategory[category] = 0;
  });

  // Initialize severity counts
  Object.values(AlertSeverity).forEach(severity => {
    stats.bySeverity[severity] = 0;
  });

  // Count alerts by category and severity
  alerts.forEach(tamperDescription => {
    const alertType = getAlertType(tamperDescription);
    if (alertType) {
      stats.byCategory[alertType.category]++;
      stats.bySeverity[alertType.severity]++;

      // Count by severity for quick access
      switch (alertType.severity) {
        case AlertSeverity.CRITICAL:
          stats.criticalCount++;
          break;
        case AlertSeverity.HIGH:
          stats.highCount++;
          break;
        case AlertSeverity.MEDIUM:
          stats.mediumCount++;
          break;
        case AlertSeverity.LOW:
          stats.lowCount++;
          break;
      }
    }
  });

  return stats;
};

// Filter alerts based on criteria
export const filterAlerts = (alerts: string[], filter: AlertFilter): string[] => {
  return alerts.filter(tamperDescription => {
    const alertType = getAlertType(tamperDescription);
    if (!alertType) return false;

    // Filter by category
    if (filter.category && alertType.category !== filter.category) {
      return false;
    }

    // Filter by severity
    if (filter.severity && alertType.severity !== filter.severity) {
      return false;
    }

    // Filter by search term
    if (filter.searchTerm) {
      const searchLower = filter.searchTerm.toLowerCase();
      const matchesName = alertType.name.toLowerCase().includes(searchLower);
      const matchesDescription = alertType.description.toLowerCase().includes(searchLower);
      const matchesCategory = alertType.category.toLowerCase().includes(searchLower);

      if (!matchesName && !matchesDescription && !matchesCategory) {
        return false;
      }
    }

    return true;
  });
};

// Get priority alerts (Critical and High severity)
export const getPriorityAlerts = (alerts: string[]): string[] => {
  return alerts.filter(tamperDescription => {
    const severity = getAlertSeverity(tamperDescription);
    return severity === AlertSeverity.CRITICAL || severity === AlertSeverity.HIGH;
  });
};

// Get alerts that require immediate attention
export const getUrgentAlerts = (alerts: string[]): string[] => {
  return alerts.filter(tamperDescription => {
    const alertType = getAlertType(tamperDescription);
    if (!alertType) return false;

    // Urgent categories
    const urgentCategories: AlertCategoryType[] = [
      AlertCategory.PHASE_MISSING,
      AlertCategory.CT_ISSUES,
      AlertCategory.TAMPER,
      AlertCategory.POWER_REVERSAL,
    ];

    return (
      urgentCategories.includes(alertType.category) || alertType.severity === AlertSeverity.CRITICAL
    );
  });
};

// Format alert for display
export const formatAlertForDisplay = (
  tamperDescription: string
): {
  name: string;
  description: string;
  severity: AlertSeverityType | null;
  color: string;
  category: string;
  icon?: string;
} => {
  const alertType = getAlertType(tamperDescription);

  if (!alertType) {
    return {
      name: tamperDescription,
      description: 'Unknown alert type',
      severity: null,
      color: 'var(--color-neutral-light)',
      category: 'Unknown',
    };
  }

  return {
    name: alertType.name,
    description: alertType.description,
    severity: alertType.severity,
    color: alertType.color,
    category: alertType.category,
    icon: getAlertIcon(alertType.category),
  };
};

// Get appropriate icon for alert
export const getAlertIcon = (category: AlertCategoryType): string => {
  const iconMap: Record<AlertCategoryType, string> = {
    [AlertCategory.PHASE_MISSING]: '',
    [AlertCategory.CT_ISSUES]: '🔌',
    [AlertCategory.LOAD]: '⚡',
    [AlertCategory.VOLTAGE]: '🔋',
    [AlertCategory.CURRENT]: '🔗',
    [AlertCategory.POWER_FACTOR]: '📊',
    [AlertCategory.POWER_REVERSAL]: '🔄',
    [AlertCategory.TAMPER]: '🔒',
    [AlertCategory.SECURITY]: '🛡️',
    [AlertCategory.MANUFACTURER]: '🏭',
  };

  return iconMap[category] || '';
};

// Get severity badge color
export const getSeverityBadgeColor = (severity: AlertSeverityType): string => {
  const badgeColors: Record<AlertSeverityType, string> = {
    [AlertSeverity.CRITICAL]: 'bg-red-100 text-red-800 border-red-200',
    [AlertSeverity.HIGH]: 'bg-orange-100 text-orange-800 border-orange-200',
    [AlertSeverity.MEDIUM]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    [AlertSeverity.LOW]: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return badgeColors[severity];
};

// Get category badge color
export const getCategoryBadgeColor = (category: AlertCategoryType): string => {
  const badgeColors: Record<AlertCategoryType, string> = {
    [AlertCategory.PHASE_MISSING]: 'bg-red-50 text-red-700 border-red-200',
    [AlertCategory.CT_ISSUES]: 'bg-orange-50 text-orange-700 border-orange-200',
    [AlertCategory.LOAD]: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    [AlertCategory.VOLTAGE]: 'bg-blue-50 text-blue-700 border-blue-200',
    [AlertCategory.CURRENT]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    [AlertCategory.POWER_FACTOR]: 'bg-purple-50 text-purple-700 border-purple-200',
    [AlertCategory.POWER_REVERSAL]: 'bg-pink-50 text-pink-700 border-pink-200',
    [AlertCategory.TAMPER]: 'bg-red-50 text-red-700 border-red-200',
    [AlertCategory.SECURITY]: 'bg-gray-50 text-gray-700 border-gray-200',
    [AlertCategory.MANUFACTURER]: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return badgeColors[category];
};

// Sort alerts by priority
export const sortAlertsByPriority = (alerts: string[]): string[] => {
  const severityOrder: Record<AlertSeverityType, number> = {
    [AlertSeverity.CRITICAL]: 0,
    [AlertSeverity.HIGH]: 1,
    [AlertSeverity.MEDIUM]: 2,
    [AlertSeverity.LOW]: 3,
  };

  return alerts.sort((a, b) => {
    const severityA = getAlertSeverity(a);
    const severityB = getAlertSeverity(b);

    if (!severityA && !severityB) return 0;
    if (!severityA) return 1;
    if (!severityB) return -1;

    return severityOrder[severityA] - severityOrder[severityB];
  });
};

// Validate alert description
export const isValidAlert = (tamperDescription: string): boolean => {
  return tamperDescription in tamperAlertMapping;
};

// Get all available alert types
export const getAllAlertTypes = (): AlertType[] => {
  return Object.values(tamperAlertMapping);
};

// Export commonly used functions
export { getAlertType, getAlertsByCategory, getAlertsBySeverity, getAlertColor, getAlertSeverity };
