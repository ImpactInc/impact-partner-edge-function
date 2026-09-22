import {WorkerEntrypoint} from 'cloudflare:workers';
import Config from './config';
import build from './payload';
import post from './post';
import isChatbot from './chatbot';
import {debug} from './debug';

/**
 * Chatbot telemetry Worker.
 *
 * Standalone: deploy with a route. Incoming requests proxy to origin, then
 * eligible chatbot HTML visits are reported to Impact.
 *
 * Service binding: when another Worker already owns the zone route, bind this
 * Worker and call {@link ImpactTelemetry#handle} with the origin response.
 * Do not call {@link ImpactTelemetry#fetch} from that Worker — `fetch` always
 * retrieves origin itself, which loops back to the calling Worker.
 *
 * Caller wrangler.toml:
 *
 * ```toml
 * [[services]]
 * binding = "IMPACT"
 * service = "impact-partner-edge-function"
 * ```
 *
 * Caller Worker:
 *
 * ```js
 * export default {
 *   async fetch(request, env) {
 *     // Only paying attention to GET requests
 *     if (request.method !== 'GET') {
 *       return fetch(request);
 *     }
 *
 *     const response = await fetch(request);
 *     return env.IMPACT.handle(request, response);
 *   }
 * };
 * ```
 *
 * Secrets (`IMPACT_AUTH_TOKEN`, `IMPACT_ACCOUNT_ID`) stay on this Worker.
 */
export class ImpactTelemetry extends WorkerEntrypoint {
  /**
   * Standalone HTTP entry: fetch origin, then apply telemetry.
   *
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async fetch(request) {
    const response = await fetch(request);
    return trackTelemetry(request, response, this.env, this.ctx);
  }

  /**
   * RPC entry for Service Bindings: apply telemetry to a response the caller
   * already produced. Does not fetch origin.
   *
   * Request and Response are valid RPC types. Passing `response` transfers
   * ownership of its body; the returned Response is what the caller should
   * send to the client (the original, or the env.IMPACT_DEBUG_ENDPOINT output
   * when env.IMPACT_DEBUG is true and the current request path matches the
   * value in env.IMPACT_DEBUG_ENDPOINT).
   *
   * @param {Request} request
   * @param {Response} response
   * @returns {Promise<Response>}
   */
  async handle(request, response) {
    return trackTelemetry(request, response, this.env, this.ctx);
  }
}

export default ImpactTelemetry;

/**
 * @param {Request} request
 * @param {Response} response
 * @param {Object} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
async function trackTelemetry(request, response, env, ctx) {
  const config = Config(env);

  if (!Array.isArray(config.TELEMETRY_APIS) || config.TELEMETRY_APIS.length === 0) {
    console.error('No telemetry API URLs provided');
    return response;
  }

  if (ignoreRequest(request, response)) {
    return response;
  }

  const payload = build(request, response, config);

  /*
   * If we have a debug call to env.IMPACT_DEBUG_ENDPOINT, then we won't send
   * telemetry, but instead return the debug output in curl commands for each
   * defined telemetry endpoint.
   */
  const debugResponse = await debug(request, config, payload);
  if (debugResponse) {
    return debugResponse;
  }

  ctx.waitUntil(post(config, payload));

  // Pass through: do not rewrite URL, method, headers, or body.
  return response;
}

/**
 * True when this request/response pair should not generate telemetry.
 *
 * @param {Request} request
 * @param {Response} response
 * @returns {Boolean}
 */
function ignoreRequest(request, response) {
  if (!request || request.method !== 'GET' || !isChatbot(request) || !response || !response.headers) {
    return true;
  }
  const contentType = response.headers.get('content-type') || '';
  return !contentType.toLowerCase().startsWith('text/html');
}
