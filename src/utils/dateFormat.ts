export const formatDateForTooltip = (dateStr: string): string => {
  const currentYear = new Date().getFullYear(); // Always use current year (2025)

  try {
    let date: Date;

    // Check if dateStr is in "MMM DD" format (e.g., "Aug 23")
    const monthDayMatch = dateStr.match(/^([A-Za-z]{3})\s(\d{1,2})$/);
    if (monthDayMatch) {
      const [, month, day] = monthDayMatch;
      date = new Date(`${month} ${day}, ${currentYear}`);
    } else {
      // Try to parse the date string directly
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        date = new Date(currentYear, parsedDate.getMonth(), parsedDate.getDate());
      } else {
        // Try to parse DD-MMM format (e.g., "24-Jul", "27-Sep")
        const parts = dateStr.split('-');
        if (parts.length >= 2) {
          const [day, month] = parts;
          const monthIndex = new Date(`${month} 1, ${currentYear}`).getMonth();
          if (!isNaN(monthIndex)) {
            date = new Date(currentYear, monthIndex, parseInt(day));
          } else {
            return `${dateStr}, ${currentYear}`;
          }
        } else {
          return `${dateStr}, ${currentYear}`;
        }
      }
    }

    // If date is still invalid, return original with current year
    if (isNaN(date.getTime())) {
      return `${dateStr}, ${currentYear}`;
    }

    // Format as "Aug 23, 2025"
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate().toString().padStart(2, '0');

    return `${month} ${day}, ${currentYear}`;
  } catch (error) {
    console.warn('Failed to parse date:', dateStr, error);
    return `${dateStr}, ${currentYear}`;
  }
};

export const formatDateWithOrdinal = (dateStr: string): string => {
  try {
    // Try to parse the date string
    let date = new Date(dateStr);

    // If invalid date, try to parse DD-MMM format
    if (isNaN(date.getTime())) {
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        const [day, month] = parts;
        const currentYear = new Date().getFullYear();
        const monthIndex = new Date(`${month} 1, ${currentYear}`).getMonth();
        date = new Date(currentYear, monthIndex, parseInt(day));
      }
    }

    // If still invalid, return original string
    if (isNaN(date.getTime())) {
      return dateStr;
    }

    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();

    const getOrdinalSuffix = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return s[(v - 20) % 10] || s[v] || s[0];
    };

    return `${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
  } catch (error) {
    console.warn('Failed to parse date:', dateStr, error);
    return dateStr;
  }
};

// Universal date formatting function for all components
export const formatTableDate = (dateInput: string | number | Date): string => {
  try {
    // Add null/undefined check to prevent the error
    if (dateInput == null) {
      return 'N/A';
    }

    let date: Date;

    if (typeof dateInput === 'string') {
      // Handle different string formats
      // Remove ordinal suffixes (st, nd, rd, th) from day numbers
      // Matches patterns like "16th", "1st", "2nd", "3rd" followed by a space or end of number
      const ordinalPattern = /\b(\d+)(st|nd|rd|th)\b/gi;
      // Replace ordinal suffixes (st, nd, rd, th) with just the number
      // Example: "16th Aug 2025 08:24:28 PM" -> "16 Aug 2025 08:24:28 PM"
      const cleanedValue = dateInput.replace(ordinalPattern, '$1');

      date = new Date(cleanedValue);
    } else if (typeof dateInput === 'number') {
      // Handle timestamp
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }

    if (isNaN(date.getTime())) {
      return 'N/A';
    }

    // Format: "Oct 23, 2025 12:00 PM"
    const month = date.toLocaleDateString('en-US', {
      month: 'short',
    });
    const day = date.getDate();
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'N/A';
  }
};

// Alias for formatTableDate for backward compatibility
export const formatDateTime = formatTableDate;