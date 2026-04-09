/**
 * Frontend Logger Utility
 * Sends logs to backend API instead of console
 */

import BACKEND_URL from '../config';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  url?: string;
  userAgent?: string;
  stack?: string;
  context?: Record<string, any>;
  component?: string;
  userId?: string;
}

class FrontendLogger {
  private queue: LogEntry[] = [];
  private isFlushing = false;
  private flushInterval: number = 5000; // Flush every 5 seconds
  private maxQueueSize: number = 100;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startFlushTimer();
    
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      context: this.sanitizeContext(context),
    };

    if (error) {
      entry.stack = error.stack;
      entry.message = error.message || message;
    }

    // Try to get user ID from storage
    try {
      const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        entry.userId = user.id || user.userId;
      }
    } catch (e) {
      // Ignore errors
    }

    return entry;
  }

  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return undefined;

    const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken', 'apiKey', 'secret', 'authorization', 'cookie', 'creditCard', 'ssn', 'pin'];
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        try {
          sanitized[key] = JSON.parse(JSON.stringify(value));
        } catch {
          sanitized[key] = '[Unable to serialize]';
        }
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private async sendLogs(entries: LogEntry[]): Promise<void> {
    if (entries.length === 0) return;

    try {
      // Build URL properly - BACKEND_URL may already include /api
      const baseUrl = BACKEND_URL?.replace(/\/+$/, '') || '';
      const logPath = baseUrl.includes('/api') ? '/frontend-logs' : '/api/frontend-logs';
      const url = `${baseUrl}${logPath}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ logs: entries }),
      });

      if (!response.ok) {
        // Silently fail to prevent infinite loops
      }
    } catch (error) {
      // Silently fail
    }
  }

  private async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) return;

    this.isFlushing = true;
    const entries = [...this.queue];
    this.queue = [];

    try {
      await this.sendLogs(entries);
    } finally {
      this.isFlushing = false;
    }
  }

  private addToQueue(entry: LogEntry): void {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }
    this.queue.push(entry);

    // Flush immediately for errors and warnings
    if (entry.level === 'error' || entry.level === 'warn') {
      this.flush();
    }
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    const entry = this.createLogEntry('error', message, context, error);
    this.addToQueue(entry);
  }

  warn(message: string, context?: Record<string, any>): void {
    const entry = this.createLogEntry('warn', message, context);
    this.addToQueue(entry);
  }

  info(message: string, context?: Record<string, any>): void {
    const entry = this.createLogEntry('info', message, context);
    this.addToQueue(entry);
  }

  debug(message: string, context?: Record<string, any>): void {
    const entry = this.createLogEntry('debug', message, context);
    this.addToQueue(entry);
  }
}

// Create singleton instance
const logger = new FrontendLogger();

// Override ALL console methods - NO console output
if (typeof window !== 'undefined') {
  // Override console.error
  console.error = (...args: any[]) => {
    const message = args.map(arg => {
      if (arg instanceof Error) return arg.message;
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const error = args.find(arg => arg instanceof Error) as Error | undefined;
    const context = args.find(arg => typeof arg === 'object' && !(arg instanceof Error)) as Record<string, any> | undefined;

    logger.error(message, context, error);
  };

  // Override console.warn
  console.warn = (...args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const context = args.find(arg => typeof arg === 'object') as Record<string, any> | undefined;
    logger.warn(message, context);
  };

  // Override console.log
  console.log = (...args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const context = args.find(arg => typeof arg === 'object') as Record<string, any> | undefined;
    logger.info(message, context);
  };

  // Override console.info
  console.info = (...args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const context = args.find(arg => typeof arg === 'object') as Record<string, any> | undefined;
    logger.info(message, context);
  };

  // Override console.debug
  console.debug = (...args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const context = args.find(arg => typeof arg === 'object') as Record<string, any> | undefined;
    logger.debug(message, context);
  };

  // Override console.trace
  console.trace = (...args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const context = args.find(arg => typeof arg === 'object') as Record<string, any> | undefined;
    logger.debug(message, { ...context, trace: true });
  };
}

export default logger;

