import {noAuth} from './auth';
import {buildDebugOutput} from './debug';

/**
 * @typedef {Object} TelemetryEndpoint
 * @property {function(Object): string} url
 * @property {function(String): string} method
 * @property {function(Object): object} headers
 * @property {function(Object): string} body
 */

/**
 * Fire-and-forget POST of the same payload to each telemetry endpoint.
 * String URLs are wrapped with noAuth; objects may supply url/method/headers/body adapters.
 * Per-endpoint failures are swallowed so telemetry never affects the client response path.
 *
 * @param {Object} config
 * @param {Object} payload
 * @returns {Promise<Array<Boolean|undefined>>}
 */
export default function post(config, payload) {
  return Promise.all(
    config.TELEMETRY_APIS.map(async(endpoint) => {
      if (!endpoint) {
        return;
      }

      try {
        if (typeof endpoint === 'string') {
          endpoint = noAuth(endpoint);
        }

        const url = endpoint.url(payload);
        // eslint-disable-next-line no-new
        new URL(url);

        const method = endpoint.method('POST');
        const body = endpoint.body(payload);
        const headers = endpoint.headers({
          'Content-Length': new TextEncoder().encode(body).length.toString(),
          'Content-Type': 'application/json'
        });

        const response = await fetch(url, {
          method,
          headers,
          body
        });

        if (response.status === 530) {
          const errorCode = await response.text();
          console.error(`Impact.com Telemetry Error: 530 ${response.statusText} (${errorCode.trim()})`);
          buildDebugOutput(config, payload).forEach(line => console.error(line));
          console.error('-----');
          return false;
        } else if (config.DEBUG) {
          console.debug(`Impact.com Telemetry Response: ${response.status} ${response.statusText}`);
          buildDebugOutput(config, payload).forEach(line => console.debug(line));
          console.debug('-----');
        }

        return response.status >= 200 && response.status < 300;
      } catch (e) {
        // do nothing
      }

      return false;
    })
  );
}
