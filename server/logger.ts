import winston from 'winston';
import path from 'path';

const isDevelopment = process.env.NODE_ENV === 'development';
const logDir = 'logs';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  // Append the error and stack that AppLogger.error attaches as metadata.
  // Without this the console -- which on Render IS the log, since the file
  // transports write to an ephemeral disk nobody reads -- showed only the
  // message. That is how "Assessment topic seeding failed (non-critical):"
  // ran on every boot for weeks without anyone learning the cause.
  winston.format.printf((info) => {
    let line = `${info.timestamp} ${info.level}: ${info.message}`;
    if (info.error) line += ` ${info.error}`;
    if (info.stack) line += `\n${String(info.stack).replace(/^/gm, '    ')}`;
    return line;
  })
);

// Format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  levels,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Error log file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// Create HTTP logger middleware
export const httpLogger = winston.createLogger({
  level: 'http',
  levels,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize({ all: true }),
        winston.format.printf(
          (info) => `${info.timestamp} HTTP: ${info.message}`
        )
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'http.log'),
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// Structured logging helpers
export class AppLogger {
  static error(message: string, error?: Error, metadata?: any) {
    logger.error(message, {
      error: error?.message,
      stack: error?.stack,
      ...metadata,
    });
  }

  static warn(message: string, metadata?: any) {
    logger.warn(message, metadata);
  }

  static info(message: string, metadata?: any) {
    logger.info(message, metadata);
  }

  static debug(message: string, metadata?: any) {
    logger.debug(message, metadata);
  }

  static http(message: string, metadata?: any) {
    httpLogger.http(message, metadata);
  }

  // Log database operations
  static database(operation: string, table: string, metadata?: any) {
    logger.info(`Database ${operation}: ${table}`, {
      type: 'database',
      operation,
      table,
      ...metadata,
    });
  }

  // Log authentication events
  static auth(event: string, userId?: string, metadata?: any) {
    logger.info(`Auth ${event}`, {
      type: 'auth',
      event,
      userId,
      ...metadata,
    });
  }

  // Log API requests
  static api(method: string, path: string, statusCode: number, duration: number, metadata?: any) {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, `${method} ${path} ${statusCode} ${duration}ms`, {
      type: 'api',
      method,
      path,
      statusCode,
      duration,
      ...metadata,
    });
  }

  // Log performance metrics
  static performance(metric: string, value: number, unit: string, metadata?: any) {
    logger.info(`Performance: ${metric} = ${value}${unit}`, {
      type: 'performance',
      metric,
      value,
      unit,
      ...metadata,
    });
  }

  // Log security events
  static security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: any) {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    logger.log(level, `Security Event: ${event} (${severity})`, {
      type: 'security',
      event,
      severity,
      ...metadata,
    });
  }
}

export default logger;