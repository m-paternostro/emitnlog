import { afterEach, describe, expect, jest, test } from '@jest/globals';

import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { requestLogger } from '../../../src/logger/index-node.ts';
import { createMemoryLogger } from '../../jester.setup.ts';

type RequestLike = IncomingMessage & { path?: string };

const createRequest = (overrides: Partial<RequestLike> = {}): RequestLike =>
  Object.assign(new EventEmitter(), overrides) as RequestLike;

const createResponse = (): { readonly emitter: EventEmitter; readonly response: ServerResponse } => {
  const emitter = new EventEmitter();
  return { emitter, response: emitter as unknown as ServerResponse };
};

describe('emitnlog.logger.node.requestLogger', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('logs request lifecycle events with default configuration', () => {
    const logger = createMemoryLogger('debug');
    const middleware = requestLogger(logger);

    const req = createRequest({ method: 'GET', path: '/users' });
    const { emitter: resEmitter, response: res } = createResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    resEmitter.emit('finish');
    resEmitter.emit('end');
    resEmitter.emit('close');

    expect(logger.entries).toHaveLength(4);
    const [received, finish, end, close] = logger.entries;

    expect(received.level).toBe('info');
    expect(received.message).toBe('http: received 0|GET:/users');

    expect(finish.level).toBe('info');
    expect(finish.message).toMatch(/^http: finished 0\|GET:\/users in \d+(?:\.\d+)?ms$/);

    expect(end.level).toBe('debug');
    expect(end.message).toMatch(/^http: ended 0\|GET:\/users in \d+(?:\.\d+)?ms$/);

    expect(close.level).toBe('debug');
    expect(close.message).toMatch(/^http: closed 0\|GET:\/users after \d+(?:\.\d+)?ms$/);
  });

  describe('supports partial information on request', () => {
    const { response: res } = createResponse();
    const next = () => void 0;

    const validate = (req: RequestLike, receiveLogMessage: string) => {
      const logger = createMemoryLogger('debug');
      const middleware = requestLogger(logger);
      middleware(req, res, next);
      expect(logger.entries).toHaveLength(1);
      const [received] = logger.entries;
      expect(received.level).toBe('info');
      expect(received.message).toBe(receiveLogMessage);
    };

    test('when nothing is provided', () => {
      const req = createRequest({});
      validate(req, 'http: received 0');
    });

    test('when only the method is provided', () => {
      const req = createRequest({ method: 'GET' });
      validate(req, 'http: received 0|GET');
    });

    test('when only the path is provided', () => {
      const req = createRequest({ path: '/users' });
      validate(req, 'http: received 0:/users');
    });

    test('when only the url is provided', () => {
      const req = createRequest({ url: '/users' });
      validate(req, 'http: received 0:/users');
    });

    test('when both the method and url are provided', () => {
      const req = createRequest({ method: 'GET', url: 'www.example.com/users' });
      validate(req, 'http: received 0|GET:www.example.com/users');
    });

    test('when all the method, path and url are provided', () => {
      const req = createRequest({ method: 'GET', url: 'www.example.com/users', path: '/users' });
      validate(req, 'http: received 0|GET:/users');
    });
  });

  test('honours custom prefix and log levels and captures error args', () => {
    const logger = createMemoryLogger('trace');
    const middleware = requestLogger(logger, {
      prefix: 'api',
      receivedLevel: 'debug',
      closeLevel: 'notice',
      finishLevel: 'warning',
      endLevel: 'error',
      errorLevel: 'critical',
    });

    const req = createRequest({ method: 'POST', path: '/custom' });
    const { emitter: resEmitter, response: res } = createResponse();
    const next = jest.fn();

    middleware(req, res, next);

    const error = new Error('boom');

    resEmitter.emit('finish');
    resEmitter.emit('end');
    resEmitter.emit('close');
    resEmitter.emit('error', error);

    expect(next).toHaveBeenCalledTimes(1);

    expect(logger.entries).toHaveLength(5);
    const [received, finish, end, close, errorEntry] = logger.entries;

    expect(received.level).toBe('debug');
    expect(received.message).toBe('api: received 0|POST:/custom');

    expect(finish.level).toBe('warning');
    expect(finish.message).toMatch(/^api: finished 0\|POST:\/custom in \d+(?:\.\d+)?ms$/);

    expect(end.level).toBe('error');
    expect(end.message).toMatch(/^api: ended 0\|POST:\/custom in \d+(?:\.\d+)?ms$/);

    expect(close.level).toBe('notice');
    expect(close.message).toMatch(/^api: closed 0\|POST:\/custom after \d+(?:\.\d+)?ms$/);

    expect(errorEntry.level).toBe('critical');
    expect(errorEntry.message).toMatch(/^api: errored on 0\|POST:\/custom after \d+(?:\.\d+)?ms \(Error: boom\)$/);
    expect(errorEntry.message).toContain('Error: boom');
    expect(errorEntry.args).toEqual([error]);
  });

  test('skips prefixing when prefix option is empty', () => {
    const logger = createMemoryLogger('debug');
    const middleware = requestLogger(logger, { prefix: '' });

    const req = createRequest({ method: 'GET', path: '/ping' });
    const { emitter: resEmitter, response: res } = createResponse();
    const next = jest.fn();

    middleware(req, res, next);
    resEmitter.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(logger.entries).toHaveLength(2);

    const [received, finish] = logger.entries;
    expect(received.message).toBe('received 0|GET:/ping');
    expect(finish.message).toMatch(/^finished 0\|GET:\/ping in \d+(?:\.\d+)?ms$/);
  });
});
