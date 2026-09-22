import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {makeRequest, mockConfig} from './helpers.js';

const Config = vi.hoisted(() => vi.fn());

vi.mock('../src/config.js', () => ({
  default: (...args) => Config(...args)
}));

import ImpactTelemetry from '../src/index.js';

/**
 * @param {Object} [env]
 * @returns {{worker: ImpactTelemetry, ctx: {waitUntil: ReturnType<typeof vi.fn>}, env: Object}}
 */
function createWorker(env = {}) {
  const ctx = {waitUntil: vi.fn()};
  return {
    worker: new ImpactTelemetry(ctx, env),
    ctx,
    env
  };
}

describe('ImpactTelemetry.fetch', () => {
  let originResponse;

  beforeEach(() => {
    originResponse = new Response('<html lang="en"><body>origin</body></html>', {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        'content-length': '28'
      }
    });
    // eslint-disable-next-line require-await
    vi.stubGlobal('fetch', vi.fn(async(input, init) => {
      if (init) {
        return new Response(null, {status: 204});
      }
      return originResponse;
    }));
    Config.mockReset();
    Config.mockReturnValue(mockConfig());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the origin response and skips telemetry when TELEMETRY_APIS is empty', async() => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    Config.mockReturnValue(mockConfig({TELEMETRY_APIS: []}));

    const {worker, ctx} = createWorker();
    const response = await worker.fetch(makeRequest('https://shop.example/'));

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('No telemetry API URLs provided');
  });

  it('returns the origin response when TELEMETRY_APIS is not an array', async() => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    Config.mockReturnValue(mockConfig({TELEMETRY_APIS: null}));

    const {worker, ctx} = createWorker();
    const response = await worker.fetch(makeRequest('https://shop.example/'));

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('No telemetry API URLs provided');
  });

  it('returns debug curl output for /impactDebug when DEBUG is enabled on an HTML chatbot request', async() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    Config.mockReturnValue(mockConfig({DEBUG: true, DEBUG_ENDPOINT: '/impactDebug'}));

    const {worker, ctx} = createWorker({IMPACT_AUTH_TOKEN: 'secret'});
    const response = await worker.fetch(
      makeRequest('https://shop.example/impactDebug', {
        headers: {'user-agent': 'GPTBot/1.0'}
      })
    );

    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(response).not.toBe(originResponse);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain;charset=UTF-8');
    expect(await response.text()).toContain('curl ');
    expect(Config).toHaveBeenCalledWith({IMPACT_AUTH_TOKEN: 'secret'});
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('returns the origin response for /impactDebug when the origin is not HTML', async() => {
    Config.mockReturnValue(mockConfig({DEBUG: true, DEBUG_ENDPOINT: '/impactDebug'}));
    originResponse = new Response('{"ok":true}', {
      status: 200,
      headers: {'content-type': 'application/json'}
    });

    const {worker, ctx} = createWorker();
    const response = await worker.fetch(
      makeRequest('https://shop.example/impactDebug', {
        headers: {'user-agent': 'GPTBot/1.0'}
      })
    );

    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(response).toBe(originResponse);
  });

  it('does not post or debug for non-HTML responses even when DEBUG is enabled', async() => {
    const debugLog = vi.spyOn(console, 'debug').mockImplementation(() => {});
    Config.mockReturnValue(mockConfig({DEBUG: true, DEBUG_ENDPOINT: '/impactDebug'}));
    originResponse = new Response('{"ok":true}', {
      status: 200,
      headers: {'content-type': 'application/json'}
    });

    const {worker, ctx} = createWorker();
    const response = await worker.fetch(
      makeRequest('https://shop.example/api', {
        headers: {'user-agent': 'GPTBot/1.0'}
      })
    );

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(debugLog).not.toHaveBeenCalled();
  });

  it('skips telemetry when the origin response has no content-type', async() => {
    originResponse = {
      headers: {
        get: () => null
      }
    };

    const {worker, ctx} = createWorker();
    const response = await worker.fetch(
      makeRequest('https://shop.example/', {
        headers: {'user-agent': 'GPTBot/1.0'}
      })
    );

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
  });

  it('skips telemetry when fetch returns a nullish response', async() => {
    fetch.mockImplementation(async(input, init) => {
      if (init) {
        return new Response(null, {status: 204});
      }
      return null;
    });

    const {worker, ctx} = createWorker();
    const response = await worker.fetch(
      makeRequest('https://shop.example/', {
        headers: {'user-agent': 'GPTBot/1.0'}
      })
    );

    expect(response).toBeNull();
    expect(ctx.waitUntil).not.toHaveBeenCalled();
  });

  it('skips telemetry when the origin response has no headers', async() => {
    originResponse = {headers: null};

    const {worker, ctx} = createWorker();
    const response = await worker.fetch(
      makeRequest('https://shop.example/', {
        headers: {'user-agent': 'GPTBot/1.0'}
      })
    );

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
  });

  it('treats uppercase TEXT/HTML as an HTML document', async() => {
    originResponse = new Response('<html lang="en"></html>', {
      status: 200,
      headers: {'content-type': 'TEXT/HTML'}
    });

    const {worker, ctx} = createWorker();
    await worker.fetch(
      makeRequest('https://shop.example/', {
        headers: {'user-agent': 'GPTBot/1.0'}
      })
    );

    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
  });

  it('does not enter debug mode when DEBUG is false', async() => {
    const debugLog = vi.spyOn(console, 'debug').mockImplementation(() => {});
    Config.mockReturnValue(mockConfig({DEBUG: false, DEBUG_ENDPOINT: '/impactDebug'}));

    const {worker, ctx} = createWorker();
    const response = await worker.fetch(
      makeRequest('https://shop.example/impactDebug', {
        headers: {'user-agent': 'GPTBot/1.0'}
      })
    );

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(debugLog).not.toHaveBeenCalled();
  });

  it('schedules telemetry posts for chatbot requests', async() => {
    const {worker, ctx} = createWorker();
    const request = makeRequest('https://shop.example/', {
      headers: {'user-agent': 'GPTBot/1.0'}
    });

    const response = await worker.fetch(request);

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(ctx.waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
    await ctx.waitUntil.mock.calls[0][0];
    expect(fetch).toHaveBeenCalled();
    const telemetryCalls = fetch.mock.calls.filter(([, init]) => init);
    expect(telemetryCalls).toHaveLength(1);
    expect(telemetryCalls[0][0]).toBe('https://telemetry.example/d');
  });

  it('schedules telemetry posts when Cloudflare marks the request as a bot', async() => {
    const {worker, ctx} = createWorker();
    const request = makeRequest('https://shop.example/', {
      headers: {'user-agent': 'Mozilla/5.0'},
      cf: {bot: true}
    });

    await worker.fetch(request);

    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
  });

  it('passes through without posting for non-chatbot requests', async() => {
    const {worker, ctx} = createWorker();
    const request = makeRequest('https://shop.example/', {
      headers: {'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0'}
    });

    const response = await worker.fetch(request);

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(fetch.mock.calls.every(([, init]) => !init)).toBe(true);
  });

  it('skips telemetry for non-GET requests', async() => {
    const {worker, ctx} = createWorker();
    const response = await worker.fetch(
      makeRequest('https://shop.example/', {
        method: 'POST',
        headers: {'user-agent': 'GPTBot/1.0'}
      })
    );

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
  });

  it('skips debug logging for non-chatbot HTML requests even when DEBUG is enabled', async() => {
    const debugLog = vi.spyOn(console, 'debug').mockImplementation(() => {});
    Config.mockReturnValue(mockConfig({DEBUG: true, DEBUG_ENDPOINT: '/impactDebug'}));

    const {worker, ctx} = createWorker();
    const response = await worker.fetch(
      makeRequest('https://shop.example/', {
        headers: {'user-agent': 'Mozilla/5.0'}
      })
    );

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(debugLog).not.toHaveBeenCalled();
  });

  it('returns debug output even when the debug request looks like a chatbot', async() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    Config.mockReturnValue(mockConfig({DEBUG: true, DEBUG_ENDPOINT: '/impactDebug'}));

    const {worker, ctx} = createWorker();
    const response = await worker.fetch(
      makeRequest('https://shop.example/impactDebug', {
        headers: {'user-agent': 'GPTBot/1.0'}
      })
    );

    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(response.headers.get('Content-Type')).toBe('text/plain;charset=UTF-8');
  });

  it('posts telemetry when DEBUG is enabled but the path is not /impactDebug', async() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    Config.mockReturnValue(mockConfig({DEBUG: true, DEBUG_ENDPOINT: '/impactDebug'}));

    const {worker, ctx} = createWorker();
    await worker.fetch(
      makeRequest('https://shop.example/', {
        headers: {'user-agent': 'GPTBot/1.0'}
      })
    );

    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(console.debug).toHaveBeenCalledWith('Impact.com Telemetry Output:');
  });

  it('forwards the original request to fetch unchanged', async() => {
    const {worker} = createWorker();
    const request = makeRequest('https://shop.example/path', {
      headers: {'user-agent': 'Mozilla/5.0'}
    });

    await worker.fetch(request);

    expect(fetch).toHaveBeenCalledWith(request);
  });

  it('reads secrets from this.env rather than a fetch argument', async() => {
    const {worker} = createWorker({IMPACT_ACCOUNT_ID: 'from-this-env'});
    await worker.fetch(
      makeRequest('https://shop.example/', {
        headers: {'user-agent': 'GPTBot/1.0'}
      })
    );

    expect(Config).toHaveBeenCalledWith({IMPACT_ACCOUNT_ID: 'from-this-env'});
  });
});

describe('ImpactTelemetry.handle', () => {
  let originResponse;

  beforeEach(() => {
    originResponse = new Response('<html lang="en"><body>origin</body></html>', {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        'content-length': '28'
      }
    });
    // eslint-disable-next-line require-await
    vi.stubGlobal('fetch', vi.fn(async() => new Response(null, {status: 204})));
    Config.mockReset();
    Config.mockReturnValue(mockConfig());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('applies telemetry without fetching origin', async() => {
    const {worker, ctx} = createWorker();
    const request = makeRequest('https://shop.example/', {
      headers: {'user-agent': 'GPTBot/1.0'}
    });

    const response = await worker.handle(request, originResponse);

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls.every(([, init]) => Boolean(init))).toBe(true);
    await ctx.waitUntil.mock.calls[0][0];
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://telemetry.example/d');
    expect(fetch.mock.calls[0][1]).toBeDefined();
  });

  it('returns debug curl output for /impactDebug without fetching origin', async() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    Config.mockReturnValue(mockConfig({DEBUG: true, DEBUG_ENDPOINT: '/impactDebug'}));

    const {worker, ctx} = createWorker({IMPACT_AUTH_TOKEN: 'secret'});
    const response = await worker.handle(
      makeRequest('https://shop.example/impactDebug', {
        headers: {'user-agent': 'GPTBot/1.0'}
      }),
      originResponse
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(response).not.toBe(originResponse);
    expect(await response.text()).toContain('curl ');
    expect(Config).toHaveBeenCalledWith({IMPACT_AUTH_TOKEN: 'secret'});
  });

  it('returns the caller response when TELEMETRY_APIS is empty', async() => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    Config.mockReturnValue(mockConfig({TELEMETRY_APIS: []}));

    const {worker, ctx} = createWorker();
    const response = await worker.handle(
      makeRequest('https://shop.example/', {
        headers: {'user-agent': 'GPTBot/1.0'}
      }),
      originResponse
    );

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('No telemetry API URLs provided');
  });

  it('returns the caller response for a nullish request', async() => {
    const {worker, ctx} = createWorker();
    const response = await worker.handle(null, originResponse);

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns the caller response for non-GET requests', async() => {
    const {worker, ctx} = createWorker();
    const response = await worker.handle(
      makeRequest('https://shop.example/', {
        method: 'POST',
        headers: {'user-agent': 'GPTBot/1.0'}
      }),
      originResponse
    );

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns the caller response for non-chatbot HTML', async() => {
    const {worker, ctx} = createWorker();
    const response = await worker.handle(
      makeRequest('https://shop.example/', {
        headers: {'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0'}
      }),
      originResponse
    );

    expect(response).toBe(originResponse);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
