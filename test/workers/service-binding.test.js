import {afterEach, describe, expect, it} from 'vitest';
import {env} from 'cloudflare:workers';

const TELEMETRY_URL = 'https://trkapi.impact.com/telemetry/crawler-visits';

/**
 * @param {Number} [timeoutMs]
 * @returns {Promise<{url: String, method: String, body: String}>}
 */
async function waitForTelemetry(timeoutMs = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await env.TELEMETRY_SINK.fetch('https://telemetry-sink/__last');
    if (response.status === 200) {
      return response.json();
    }
    await scheduler.wait(10);
  }
  throw new Error('Timed out waiting for telemetry POST');
}

describe('env.IMPACT.handle (service binding)', () => {
  afterEach(async() => {
    await env.TELEMETRY_SINK.fetch('https://telemetry-sink/__reset', {method: 'POST'});
  });

  it('transfers Request and Response over RPC and schedules telemetry', async() => {
    const html = '<html><body>shop</body></html>';
    const request = new Request('https://shop.example/products?id=1', {
      headers: {
        'user-agent': 'GPTBot/1.0',
        'cf-connecting-ip': '203.0.113.10'
      },
      cf: {
        bot: true,
        country: 'US',
        rayId: 'rpc-ray',
        verifiedBotCategory: 'AI Crawler',
        botManagement: {
          score: 1,
          verifiedBot: true,
          signedAgent: true,
          ja4: 't13d...',
          jsDetection: {passed: true}
        }
      }
    });
    const originResponse = new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        'content-length': String(html.length),
        'cf-ray': 'origin-ray'
      }
    });

    const response = await env.IMPACT.handle(request, originResponse);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=UTF-8');
    expect(await response.text()).toBe(html);

    const posted = await waitForTelemetry();
    expect(posted.method).toBe('POST');
    expect(posted.url).toBe(TELEMETRY_URL);

    const payload = JSON.parse(posted.body);
    expect(payload).toMatchObject({
      accountId: 'test-account',
      pageUrl: 'https://shop.example/products?id=1',
      userAgent: 'GPTBot/1.0',
      ipAddress: '203.0.113.10',
      responseStatus: 200,
      responseBytes: String(html.length),
      cfRayId: 'rpc-ray',
      cfCountry: 'US',
      cfVerifiedBotCategory: 'AI Crawler',
      cfBot: true,
      cfBotScore: 1,
      cfVerifiedBot: true,
      cfSignedAgent: true,
      cfJa4: 't13d...',
      cfJsDetectionPassed: true
    });
  });

  it('keeps request.cf when the User-Agent is not a known chatbot', async() => {
    const request = new Request('https://shop.example/', {
      headers: {'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0'},
      cf: {bot: true, country: 'DE', rayId: 'bot-flag-ray'}
    });
    const originResponse = new Response('<html>ok</html>', {
      status: 200,
      headers: {'content-type': 'text/html'}
    });

    const response = await env.IMPACT.handle(request, originResponse);
    expect(await response.text()).toBe('<html>ok</html>');

    const posted = await waitForTelemetry();
    const payload = JSON.parse(posted.body);
    expect(payload.userAgent).toBe('Mozilla/5.0 Chrome/120.0.0.0');
    expect(payload.cfBot).toBe(true);
    expect(payload.cfCountry).toBe('DE');
    expect(payload.cfRayId).toBe('bot-flag-ray');
  });

  it('does not post telemetry for a non-chatbot HTML request', async() => {
    const request = new Request('https://shop.example/', {
      headers: {'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0'}
    });
    const originResponse = new Response('<html>ok</html>', {
      status: 200,
      headers: {'content-type': 'text/html'}
    });

    const response = await env.IMPACT.handle(request, originResponse);
    expect(response.status).toBe(200);

    await scheduler.wait(50);
    const sink = await env.TELEMETRY_SINK.fetch('https://telemetry-sink/__last');
    expect(sink.status).toBe(404);
  });
});
