import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { ConfigService } from '@nestjs/config';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private context?: string;

  constructor(private configService: ConfigService) {
    this.initializeLogger();
  }

  private initializeLogger() {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const logLevel = this.configService.get<string>('LOG_LEVEL', nodeEnv === 'production' ? 'info' : 'debug');

    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
    );

    // Console format (pretty print for development)
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, context, trace, ...meta }) => {
        const contextStr = context ? `[${context}]` : '';
        const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
        const traceStr = trace ? `\n${trace}` : '';
        return `${timestamp} ${level} ${contextStr} ${message}${metaStr}${traceStr}`;
      }),
    );

    // Create transports
    const transports: winston.transport[] = [];

    // Console transport (always enabled)
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
      }),
    );

    // File transports (only in production)
    if (nodeEnv === 'production') {
      // Error logs (daily rotation)
      transports.push(
        new DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          format: logFormat,
          maxSize: '20m',
          maxFiles: '14d',
          zippedArchive: true,
        }),
      );

      // Combined logs (daily rotation)
      transports.push(
        new DailyRotateFile({
          filename: 'logs/combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          format: logFormat,
          maxSize: '20m',
          maxFiles: '14d',
          zippedArchive: true,
        }),
      );

      // Info logs (daily rotation)
      transports.push(
        new DailyRotateFile({
          filename: 'logs/info-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'info',
          format: logFormat,
          maxSize: '20m',
          maxFiles: '7d',
          zippedArchive: true,
        }),
      );
    }

    // Create logger instance
    this.logger = winston.createLogger({
      level: logLevel,
      format: logFormat,
      transports,
      exitOnError: false,
    });

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(
      new winston.transports.File({ filename: 'logs/exceptions.log' }),
    );

    this.logger.rejections.handle(
      new winston.transports.File({ filename: 'logs/rejections.log' }),
    );
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, context?: string) {
    const logContext = context || this.context;
    this.logger.info(message, { context: logContext });
  }

  error(message: any, trace?: string, context?: string) {
    const logContext = context || this.context;
    this.logger.error(message, { context: logContext, trace });
  }

  warn(message: any, context?: string) {
    const logContext = context || this.context;
    this.logger.warn(message, { context: logContext });
  }

  debug(message: any, context?: string) {
    const logContext = context || this.context;
    this.logger.debug(message, { context: logContext });
  }

  verbose(message: any, context?: string) {
    const logContext = context || this.context;
    this.logger.verbose(message, { context: logContext });
  }

  // Additional helper methods

  /**
   * Log HTTP requests
   */
  http(message: string, meta?: any) {
    this.logger.http(message, { context: this.context, ...meta });
  }

  /**
   * Log with custom metadata
   */
  logWithMeta(level: string, message: string, meta: any, context?: string) {
    const logContext = context || this.context;
    this.logger.log(level, message, { context: logContext, ...meta });
  }

  /**
   * Log database queries (debug level)
   */
  query(query: string, parameters?: any[], duration?: number) {
    this.debug(`Query: ${query}`, this.context);
    if (parameters) {
      this.debug(`Parameters: ${JSON.stringify(parameters)}`, this.context);
    }
    if (duration) {
      this.debug(`Duration: ${duration}ms`, this.context);
    }
  }

  /**
   * Log API calls
   */
  api(method: string, url: string, statusCode: number, duration: number) {
    this.http(`${method} ${url} ${statusCode} - ${duration}ms`);
  }

  /**
   * Log authentication events
   */
  auth(event: string, userId?: string, meta?: any) {
    this.log(`Auth: ${event}`, 'AuthService');
    if (userId) {
      this.logWithMeta('info', `User: ${userId}`, meta || {}, 'AuthService');
    }
  }

  /**
   * Log payment events
   */
  payment(event: string, meta: any) {
    this.logWithMeta('info', `Payment: ${event}`, meta, 'PaymentService');
  }

  /**
   * Log cache operations
   */
  cache(operation: string, key: string, hit: boolean) {
    const message = `Cache ${operation}: ${key} - ${hit ? 'HIT' : 'MISS'}`;
    this.debug(message, 'CacheService');
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, meta?: any) {
    const message = `Performance: ${operation} took ${duration}ms`;
    if (duration > 1000) {
      // Warn if operation takes more than 1 second
      this.warn(message, this.context);
    } else {
      this.debug(message, this.context);
    }
    if (meta) {
      this.debug(JSON.stringify(meta), this.context);
    }
  }
}
