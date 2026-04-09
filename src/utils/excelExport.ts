import * as XLSX from 'xlsx';

export interface ExcelExportOptions {
  fileName?: string;
  sheetName?: string;
  autoWidth?: boolean;
}

export const exportToExcel = (data: any[], options: ExcelExportOptions = {}): void => {
  const { fileName = 'export', sheetName = 'Sheet1', autoWidth = true } = options;

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-size columns if requested
  if (autoWidth) {
    const columnWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, 15), // Minimum width of 15 characters
    }));
    worksheet['!cols'] = columnWidths;
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  // Create blob and download
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Helper function to format table data for Excel export
export const formatTableDataForExport = (
  data: any[],
  columns: { key: string; label: string }[]
): any[] => {
  return data.map((row, _index) => {
    const formattedRow: any = {};
    columns.forEach(column => {
      // Use the label as the column header and the key to get the value
      formattedRow[column.label] = row[column.key];
    });
    return formattedRow;
  });
};

// Specific export functions for different data types
export const exportMetersData = (data: any[]): void => {
  const columns = [
    { key: 'slNo', label: 'Sl No' },
    { key: 'meterSlNo', label: 'Meter SI No' },
    { key: 'modemSlNo', label: 'Modem SI No' },
    { key: 'meterType', label: 'Meter Type' },
    { key: 'meterMake', label: 'Meter Make' },
    { key: 'consumerName', label: 'Consumer Name' },
    { key: 'location', label: 'Location' },
    { key: 'installationDate', label: 'Installation Date' },
  ];

  const formattedData = formatTableDataForExport(data, columns);
  exportToExcel(formattedData, { fileName: 'meters-data', sheetName: 'Meters' });
};

export const exportDTRData = (data: any[]): void => {
  const columns = [
    { key: 'dtrId', label: 'DTR ID' },
    { key: 'dtrName', label: 'DTR Name' },
    { key: 'feedersCount', label: 'Feeders Count' },
    { key: 'streetName', label: 'Street Name' },
    { key: 'city', label: 'City' },
    { key: 'commStatus', label: 'Comm-Status' },
  ];

  const formattedData = formatTableDataForExport(data, columns);
  exportToExcel(formattedData, { fileName: 'dtr-data', sheetName: 'DTRs' });
};

export const exportTicketsData = (data: any[]): void => {
  const columns = [
    { key: 'ticketNumber', label: 'Ticket Number' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'subject', label: 'Subject' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'assignedTo', label: 'Assigned To' },
    { key: 'createdAt', label: 'Created At' },
    { key: 'category', label: 'Category' },
  ];

  const formattedData = formatTableDataForExport(data, columns);
  exportToExcel(formattedData, { fileName: 'tickets-data', sheetName: 'Tickets' });
};

// Export chart data to Excel
export const exportChartData = (
  xAxisData: string[],
  seriesData: { name: string; data: number[] }[],
  fileName: string = 'chart-data'
): void => {
  const chartData = xAxisData.map((date, index) => {
    const row: any = { Date: date };
    seriesData.forEach(series => {
      row[series.name] = series.data[index];
    });
    return row;
  });

  exportToExcel(chartData, { fileName, sheetName: 'Chart Data' });
};

// Export meter status data to Excel
export const exportMeterStatusData = (
    meterStatusData: { name: string; value: number; meterNumbers?: string[] }[],
    fileName: string = 'meter-status-data'
): void => {
    console.log("🔍 [Export] Input data:", meterStatusData);
    console.log("🔍 [Export] Data type:", typeof meterStatusData);
    console.log("🔍 [Export] Is array:", Array.isArray(meterStatusData));
    
    // Validate input data
    if (!meterStatusData || !Array.isArray(meterStatusData)) {
        console.error("❌ [Export] Invalid meter status data:", meterStatusData);
        return;
    }
    
    const exportData: any[] = [];
    
    meterStatusData.forEach((status, statusIndex) => {
        console.log(`🔍 [Export] Processing status ${statusIndex}:`, status);
        
        // Ensure status has required properties
        if (!status || typeof status.name !== 'string' || typeof status.value !== 'number') {
            console.warn(` [Export] Skipping invalid status at index ${statusIndex}:`, status);
            return;
        }
        
        if (status.meterNumbers && Array.isArray(status.meterNumbers) && status.meterNumbers.length > 0) {
            // If meter numbers are available, create a row for each meter
            status.meterNumbers.forEach((meterNumber, index) => {
                exportData.push({
                    'Status': status.name,
                    'Meter Number': meterNumber || 'N/A',
                    'Count': index === 0 ? status.value : '', // Only show count in first row
                });
            });
        } else {
            // If no meter numbers, just show the status and count
            exportData.push({
                'Status': status.name,
                'Meter Number': 'N/A',
                'Count': status.value,
            });
        }
    });
    
    console.log("🔍 [Export] Final export data:", exportData);
    
    if (exportData.length === 0) {
        console.warn(" [Export] No data to export");
        return;
    }
    
    exportToExcel(exportData, { fileName, sheetName: 'Meter Status' });
};