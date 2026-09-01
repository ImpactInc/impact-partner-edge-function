/**
 * Build the Cloudflare payload from the request.cf object and response headers.
 *
 * @param {Object} data
 * @param {Object} headers
 * @returns {{cfRayId: *|null, cfCountry: *|null, cfVerifiedBotCategory: *|null, cfBot: *|null}}
 */
function getCloudflarePayload(data, headers) {
  return {
    cfRayId: valueOrNull(data.rayId || headers.get('cf-ray')),
    cfCountry: valueOrNull(data.country),
    cfVerifiedBotCategory: valueOrNull(data.verifiedBotCategory),
    cfBot: valueOrNull(data.bot)
  };
}

/**
 * Build the bot payload from the request.cf.botManagement object.
 *
 * @param {Object} data
 * @returns {{cfBotScore: *|null, cfVerifiedBot: *|null, cfSignedAgent: *|null, cfJa4: *|null, cfJsDetectionPassed: *|null}|{cfBotScore: null, cfVerifiedBot: null, cfSignedAgent: null, cfJa4: null, cfJsDetectionPassed: null}}
 */
function getBotPayload(data) {
  if (!data) {
    return {
      cfBotScore: null,
      cfVerifiedBot: null,
      cfSignedAgent: null,
      cfJa4: null,
      cfJsDetectionPassed: null
    };
  }

  return {
    cfBotScore: valueOrNull(data.score),
    cfVerifiedBot: valueOrNull(data.verifiedBot),
    cfSignedAgent: valueOrNull(data.signedAgent),
    cfJa4: valueOrNull(data.ja4),
    cfJsDetectionPassed: valueOrNull(data.jsDetection && data.jsDetection.passed)
  };
}

/**
 * Build the edge telemetry payload from the request, origin response, and worker config.
 *
 * @param {Request} request
 * @param {Response} response
 * @param {{ACCOUNT_ID: String, VERSION: String}} config
 * @returns {{
 *   pageUrl: String,
 *   userAgent: String,
 *   eventDate: String,
 *   workerVersion: String,
 *   ipAddress: String|null,
 *   responseStatus: number,
 *   responseBytes: String|null,
 *   webBotAuthSignature: String|null,
 *   webBotAuthSignatureAgent: String|null,
 *   webBotAuthSignatureInput: String|null,
 *   webBotAuthCoveredHeaders: String,
 *   cfRayId: *|null,
 *   cfCountry: *|null,
 *   cfVerifiedBotCategory: *|null,
 *   cfBot: *|null,
 *   cfBotScore: *|null,
 *   cfVerifiedBot: *|null,
 *   cfSignedAgent: *|null,
 *   cfJa4: *|null,
 *   cfJsDetectionPassed: *|null
 * }}
 */
export default function build(request, response, config) {
  const data = request.cf || {};
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';

  const cloudflarePayload = getCloudflarePayload(data, response.headers);
  const botPayload = getBotPayload(data.botManagement);

  const webBotAuthSignatureInput = request.headers.get('signature-input') || null;
  return {
    accountId: config.ACCOUNT_ID,
    pageUrl: url.href,
    userAgent: userAgent,
    eventDate: new Date().toISOString(),
    workerVersion: config.VERSION,
    ipAddress: request.headers.get('cf-connecting-ip') || null,
    responseStatus: response.status,
    responseBytes: response.headers.get('content-length') || null,
    webBotAuthSignature: request.headers.get('signature') || null,
    webBotAuthSignatureAgent: request.headers.get('signature-agent') || null,
    webBotAuthSignatureInput,
    webBotAuthCoveredHeaders: extractWebBotAuthCoveredHeaders(webBotAuthSignatureInput, request.headers),
    ...cloudflarePayload,
    ...botPayload
  };
}

/**
 * Return null for undefined values, otherwise return the value.
 *
 * @param {*} value
 * @returns {*|null}
 */
function valueOrNull(value) {
  // eslint-disable-next-line no-undefined
  return value === undefined
    ? null
    : value;
}

/**
 * Extract the covered headers from the signature-agent or signature-input header.
 *
 * @param {String} signatureAgent
 * @param {Object} headers
 * @returns {String}
 */
function extractWebBotAuthCoveredHeaders(signatureAgent, headers) {
  if (!signatureAgent) {
    return '{}';
  }

  const match = signatureAgent.match(/(sig(?:\d+)|signature)=\(([^)]*)/);
  if (!match || match.length < 3) {
    return '{}';
  }

  return JSON.stringify(
    match[2]
      .split(' ')
      .map(header => header.replaceAll('"', '').trim())
      .reduce((gathered, key) => {
        try {
          gathered[key] = headers.get(key.toLowerCase()) || null;
        } catch (e) {
          // Structured field components like "@authority" are not HTTP header names.
          gathered[key] = null;
        }
        return gathered;
      }, {})
  );
}
