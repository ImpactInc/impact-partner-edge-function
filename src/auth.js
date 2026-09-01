/**
 * Generate an endpoint adapter that does not add any authentication headers.
 *
 * @param {String|Function} url
 * @returns {{url: *|(function(): *), method: function(*): *, headers: function(*): *, body: function(*): String}}
 */
export function noAuth(url) {
  return {
    url: typeof url === 'function' ? url : () => url,
    method: value => value,
    headers: value => value,
    body: payload => JSON.stringify(payload)
  };
}

/**
 * Generate an endpoint adapter that adds a Bearer token to the Authorization header.
 *
 * @param {String|Function} url
 * @param {String} token
 * @returns {{url: *|(function(): *), method: function(*): *, headers: function(*, *): *&{Authorization: String}, body: function(*): String}}
 */
export function withAuthBearerToken(url, token) {
  return {
    ...noAuth(url),
    headers: (headers, debug) => {
      return {
        ...headers,
        'Authorization': `Bearer ${debug ? 'API_TOKEN_GOES_HERE' : token}`
      };
    }
  };
}

/**
 * Generate an endpoint adapter that adds Basic Auth credentials to the Authorization header.
 *
 * @param {String|Function} url
 * @param {String} username
 * @param {String} password
 * @returns {{url: *|(function(): *), method: function(*): *, headers: function(*, *): *&{Authorization: String}, body: function(*): String}}
 */
export function withAuthBasic(url, username, password) {
  const credentials = btoa(`${username}:${password}`);
  return {
    ...noAuth(url),
    headers: (headers, debug) => {
      return {
        ...headers,
        'Authorization': `Basic ${debug ? 'CREDENTIALS_GO_HERE' : credentials}`
      };
    }
  };
}

/**
 * Generate an endpoint adapter that adds an API key to the x-api-key header.
 *
 * @param {String|Function} url
 * @param {String} apiKey
 * @returns {{url: (*|(function(): *)), method: (function(*): *), headers: function(*, *): *&{'x-api-key': String|*}, body: (function(*): String)}}
 */
export function withAuthApiKey(url, apiKey) {
  return {
    ...noAuth(url),
    headers: (headers, debug) => {
      return {
        ...headers,
        'x-api-key': debug ? 'API_KEY_GOES_HERE' : apiKey
      };
    }
  };
}
