import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Logger, LogLevel } from '../definition.ts';
import { OFF_LOGGER } from '../off-logger.ts';
import { withPrefix } from '../prefixed-logger.ts';

type RequestHandler = (req: IncomingMessage & { path?: string }, res: ServerResponse, next: () => void) => void;

export type RequestLoggerOptions = {
  /**
   * The prefix to apply to the logger.
   *
   * @default 'http'
   */
  readonly prefix?: string;

  /**
   * The level to use for when a request is received by the server.
   *
   * @default 'info'
   */
  readonly receivedLevel?: LogLevel;

  /**
   * The level to use for the close event, which is emitted when the underlying connection is closed, happening before
   * 'finish'.
   *
   * @default 'debug'
   */
  readonly closeLevel?: LogLevel;

  /**
   * The level to use for the finish event, which is emitted when the response has been sent to the client.
   *
   * @default 'info'
   */
  readonly finishLevel?: LogLevel;

  /**
   * The level to use for the end event, which may be emitted when the entire response has been sent to the client,
   * happening after 'finish'.
   *
   * @default 'debug'
   */
  readonly endLevel?: LogLevel;

  /**
   * The level to use for the error event, which may occur at any time during the event lifecycle and is emitted when
   * there's an error writing the response.
   *
   * @default 'error'
   */
  readonly errorLevel?: LogLevel;
};

/**
 * Creates a lightweight HTTP request logger middleware for Node runtimes.
 *
 * The handler uses Node's native `IncomingMessage` and `ServerResponse`, making it a drop-in logger for Express and
 * similar frameworks without requiring them as dependencies. Each request is tracked with a sequential identifier and
 * logs lifecycle events (`received`, `close`, `finish`, `end`, and `error`) along with execution time.
 *
 * Default log levels favour surfacing `received`/`finish` at `info` while keeping `close`/`end` at `debug` to reduce
 * noise when connections terminate normally. Adjust them through {@link RequestLoggerOptions} to match your logging
 * policy.
 *
 * @example Express integration
 *
 * ```ts
 * import express from 'express';
 * import { createConsoleLogLogger, requestLogger } from 'emitnlog/logger';
 *
 * const app = express();
 * const logger = createConsoleLogLogger('debug');
 * app.use(requestLogger(logger));
 * ```
 *
 * @example Custom prefix and levels
 *
 * ```ts
 * app.use(
 *   requestLogger(logger, { prefix: 'api', receivedLevel: 'debug', finishLevel: 'debug', errorLevel: 'fatal' }),
 * );
 * ```
 *
 * @param logger Logger instance used to emit request lifecycle messages.
 * @param options Optional configuration for the logger prefix and per-event log levels.
 * @returns A Node-style middleware (`(req, res, next) => void`) that can be registered with Express or compatible
 *   routers.
 */
export const requestLogger = (logger: Logger, options?: RequestLoggerOptions): RequestHandler => {
  if (logger === OFF_LOGGER) {
    return NO_OP_REQUEST_HANDLER;
  }

  const config = {
    ...{
      prefix: 'http',
      receivedLevel: 'info',
      closeLevel: 'debug',
      finishLevel: 'info',
      endLevel: 'debug',
      errorLevel: 'error',
    },
    ...options,
  } as const satisfies RequestLoggerOptions;

  let requestCount = 0;

  if (config.prefix) {
    logger = withPrefix(logger, config.prefix);
  }

  return (req, res, next): void => {
    const requestIndex = requestCount++;
    let label = `${requestIndex}`;

    if (req.method) {
      label += `|${req.method}`;
    }

    if (req.path) {
      label += `:${req.path}`;
    } else if (req.url) {
      label += `:${req.url}`;
    }

    logger.log(config.receivedLevel, () => `received ${label}`);
    const start = performance.now();

    res.on('close', () => {
      const duration = performance.now() - start;
      logger.log(config.closeLevel, () => `closed ${label} after ${duration}ms`);
    });

    res.on('finish', () => {
      const duration = performance.now() - start;
      logger.log(config.finishLevel, () => `finished ${label} in ${duration}ms`);
    });

    res.on('end', () => {
      const duration = performance.now() - start;
      logger.log(config.endLevel, () => `ended ${label} in ${duration}ms`);
    });

    // May occur at any time during the event lifecycle and is emitted when there's an error writing the response.
    res.on('error', (error) => {
      const duration = performance.now() - start;
      logger.args(error).log(config.errorLevel, () => `errored on ${label} after ${duration}ms (${error})`);
    });

    next();
  };
};

const NO_OP_REQUEST_HANDLER: RequestHandler = Object.freeze((_req, _res, next): void => {
  next();
});
