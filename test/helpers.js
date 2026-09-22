/**
 * @param {String} url
 * @param {Object} [options]
 * @param {String} [options.method]
 * @param {HeadersInit} [options.headers]
 * @param {Object} [options.cf]
 * @returns {Request}
 */
export function makeRequest(url, {method, headers = {}, cf} = {}) {
  const request = new Request(url, {method, headers});
  // eslint-disable-next-line no-undefined
  if (cf !== undefined) {
    Object.defineProperty(request, 'cf', {
      value: cf,
      enumerable: true,
      configurable: true
    });
  }
  return request;
}

/**
 * @param {Object} [overrides]
 * @returns {Object}
 */
export function mockConfig(overrides = {}) {
  return {
    ACCOUNT_ID: 'test-account',
    DEBUG: false,
    DEBUG_ENDPOINT: '',
    TELEMETRY_APIS: ['https://telemetry.example/d'],
    VERSION: '0.1.0',
    ...overrides
  };
}
