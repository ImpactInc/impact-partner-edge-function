let last = null;

/**
 * Captures outbound telemetry POSTs from the auxiliary Impact Worker.
 */
export default {
  /**
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/__last') {
      return last
        ? new Response(last, {headers: {'content-type': 'application/json'}})
        : new Response(null, {status: 404});
    }
    if (url.pathname === '/__reset') {
      last = null;
      return new Response(null, {status: 204});
    }

    last = JSON.stringify({
      url: request.url,
      method: request.method,
      body: await request.text()
    });
    return new Response(null, {status: 204});
  }
};
