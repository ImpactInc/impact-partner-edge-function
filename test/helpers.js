/**
 * @param {string} url
 * @param {object} [options]
 * @param {HeadersInit} [options.headers]
 * @param {object} [options.cf]
 * @returns {Request}
 */
export function makeRequest(url, {headers = {}, cf} = {}) {
  const request = new Request(url, {headers});
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
 * @param {object} [overrides]
 * @returns {object}
 */
export function mockConfig(overrides = {}) {
  return {
    ACCOUNT_ID: 'test-account',
    DEBUG: false,
    TELEMETRY_APIS: ['https://telemetry.example/d'],
    VERSION: '0.1.0',
    ...overrides
  };
}
