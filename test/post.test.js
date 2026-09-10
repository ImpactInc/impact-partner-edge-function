import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {noAuth, withAuthBearerToken} from '../src/auth.js';
import post from '../src/post.js';
import {mockConfig} from './helpers.js';

/* eslint-disable no-undefined */

describe('post', () => {
  beforeEach(() => {
    // eslint-disable-next-line require-await
    vi.stubGlobal('fetch', vi.fn(async() => new Response(null, {status: 204})));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts JSON to string endpoints wrapped with noAuth', async() => {
    const payload = {accountId: '123'};
    const results = await post(mockConfig({TELEMETRY_APIS: ['https://telemetry.example/d']}), payload);

    expect(results).toEqual([true]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://telemetry.example/d');
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify(payload));
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['Content-Length']).toBe(
      String(new TextEncoder().encode(options.body).length)
    );
  });

  it('uses endpoint adapters for url/method/headers/body', async() => {
    const endpoint = {
      ...withAuthBearerToken('https://telemetry.example/secure', 'token'),
      method: () => 'PUT',
      body: () => 'custom-body'
    };

    const results = await post(mockConfig({TELEMETRY_APIS: [endpoint]}), {ok: true});
    expect(results).toEqual([true]);

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://telemetry.example/secure');
    expect(options.method).toBe('PUT');
    expect(options.body).toBe('custom-body');
    expect(options.headers.Authorization).toBe('Bearer token');
    expect(options.headers['Content-Length']).toBe(
      String(new TextEncoder().encode('custom-body').length)
    );
  });

  it('skips falsy endpoints', async() => {
    const results = await post(mockConfig({TELEMETRY_APIS: [null, '', undefined]}), {});
    expect(results).toEqual([undefined, undefined, undefined]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns false when fetch throws', async() => {
    fetch.mockRejectedValueOnce(new Error('network down'));
    const results = await post(mockConfig({TELEMETRY_APIS: ['https://telemetry.example/d']}), {});
    expect(results).toEqual([false]);
  });

  it('returns false for an invalid endpoint URL', async() => {
    const endpoint = noAuth(() => 'not a url');
    const results = await post(mockConfig({TELEMETRY_APIS: [endpoint]}), {});
    expect(results).toEqual([false]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts to every endpoint independently', async() => {
    fetch
      .mockResolvedValueOnce(new Response(null, {status: 204}))
      .mockRejectedValueOnce(new Error('fail'));

    const results = await post(mockConfig({
      TELEMETRY_APIS: [
        'https://telemetry.example/a',
        'https://telemetry.example/b'
      ]
    }), {x: 1});

    expect(results).toEqual([true, false]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns false for non-success statuses', async() => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockResolvedValueOnce(new Response(null, {status: 500, statusText: 'Internal Server Error'}));

    const results = await post(mockConfig({TELEMETRY_APIS: ['https://telemetry.example/d']}), {});

    expect(results).toEqual([false]);
    expect(error).not.toHaveBeenCalled();
  });

  it('logs 530 errors with debug output and returns false', async() => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockResolvedValueOnce(new Response('  error-code  ', {
      status: 530,
      statusText: 'Origin DNS Error'
    }));

    const results = await post(mockConfig({TELEMETRY_APIS: ['https://telemetry.example/d']}), {ok: true});

    expect(results).toEqual([false]);
    expect(error).toHaveBeenCalledWith('Impact.com Telemetry Error: 530 Origin DNS Error (error-code)');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('curl '));
    expect(error).toHaveBeenCalledWith('-----');
  });

  it('prefers 530 error logging over debug response logging', async() => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const debugLog = vi.spyOn(console, 'debug').mockImplementation(() => {});
    fetch.mockResolvedValueOnce(new Response('cf-error', {
      status: 530,
      statusText: 'error'
    }));

    await post(mockConfig({
      DEBUG: true,
      TELEMETRY_APIS: ['https://telemetry.example/d']
    }), {});

    expect(error).toHaveBeenCalledWith(expect.stringContaining('Impact.com Telemetry Error: 530'));
    expect(debugLog).not.toHaveBeenCalled();
  });

  it('logs the telemetry response when DEBUG is enabled', async() => {
    const debugLog = vi.spyOn(console, 'debug').mockImplementation(() => {});
    fetch.mockResolvedValueOnce(new Response(null, {status: 204, statusText: 'No Content'}));

    const results = await post(mockConfig({
      DEBUG: true,
      TELEMETRY_APIS: ['https://telemetry.example/d']
    }), {ok: true});

    expect(results).toEqual([true]);
    expect(debugLog).toHaveBeenCalledWith('Impact.com Telemetry Response: 204 No Content');
    expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('curl '));
    expect(debugLog).toHaveBeenCalledWith('-----');
  });

  it('does not log successful responses when DEBUG is disabled', async() => {
    const debugLog = vi.spyOn(console, 'debug').mockImplementation(() => {});

    await post(mockConfig({TELEMETRY_APIS: ['https://telemetry.example/d']}), {});

    expect(debugLog).not.toHaveBeenCalled();
  });
});
