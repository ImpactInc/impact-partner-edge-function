/**
 * Partner-style Worker used by the multi-Worker runtime tests.
 * It owns the origin fetch, then calls this repo over a Service Binding.
 */
export default {
  /**
   * @param {Request} request
   * @param {{IMPACT: {handle: Function}}} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const body = '<html lang="en"><body>partner-origin</body></html>';
    const originResponse = new Response(body, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        'content-length': new TextEncoder().encode(body).length.toString(),
        'cf-ray': 'origin-ray'
      }
    });
    return env.IMPACT.handle(request, originResponse);
  }
};
