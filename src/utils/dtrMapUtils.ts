import { getAlertColor } from '../types/alertTypes';

// DTR data interface for map integration
export interface DTRMapData {
  dtrId: string;
  position: {
    lat: number;
    lng: number;
  };
  title?: string;
  latestAlert?: string;
  status?: string;
  additionalInfo?: Record<string, any>;
}

// Convert DTR data to GoogleMap marker format
export const dtrToMapMarker = (dtr: DTRMapData) => {
  return {
    position: dtr.position,
    title: dtr.title || dtr.dtrId,
    dtrId: dtr.dtrId,
    latestAlert: dtr.latestAlert,
    infoContent: `
      <div style="padding: 8px; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">${dtr.dtrId.toUpperCase()}</h3>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Status:</strong> ${dtr.status || 'Unknown'}</p>
        ${
          dtr.latestAlert
            ? `
          <p style="margin: 4px 0; font-size: 14px;"><strong>Latest Alert:</strong> ${dtr.latestAlert}</p>
          <div style="margin: 8px 0; padding: 4px 8px; background-color: ${getAlertColor(dtr.latestAlert)}; color: white; border-radius: 4px; display: inline-block; font-size: 12px;">
            Alert Active
          </div>
        `
            : `
          <div style="margin: 8px 0; padding: 4px 8px; background-color: #10B981; color: white; border-radius: 4px; display: inline-block; font-size: 12px;">
            No Alerts
          </div>
        `
        }
        ${
          dtr.additionalInfo
            ? `
          <div style="margin-top: 8px; font-size: 12px; color: #666;">
            ${Object.entries(dtr.additionalInfo)
              .map(
                ([key, value]) => `<p style="margin: 2px 0;"><strong>${key}:</strong> ${value}</p>`
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>
    `,
  };
};

// Convert array of DTR data to map markers
export const dtrsToMapMarkers = (dtrs: DTRMapData[]) => {
  return dtrs.map(dtrToMapMarker);
};

// Get marker color for a specific alert (helper function)
export const getMarkerColor = (alertType?: string): string => {
  return alertType ? getAlertColor(alertType) : '#4285F4'; // Default blue
};

// Create sample DTR data for testing
export const createSampleDTRData = (): DTRMapData[] => {
  return [
    {
      dtrId: 'dtr-001',
      position: { lat: 28.6139, lng: 77.209 },
      title: 'DTR-001 - Main Station',
      latestAlert: 'R_PH Missing',
      status: 'Active',
      additionalInfo: {
        Load: '85%',
        Voltage: '415V',
        'Last Update': '2 min ago',
      },
    },
    {
      dtrId: 'dtr-002',
      position: { lat: 28.6239, lng: 77.219 },
      title: 'DTR-002 - Substation A',
      latestAlert: 'CT Short',
      status: 'Active',
      additionalInfo: {
        Load: '92%',
        Voltage: '412V',
        'Last Update': '5 min ago',
      },
    },
    {
      dtrId: 'dtr-003',
      position: { lat: 28.6339, lng: 77.229 },
      title: 'DTR-003 - Industrial Zone',
      latestAlert: 'Low PF',
      status: 'Active',
      additionalInfo: {
        Load: '78%',
        Voltage: '418V',
        'Last Update': '1 min ago',
      },
    },
    {
      dtrId: 'dtr-004',
      position: { lat: 28.6439, lng: 77.239 },
      title: 'DTR-004 - Residential Area',
      status: 'Active',
      // No latestAlert - will show as normal (blue)
      additionalInfo: {
        Load: '45%',
        Voltage: '420V',
        'Last Update': '30 sec ago',
      },
    },
  ];
};
