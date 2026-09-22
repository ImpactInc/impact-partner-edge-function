import {describe, expect, it} from 'vitest';
import Config from '../src/config.js';

describe('Config', () => {
  it('configures the Impact endpoint with the partner-specific auth token', async () => {
    const config = Config({IMPACT_AUTH_TOKEN: 'partner-token'});

    expect(config.ACCOUNT_ID).toBeUndefined();
    expect(config.DEBUG).toBe(false);
    expect(config.DEBUG_ENDPOINT).toBe('');
    const {version} = await import('../package.json');
    expect(config.VERSION).toBe(version);
    expect(config.TELEMETRY_APIS).toHaveLength(1);

    const endpoint = config.TELEMETRY_APIS[0];
    expect(endpoint.url({})).toBe('https://trkapi.impact.com/telemetry/crawler-visits');
    expect(endpoint.headers({}, false)).toEqual({
      Authorization: 'Bearer partner-token'
    });
  });

  it('passes through IMPACT_ACCOUNT_ID', () => {
    expect(Config({
      IMPACT_ACCOUNT_ID: 'acc-123',
      IMPACT_AUTH_TOKEN: 'partner-token'
    }).ACCOUNT_ID).toBe('acc-123');
  });

  it.each([true, 'true', 1, '1'])('enables debug mode for %s', value => {
    expect(Config({
      IMPACT_AUTH_TOKEN: 'partner-token',
      IMPACT_DEBUG: value
    }).DEBUG).toBe(true);
  });

  it.each([false, 'false', 0, '0', '', 'yes'])('disables debug mode for %s', value => {
    expect(Config({
      IMPACT_AUTH_TOKEN: 'partner-token',
      IMPACT_DEBUG: value
    }).DEBUG).toBe(false);
  });

  it('disables debug mode when IMPACT_DEBUG is omitted', () => {
    expect(Config({IMPACT_AUTH_TOKEN: 'partner-token'}).DEBUG).toBe(false);
  });

  it('sets DEBUG_ENDPOINT when IMPACT_DEBUG is enabled and IMPACT_DEBUG_ENDPOINT is a non-empty string', () => {
    expect(Config({
      IMPACT_AUTH_TOKEN: 'partner-token',
      IMPACT_DEBUG: true,
      IMPACT_DEBUG_ENDPOINT: '/impactDebug'
    }).DEBUG_ENDPOINT).toBe('/impactDebug');
  });

  it('keeps a custom DEBUG_ENDPOINT path', () => {
    expect(Config({
      IMPACT_AUTH_TOKEN: 'partner-token',
      IMPACT_DEBUG: '1',
      IMPACT_DEBUG_ENDPOINT: '/__impact/debug'
    }).DEBUG_ENDPOINT).toBe('/__impact/debug');
  });

  it('does not set DEBUG_ENDPOINT when IMPACT_DEBUG is disabled', () => {
    expect(Config({
      IMPACT_AUTH_TOKEN: 'partner-token',
      IMPACT_DEBUG: false,
      IMPACT_DEBUG_ENDPOINT: '/impactDebug'
    }).DEBUG_ENDPOINT).toBe('');
  });

  it('does not set DEBUG_ENDPOINT when IMPACT_DEBUG_ENDPOINT is omitted', () => {
    expect(Config({
      IMPACT_AUTH_TOKEN: 'partner-token',
      IMPACT_DEBUG: true
    }).DEBUG_ENDPOINT).toBe('');
  });

  it('does not set DEBUG_ENDPOINT when IMPACT_DEBUG_ENDPOINT is an empty string', () => {
    expect(Config({
      IMPACT_AUTH_TOKEN: 'partner-token',
      IMPACT_DEBUG: true,
      IMPACT_DEBUG_ENDPOINT: ''
    }).DEBUG_ENDPOINT).toBe('');
  });

  it.each([1, true, null])('does not set DEBUG_ENDPOINT when IMPACT_DEBUG_ENDPOINT is %s', value => {
    expect(Config({
      IMPACT_AUTH_TOKEN: 'partner-token',
      IMPACT_DEBUG: true,
      IMPACT_DEBUG_ENDPOINT: value
    }).DEBUG_ENDPOINT).toBe('');
  });

  it('disables telemetry when the required auth token is unavailable', () => {
    expect(Config({}).TELEMETRY_APIS).toEqual([]);
  });
});
