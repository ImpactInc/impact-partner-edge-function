import {describe, expect, it} from 'vitest';
import {
  noAuth,
  withAuthApiKey,
  withAuthBasic,
  withAuthBearerToken
} from '../src/auth.js';

describe('noAuth', () => {
  it('wraps a string URL and returns JSON bodies', () => {
    const endpoint = noAuth('https://example.com/telemetry');
    const payload = {a: 1};

    expect(endpoint.url(payload)).toBe('https://example.com/telemetry');
    expect(endpoint.method('POST')).toBe('POST');
    expect(endpoint.headers({'Content-Type': 'application/json'})).toEqual({
      'Content-Type': 'application/json'
    });
    expect(endpoint.body(payload)).toBe(JSON.stringify(payload));
  });

  it('accepts a URL builder function', () => {
    const endpoint = noAuth((payload, debug) => `https://example.com/${payload.id}?debug=${debug}`);
    expect(endpoint.url({id: 'abc'}, true)).toBe('https://example.com/abc?debug=true');
  });
});

describe('withAuthBearerToken', () => {
  it('adds a Bearer Authorization header', () => {
    const endpoint = withAuthBearerToken('https://example.com/d', 'secret-token');
    expect(endpoint.headers({}, false)).toEqual({
      Authorization: 'Bearer secret-token'
    });
  });

  it('redacts the token in debug mode', () => {
    const endpoint = withAuthBearerToken('https://example.com/d', 'secret-token');
    expect(endpoint.headers({'Content-Length': '1'}, true)).toEqual({
      'Content-Length': '1',
      Authorization: 'Bearer API_TOKEN_GOES_HERE'
    });
  });

  it('preserves noAuth url/method/body behavior', () => {
    const endpoint = withAuthBearerToken('https://example.com/d', 'secret-token');
    expect(endpoint.url({})).toBe('https://example.com/d');
    expect(endpoint.method('POST')).toBe('POST');
    expect(endpoint.body({ok: true})).toBe('{"ok":true}');
  });
});

describe('withAuthBasic', () => {
  it('adds a Basic Authorization header', () => {
    const endpoint = withAuthBasic('https://example.com/d', 'user', 'pass');
    expect(endpoint.headers({}, false)).toEqual({
      Authorization: `Basic ${btoa('user:pass')}`
    });
  });

  it('redacts credentials in debug mode', () => {
    const endpoint = withAuthBasic('https://example.com/d', 'user', 'pass');
    expect(endpoint.headers({'Content-Length': '1'}, true)).toEqual({
      'Content-Length': '1',
      Authorization: 'Basic CREDENTIALS_GO_HERE'
    });
    expect(endpoint.headers({}, true).Authorization).not.toContain(btoa('user:pass'));
  });

  it('preserves noAuth url/method/body behavior', () => {
    const endpoint = withAuthBasic('https://example.com/d', 'user', 'pass');
    expect(endpoint.url({})).toBe('https://example.com/d');
    expect(endpoint.method('POST')).toBe('POST');
    expect(endpoint.body({ok: true})).toBe('{"ok":true}');
  });
});

describe('withAuthApiKey', () => {
  it('adds an x-api-key header', () => {
    const endpoint = withAuthApiKey('https://example.com/d', 'secret-key');
    expect(endpoint.headers({}, false)).toEqual({
      'x-api-key': 'secret-key'
    });
  });

  it('redacts the API key in debug mode', () => {
    const endpoint = withAuthApiKey('https://example.com/d', 'secret-key');
    expect(endpoint.headers({'Content-Length': '1'}, true)).toEqual({
      'Content-Length': '1',
      'x-api-key': 'API_KEY_GOES_HERE'
    });
  });

  it('preserves noAuth url/method/body behavior', () => {
    const endpoint = withAuthApiKey('https://example.com/d', 'secret-key');
    expect(endpoint.url({})).toBe('https://example.com/d');
    expect(endpoint.method('POST')).toBe('POST');
    expect(endpoint.body({ok: true})).toBe('{"ok":true}');
  });
});
