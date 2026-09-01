import {noAuth} from './auth';

/**
 * Build the output for some debugging purposes
 *
 * @param {Object} config
 * @param {Object} payload
 * @returns {*}
 */
export function buildDebugOutput(config, payload) {
  return config.TELEMETRY_APIS.reduce((gathered, endpoint) => {
    try {
      if (typeof endpoint === 'string') {
        endpoint = noAuth(endpoint);
      }

      const url = endpoint.url(payload, true);

      try {
        // eslint-disable-next-line no-new
        new URL(url);
      } catch (e) {
        throw new Error(`Invalid URL: ${url}`);
      }

      const body = endpoint.body({...payload, responseStatus: 204, responseBytes: 0}, true);
      const headers = endpoint.headers({
        'Content-Length': new TextEncoder().encode(body).length.toString(),
        'Content-Type': 'application/json'
      }, true);
      const curlHeaders = Object
        .entries(headers)
        .map(([key, value]) => `-H "${key}: ${value}"`)
        .join(' ');
      gathered.push(`curl ${curlHeaders} '${url}'${body ? ` -d '${body}'` : ''}`);
    } catch (e) {
      gathered.push(`Error generating curl command for endpoint[${gathered.length}]: ${e.message}`);
    }

    return gathered;
  }, []);
}

/**
 * When DEBUG is enabled: either return a Response with the debug output or log
 * it to the console, depending on the request path.
 *
 * @param {Request} request
 * @param {Object} config
 * @param {Object} payload
 * @returns {Response|void}
 */
export function debug(request, config, payload) {
  if (!request) {
    return;
  }

  const output = buildDebugOutput(config, payload);
  const url = new URL(request.url);
  if (url.pathname === '/impactDebug') {
    const body = output.join('\n\n');
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'Content-Length': new TextEncoder().encode(body).length.toString()
      }
    });
  }

  console.debug('Impact.com Telemetry Output:');
  output.forEach(line => console.debug(line));
  console.debug('-----');
}
