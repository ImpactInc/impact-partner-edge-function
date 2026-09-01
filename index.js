var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// package.json
var require_package = __commonJS({
  "package.json"(exports, module) {
    module.exports = {
      name: "impact-edge-function-ai-telemetry",
      version: "0.1.14",
      private: true,
      description: "Impact.com's Chatbot Detection Worker, a Cloudflare Worker that detects chatbot traffic for attribution data collection.",
      main: "src/index.js",
      scripts: {
        build: "wrangler deploy --dry-run --outdir dist",
        coverage: "vitest run --coverage",
        dev: "wrangler dev",
        deploy: "wrangler deploy",
        login: "wrangler login",
        tail: "wrangler tail",
        test: "vitest run",
        "test:watch": "vitest"
      },
      devDependencies: {
        "@rolldown/binding-wasm32-wasi": "1.2.1",
        "@vitest/coverage-v8": "^4.1.10",
        vitest: "^4.1.10",
        wrangler: "4.123.0"
      }
    };
  }
});

// src/auth.js
function noAuth(url) {
  return {
    url: typeof url === "function" ? url : () => url,
    method: /* @__PURE__ */ __name((value) => value, "method"),
    headers: /* @__PURE__ */ __name((value) => value, "headers"),
    body: /* @__PURE__ */ __name((payload) => JSON.stringify(payload), "body")
  };
}
__name(noAuth, "noAuth");
function withAuthBearerToken(url, token) {
  return {
    ...noAuth(url),
    headers: /* @__PURE__ */ __name((headers, debug2) => {
      return {
        ...headers,
        "Authorization": `Bearer ${debug2 ? "API_TOKEN_GOES_HERE" : token}`
      };
    }, "headers")
  };
}
__name(withAuthBearerToken, "withAuthBearerToken");

// src/config.js
var packageJson = require_package();
var IMPACT_TELEMETRY_URL = "https://trkapi.impact.com/telemetry/crawler-visits";
function config_default(env) {
  return {
    ACCOUNT_ID: env.IMPACT_ACCOUNT_ID,
    DEBUG: isTruthy(env.IMPACT_DEBUG),
    TELEMETRY_APIS: env.IMPACT_AUTH_TOKEN ? [withAuthBearerToken(IMPACT_TELEMETRY_URL, env.IMPACT_AUTH_TOKEN)] : [],
    VERSION: packageJson.version
  };
}
__name(config_default, "default");
function isTruthy(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}
__name(isTruthy, "isTruthy");

// src/payload.js
function getCloudflarePayload(data, headers) {
  return {
    cfRayId: valueOrNull(data.rayId || headers.get("cf-ray")),
    cfCountry: valueOrNull(data.country),
    cfVerifiedBotCategory: valueOrNull(data.verifiedBotCategory),
    cfBot: valueOrNull(data.bot)
  };
}
__name(getCloudflarePayload, "getCloudflarePayload");
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
__name(getBotPayload, "getBotPayload");
function build(request, response, config) {
  const data = request.cf || {};
  const url = new URL(request.url);
  const userAgent = request.headers.get("user-agent") || "";
  const cloudflarePayload = getCloudflarePayload(data, response.headers);
  const botPayload = getBotPayload(data.botManagement);
  const webBotAuthSignatureInput = request.headers.get("signature-input") || null;
  return {
    accountId: config.ACCOUNT_ID,
    pageUrl: url.href,
    userAgent,
    eventDate: (/* @__PURE__ */ new Date()).toISOString(),
    workerVersion: config.VERSION,
    ipAddress: request.headers.get("cf-connecting-ip") || null,
    responseStatus: response.status,
    responseBytes: response.headers.get("content-length") || null,
    webBotAuthSignature: request.headers.get("signature") || null,
    webBotAuthSignatureAgent: request.headers.get("signature-agent") || null,
    webBotAuthSignatureInput,
    webBotAuthCoveredHeaders: extractWebBotAuthCoveredHeaders(webBotAuthSignatureInput, request.headers),
    ...cloudflarePayload,
    ...botPayload
  };
}
__name(build, "build");
function valueOrNull(value) {
  return value === void 0 ? null : value;
}
__name(valueOrNull, "valueOrNull");
function extractWebBotAuthCoveredHeaders(signatureAgent, headers) {
  if (!signatureAgent) {
    return "{}";
  }
  const match = signatureAgent.match(/(sig(?:\d+)|signature)=\(([^)]*)/);
  if (!match || match.length < 3) {
    return "{}";
  }
  return JSON.stringify(
    match[2].split(" ").map((header) => header.replaceAll('"', "").trim()).reduce((gathered, key) => {
      try {
        gathered[key] = headers.get(key.toLowerCase()) || null;
      } catch (e) {
        gathered[key] = null;
      }
      return gathered;
    }, {})
  );
}
__name(extractWebBotAuthCoveredHeaders, "extractWebBotAuthCoveredHeaders");

// src/debug.js
function buildDebugOutput(config, payload) {
  return config.TELEMETRY_APIS.reduce((gathered, endpoint) => {
    try {
      if (typeof endpoint === "string") {
        endpoint = noAuth(endpoint);
      }
      const url = endpoint.url(payload, true);
      try {
        new URL(url);
      } catch (e) {
        throw new Error(`Invalid URL: ${url}`);
      }
      const body = endpoint.body({ ...payload, responseStatus: 204, responseBytes: 0 }, true);
      const headers = endpoint.headers({
        "Content-Length": new TextEncoder().encode(body).length.toString(),
        "Content-Type": "application/json"
      }, true);
      const curlHeaders = Object.entries(headers).map(([key, value]) => `-H "${key}: ${value}"`).join(" ");
      gathered.push(`curl ${curlHeaders} '${url}'${body ? ` -d '${body}'` : ""}`);
    } catch (e) {
      gathered.push(`Error generating curl command for endpoint[${gathered.length}]: ${e.message}`);
    }
    return gathered;
  }, []);
}
__name(buildDebugOutput, "buildDebugOutput");
function debug(request, config, payload) {
  if (!request) {
    return;
  }
  const output = buildDebugOutput(config, payload);
  const url = new URL(request.url);
  if (url.pathname === "/impactDebug") {
    const body = output.join("\n\n");
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "Content-Length": new TextEncoder().encode(body).length.toString()
      }
    });
  }
  console.debug("Impact.com Telemetry Output:");
  output.forEach((line) => console.debug(line));
  console.debug("-----");
}
__name(debug, "debug");

// src/post.js
function post(config, payload) {
  return Promise.all(
    config.TELEMETRY_APIS.map(async (endpoint) => {
      if (!endpoint) {
        return;
      }
      try {
        if (typeof endpoint === "string") {
          endpoint = noAuth(endpoint);
        }
        const url = endpoint.url(payload);
        new URL(url);
        const method = endpoint.method("POST");
        const body = endpoint.body(payload);
        const headers = endpoint.headers({
          "Content-Length": new TextEncoder().encode(body).length.toString(),
          "Content-Type": "application/json"
        });
        const response = await fetch(url, {
          method,
          headers,
          body
        });
        if (response.status === 530) {
          const errorCode = await response.text();
          console.error(`Impact.com Telemetry Error: 530 ${response.statusText} (${errorCode.trim()})`);
          buildDebugOutput(config, payload).forEach((line) => console.error(line));
          console.error("-----");
          return false;
        } else if (config.DEBUG) {
          console.debug(`Impact.com Telemetry Response: ${response.status} ${response.statusText}`);
          buildDebugOutput(config, payload).forEach((line) => console.debug(line));
          console.debug("-----");
        }
        return response.status >= 200 && response.status < 300;
      } catch (e) {
      }
      return false;
    })
  );
}
__name(post, "post");

// src/chatbot.js
var CHATBOT_PATTERN = new RegExp(
  [
    "amazonbot",
    "applebot-extended",
    "anthropic-ai",
    "claude(bot|-(code|searchbot|user|web))",
    "gemini-deep-research",
    "google-(extended|cloudvertexbot)",
    "xai-grok",
    "grok(bot|-(deepsearch|search))",
    "gptbot",
    "chatgpt-(user|crawler)",
    "oai-(search|ads)bot",
    "perplexity-(user|crawler)",
    "perplexitybot",
    "bytespider"
  ].join("|"),
  "i"
);
function isChatbotUserAgent(request) {
  const cf = request.cf || {};
  const verifiedBot = (cf.botManagement || {}).verifiedBot;
  return cf.bot || verifiedBot || CHATBOT_PATTERN.test(request.headers.get("user-agent") || "");
}
__name(isChatbotUserAgent, "isChatbotUserAgent");

// src/index.js
var index_default = {
  /**
   * @param {Request} request
   * @param {Object} env Worker environment bindings passed into config (secrets, vars).
   * @param {ExecutionContext} ctx
   * @returns {Promise<Response>}
   */
  // eslint-disable-next-line require-await
  async fetch(request, env, ctx) {
    const response = await fetch(request);
    const config = config_default(env);
    if (!Array.isArray(config.TELEMETRY_APIS) || config.TELEMETRY_APIS.length === 0) {
      console.error("No telemetry API URLs provided");
      return response;
    }
    if (!isHtmlResponse(response) || !isChatbotUserAgent(request)) {
      return response;
    }
    const payload = build(request, response, config);
    if (config.DEBUG) {
      const debugResponse = await debug(request, config, payload);
      if (debugResponse) {
        return debugResponse;
      }
    }
    ctx.waitUntil(post(config, payload));
    return response;
  }
};
function isHtmlResponse(response) {
  if (!response || !response.headers) {
    return false;
  }
  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().startsWith("text/html");
}
__name(isHtmlResponse, "isHtmlResponse");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
