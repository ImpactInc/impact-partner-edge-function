/**
 * Chatbot user agent patterns used by the Worker.
 * Keep in sync when that list changes.
 */
const CHATBOT_PATTERN = new RegExp(
  [
    'amazonbot',
    'applebot-extended',
    'anthropic-ai',
    'claude(bot|-(code|searchbot|user|web))',
    'gemini-deep-research',
    'google-(extended|cloudvertexbot)',
    'xai-grok',
    'grok(bot|-(deepsearch|search))',
    'gptbot',
    'chatgpt-(user|crawler)',
    'oai-(search|ads)bot',
    'perplexity-(user|crawler)',
    'perplexitybot',
    'bytespider'
  ].join('|'),
  'i'
);

/**
 * True when Cloudflare marks the request as a bot / verified bot, or the User-Agent
 * matches a known chatbot pattern.
 *
 * @param {Request} request
 * @returns {Boolean}
 */
export default function isChatbotUserAgent(request) {
  const cf = request.cf || {};
  const verifiedBot = (cf.botManagement || {}).verifiedBot;
  return cf.bot || verifiedBot || CHATBOT_PATTERN.test(request.headers.get('user-agent') || '');
}
