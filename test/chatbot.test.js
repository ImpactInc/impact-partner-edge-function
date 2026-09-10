import {describe, expect, it} from 'vitest';
import isChatbot from '../src/chatbot.js';
import {makeRequest} from './helpers.js';

describe('isChatbotUserAgent', () => {
  it('returns true when Cloudflare marks the request as a bot', () => {
    const request = makeRequest('https://example.com/', {
      headers: {'user-agent': 'Mozilla/5.0'},
      cf: {bot: true}
    });
    expect(isChatbot(request)).toBe(true);
  });

  it('returns true when Bot Management marks a verified bot', () => {
    const request = makeRequest('https://example.com/', {
      headers: {'user-agent': 'Mozilla/5.0'},
      cf: {botManagement: {verifiedBot: true}}
    });
    expect(isChatbot(request)).toBe(true);
  });

  it.each([
    'Amazonbot/1.0',
    'Applebot-Extended/1.0',
    'anthropic-ai',
    'ClaudeBot/1.0',
    'claude-web',
    'claude-user',
    'claude-searchbot',
    'claude-code',
    'Gemini-Deep-Research',
    'Google-Extended',
    'Google-CloudVertexBot',
    'xAI-Grok',
    'GrokBot/1.0',
    'grok-deepsearch',
    'grok-search',
    'GPTBot/1.0',
    'ChatGPT-User/1.0',
    'ChatGPT-Crawler',
    'OAI-SearchBot',
    'OAI-AdsBot',
    'Perplexity-User',
    'Perplexity-Crawler',
    'PerplexityBot/1.0',
    'Bytespider'
  ])('returns true for chatbot user agent %s', (userAgent) => {
    const request = makeRequest('https://example.com/', {
      headers: {'user-agent': userAgent}
    });
    expect(isChatbot(request)).toBe(true);
  });

  it('returns false for a normal browser user agent without bot signals', () => {
    const request = makeRequest('https://example.com/', {
      headers: {'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/120.0.0.0'},
      cf: {bot: false, botManagement: {verifiedBot: false}}
    });
    expect(isChatbot(request)).toBe(false);
  });

  it('returns false when user-agent is missing and there are no bot signals', () => {
    const request = makeRequest('https://example.com/');
    expect(isChatbot(request)).toBe(false);
  });

  it('treats a missing request.cf as empty', () => {
    const request = makeRequest('https://example.com/', {
      headers: {'user-agent': 'GPTBot/1.0'}
    });
    expect(isChatbot(request)).toBe(true);
  });
});
