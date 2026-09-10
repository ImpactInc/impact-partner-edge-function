import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import build from '../src/payload.js';
import {makeRequest, mockConfig} from './helpers.js';

describe('build', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T16:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds a payload with null fallbacks when Cloudflare data is unavailable', () => {
    const request = makeRequest('https://shop.example/products?id=1', {
      headers: {
        'user-agent': 'Mozilla/5.0',
        'cf-connecting-ip': '203.0.113.10'
      }
    });
    const response = new Response('ok', {status: 200});
    const payload = build(request, response, mockConfig());

    expect(payload).toMatchObject({
      accountId: 'test-account',
      pageUrl: 'https://shop.example/products?id=1',
      userAgent: 'Mozilla/5.0',
      eventDate: '2026-07-31T16:00:00.000Z',
      workerVersion: '0.1.0',
      ipAddress: '203.0.113.10',
      responseStatus: 200,
      responseBytes: null,
      webBotAuthSignature: null,
      webBotAuthSignatureAgent: null,
      webBotAuthSignatureInput: null,
      webBotAuthCoveredHeaders: '{}',
      cfRayId: null,
      cfCountry: null,
      cfVerifiedBotCategory: null,
      cfBot: null,
      cfBotScore: null,
      cfVerifiedBot: null,
      cfSignedAgent: null,
      cfJa4: null,
      cfJsDetectionPassed: null
    });
  });

  it('maps Cloudflare and Bot Management fields when present', () => {
    const request = makeRequest('https://shop.example/', {
      headers: {'user-agent': 'GPTBot/1.0'},
      cf: {
        rayId: 'ray-123',
        country: 'US',
        verifiedBotCategory: 'Search Engine Crawler',
        bot: true,
        botManagement: {
          score: 1,
          verifiedBot: true,
          signedAgent: true,
          ja4: 't13d...',
          jsDetection: {passed: true}
        }
      }
    });
    const response = new Response(null, {
      status: 204,
      headers: {'content-length': '0'}
    });

    expect(build(request, response, mockConfig())).toMatchObject({
      responseStatus: 204,
      responseBytes: '0',
      cfRayId: 'ray-123',
      cfCountry: 'US',
      cfVerifiedBotCategory: 'Search Engine Crawler',
      cfBot: true,
      cfBotScore: 1,
      cfVerifiedBot: true,
      cfSignedAgent: true,
      cfJa4: 't13d...',
      cfJsDetectionPassed: true
    });
  });

  it('keeps falsey but defined Bot Management values (does not coerce to null)', () => {
    const request = makeRequest('https://shop.example/', {
      cf: {
        botManagement: {
          score: 0,
          verifiedBot: false,
          signedAgent: false,
          ja4: '',
          jsDetection: {passed: false}
        }
      }
    });

    expect(build(request, new Response(), mockConfig())).toMatchObject({
      cfBotScore: 0,
      cfVerifiedBot: false,
      cfSignedAgent: false,
      cfJa4: '',
      cfJsDetectionPassed: false
    });
  });

  it('nulls undefined Bot Management fields and missing jsDetection', () => {
    const request = makeRequest('https://shop.example/', {
      cf: {botManagement: {}}
    });

    expect(build(request, new Response(), mockConfig())).toMatchObject({
      cfBotScore: null,
      cfVerifiedBot: null,
      cfSignedAgent: null,
      cfJa4: null,
      cfJsDetectionPassed: null
    });
  });

  it('extracts Web Bot Auth covered headers from signature-input', () => {
    const request = makeRequest('https://shop.example/', {
      headers: {
        signature: 'sig1=:abc:',
        'signature-agent': '"https://validator.example"',
        'signature-input': 'sig1=("@authority" "signature-agent");created=1'
      }
    });
    const payload = build(request, new Response(), mockConfig());

    expect(payload.webBotAuthSignature).toBe('sig1=:abc:');
    expect(payload.webBotAuthSignatureAgent).toBe('"https://validator.example"');
    expect(payload.webBotAuthSignatureInput).toBe('sig1=("@authority" "signature-agent");created=1');
    expect(JSON.parse(payload.webBotAuthCoveredHeaders)).toEqual({
      '@authority': null,
      'signature-agent': '"https://validator.example"'
    });
  });

  it('supports signature=(...) form in signature-input', () => {
    const request = makeRequest('https://shop.example/', {
      headers: {
        'signature-input': 'signature=("content-type");alg=ed25519',
        'content-type': 'application/json'
      }
    });

    expect(JSON.parse(build(request, new Response(), mockConfig()).webBotAuthCoveredHeaders)).toEqual({
      'content-type': 'application/json'
    });
  });

  it('nulls out headers that are missing from signature-input', () => {
    const request = makeRequest('https://shop.example/', {
      headers: {
        'signature-input': 'signature=("content-type" "missing-header");alg=ed25519',
        'content-type': 'application/json'
      }
    });

    expect(JSON.parse(build(request, new Response(), mockConfig()).webBotAuthCoveredHeaders)).toEqual({
      'content-type': 'application/json',
      'missing-header': null
    });
  });

  it('returns {} for unparseable signature-input', () => {
    const request = makeRequest('https://shop.example/', {
      headers: {'signature-input': 'not-a-valid-input'}
    });
    expect(build(request, new Response(), mockConfig()).webBotAuthCoveredHeaders).toBe('{}');
  });

  it('returns {} when signature-input is empty', () => {
    const request = makeRequest('https://shop.example/', {
      headers: {'signature-input': ''}
    });
    // Empty string is falsy in extractWebBotAuthCoveredHeaders.
    expect(build(request, new Response(), mockConfig()).webBotAuthCoveredHeaders).toBe('{}');
    expect(build(request, new Response(), mockConfig()).webBotAuthSignatureInput).toBeNull();
  });

  it('uses an empty user-agent string when the header is absent', () => {
    const request = makeRequest('https://shop.example/');
    expect(build(request, new Response(), mockConfig()).userAgent).toBe('');
  });

  it('uses null for a missing cf-connecting-ip', () => {
    const request = makeRequest('https://shop.example/');
    expect(build(request, new Response(), mockConfig()).ipAddress).toBeNull();
  });

  it('falls back to the cf-ray response header when request.cf.rayId is missing', () => {
    const request = makeRequest('https://shop.example/');
    const response = new Response(null, {
      headers: {'cf-ray': 'ray-from-header'}
    });

    expect(build(request, response, mockConfig()).cfRayId).toBe('ray-from-header');
  });

  it('prefers request.cf.rayId over the cf-ray response header', () => {
    const request = makeRequest('https://shop.example/', {
      cf: {rayId: 'ray-from-cf'}
    });
    const response = new Response(null, {
      headers: {'cf-ray': 'ray-from-header'}
    });

    expect(build(request, response, mockConfig()).cfRayId).toBe('ray-from-cf');
  });
});
