import Config from './config';
import build from './payload';
import post from './post';
import isChatbot from './chatbot';
import {debug} from './debug';

export default {
  /**
   * @param {Request} request
   * @param {Object} env Worker environment bindings passed into config (secrets, vars).
   * @param {ExecutionContext} ctx
   * @returns {Promise<Response>}
   */
  // eslint-disable-next-line require-await
  async fetch(request, env, ctx) {
    const response = await fetch(request);
    const config = Config(env);

    if (!Array.isArray(config.TELEMETRY_APIS) || config.TELEMETRY_APIS.length === 0) {
      console.error('No telemetry API URLs provided');
      return response;
    }

    if (!isHtmlResponse(response) || !isChatbot(request)) {
      return response;
    }

    const payload = build(request, response, config);

    /*
     * If we have a debug call to /impactDebug, then we won't send telemetry,
     * but instead return the debug output.
     */
    if (config.DEBUG) {
      const debugResponse = await debug(request, config, payload);
      if (debugResponse) {
        return debugResponse;
      }
    }

    ctx.waitUntil(post(config, payload));

    // Pass through: do not rewrite URL, method, headers, or body.
    return response;
  }
};

/**
 * True when the origin response is an HTML document (ignores charset parameters).
 *
 * @param {Response} response
 * @returns {Boolean}
 */
function isHtmlResponse(response) {
  if (!response || !response.headers) {
    return false;
  }

  const contentType = response.headers.get('content-type') || '';
  return contentType.toLowerCase().startsWith('text/html');
}