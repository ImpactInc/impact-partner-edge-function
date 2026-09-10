import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {noAuth, withAuthBearerToken} from '../src/auth.js';
import {buildDebugOutput, debug} from '../src/debug.js';
import {makeRequest, mockConfig} from './helpers.js';

function configWith(apis, overrides = {}) {
  return mockConfig({TELEMETRY_APIS: apis, ...overrides});
}

describe('buildDebugOutput', () => {
  const payload = {
    accountId: 'test-account',
    pageUrl: 'https://shop.example/',
    responseStatus: 200,
    responseBytes: '12'
  };

  it('wraps string endpoints and builds curl commands with a 204 debug body', () => {
    const [command] = buildDebugOutput(configWith(['https://telemetry.example/d']), payload);

    expect(command).toContain('curl ');
    expect(command).toContain('-H "Content-Type: application/json"');
    expect(command).toContain('\'https://telemetry.example/d\'');
    expect(command).toContain('-d \'');
    expect(command).toContain('"responseStatus":204');
    expect(command).toContain('"responseBytes":0');
  });

  it('redacts secrets via endpoint debug adapters', () => {
    const endpoint = withAuthBearerToken('https://telemetry.example/secure', 'real-secret');
    const [command] = buildDebugOutput(configWith([endpoint]), payload);

    expect(command).toContain('Bearer API_TOKEN_GOES_HERE');
    expect(command).not.toContain('real-secret');
  });

  it('omits -d when the body is empty', () => {
    const endpoint = {
      ...noAuth('https://telemetry.example/empty'),
      body: () => ''
    };
    const [command] = buildDebugOutput(configWith([endpoint]), payload);

    expect(command).toContain('\'https://telemetry.example/empty\'');
    expect(command).not.toContain(' -d ');
  });

  it('reports errors for invalid endpoint URLs without throwing', () => {
    const endpoint = noAuth(() => 'not a url');
    const [command] = buildDebugOutput(configWith([endpoint]), payload);

    expect(command).toBe('Error generating curl command for endpoint[0]: Invalid URL: not a url');
  });

  it('reports other endpoint adapter failures without throwing', () => {
    const endpoint = {
      ...noAuth('https://telemetry.example/d'),
      body: () => {
        throw new Error('stringify failed');
      }
    };
    const [command] = buildDebugOutput(configWith([endpoint]), payload);

    expect(command).toBe('Error generating curl command for endpoint[0]: stringify failed');
  });

  it('joins multiple endpoint commands in order', () => {
    const commands = buildDebugOutput(configWith([
      'https://telemetry.example/a',
      'https://telemetry.example/b'
    ]), payload);

    expect(commands).toHaveLength(2);
    expect(commands[0]).toContain('https://telemetry.example/a');
    expect(commands[1]).toContain('https://telemetry.example/b');
  });
});

describe('debug', () => {
  const payload = {
    accountId: 'test-account',
    pageUrl: 'https://shop.example/',
    responseStatus: 200,
    responseBytes: '12'
  };

  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns nothing for a nullish request', () => {
    expect(debug(null, configWith([]), payload)).toBeUndefined();
    // eslint-disable-next-line no-undefined
    expect(debug(undefined, configWith([]), payload)).toBeUndefined();
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('logs curl commands for non-/impactDebug paths without replacing the response', () => {
    expect(debug(
      makeRequest('https://example.com/'),
      configWith(['https://telemetry.example/d']),
      payload
    )).toBeUndefined();

    expect(console.debug).toHaveBeenCalledWith('Impact.com Telemetry Output:');
    expect(console.debug).toHaveBeenCalledWith(expect.stringContaining('curl '));
    expect(console.debug).toHaveBeenCalledWith('-----');
  });

  it('returns plain-text curl commands for /impactDebug without logging', async() => {
    const response = debug(
      makeRequest('https://example.com/impactDebug'),
      configWith(['https://telemetry.example/d']),
      payload
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain;charset=UTF-8');
    expect(text).toContain('curl ');
    expect(text).toContain('\'https://telemetry.example/d\'');
    expect(text).toContain('-d \'');
    expect(text).toContain('"responseStatus":204');
    expect(text).toContain('"responseBytes":0');
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('matches /impactDebug with query string and rejects other paths', () => {
    const matched = debug(
      makeRequest('https://example.com/impactDebug?x=1'),
      configWith(['https://telemetry.example/d']),
      payload
    );
    expect(matched.headers.get('Content-Type')).toBe('text/plain;charset=UTF-8');
    expect(console.debug).not.toHaveBeenCalled();

    expect(debug(
      makeRequest('https://example.com/impactdebug'),
      configWith(['https://telemetry.example/d']),
      payload
    )).toBeUndefined();
    expect(console.debug).toHaveBeenCalledWith('Impact.com Telemetry Output:');
  });

  it('redacts secrets via endpoint debug adapters', async() => {
    const endpoint = withAuthBearerToken('https://telemetry.example/secure', 'real-secret');
    const text = await debug(
      makeRequest('https://example.com/impactDebug'),
      configWith([endpoint]),
      payload
    ).text();

    expect(text).toContain('Bearer API_TOKEN_GOES_HERE');
    expect(text).not.toContain('real-secret');
  });

  it('omits -d when the body is empty', async() => {
    const endpoint = {
      ...noAuth('https://telemetry.example/empty'),
      body: () => ''
    };
    const text = await debug(
      makeRequest('https://example.com/impactDebug'),
      configWith([endpoint]),
      payload
    ).text();

    expect(text).toContain('\'https://telemetry.example/empty\'');
    expect(text).not.toContain(' -d ');
  });

  it('reports errors for invalid endpoint URLs without throwing', async() => {
    const endpoint = noAuth(() => 'not a url');
    const text = await debug(
      makeRequest('https://example.com/impactDebug'),
      configWith([endpoint]),
      payload
    ).text();

    expect(text).toContain('Error generating curl command for endpoint[0]: Invalid URL: not a url');
  });

  it('joins multiple endpoint commands with blank lines', async() => {
    const text = await debug(
      makeRequest('https://example.com/impactDebug'),
      configWith([
        'https://telemetry.example/a',
        'https://telemetry.example/b'
      ]),
      payload
    ).text();

    const blocks = text.split('\n\n');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('https://telemetry.example/a');
    expect(blocks[1]).toContain('https://telemetry.example/b');
  });

  it('sets Content-Length to the UTF-8 byte length of the output', async() => {
    const response = debug(
      makeRequest('https://example.com/impactDebug'),
      configWith(['https://telemetry.example/d']),
      payload
    );
    const text = await response.text();
    expect(response.headers.get('Content-Length')).toBe(
      String(new TextEncoder().encode(text).length)
    );
  });
});
