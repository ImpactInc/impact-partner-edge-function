# Impact.com Cloudflare Edge Function

Welcome to the Impact.com Cloudflare Edge Function! Here you'll have access to the source code, as well as tools for
local development, testing, and deployment.

This Worker sends AI Telemetry data on your behalf to Impact.com when a
chatbot is detected. As the end user, you can run this out of the box by setting the minimal configuration values, or
if you want to customize the behavior, you can modify the source code and deploy your own version of the Worker.

## Getting and updating this Worker

**Fork this repository** and work from your fork. You control which version is live and when it
changes.

Choose one of three deployment options:

1. [Manual installation](#manual-installation-in-cloudflare) using Wrangler on your machine.
2. [Cloudflare Workers Builds](#cloudflare-workers-builds) through the Cloudflare dashboard.
3. [GitHub Actions](#github-actions) using a workflow in your fork.

### Required deployment configuration

For any deployment option, you need:

- A Cloudflare account with permission to deploy this Worker
- An Impact.com account ID and auth token

`src/config.js` reads these bindings from the Worker `env` object. Sensitive values must be Cloudflare Worker secrets,
not `vars` in `wrangler.toml` or `wrangler.jsonc`.

| Binding                 | Required                    | Secret?     | Purpose                                                                                                                        |
|-------------------------|-----------------------------|-------------|--------------------------------------------------------------------------------------------------------------------------------|
| `IMPACT_AUTH_TOKEN`     | Yes, for telemetry          | Yes         | Authentication token sent to `https://trkapi.impact.com/telemetry/crawler-visits`. If unset, the Worker logs an error and never posts. |
| `IMPACT_ACCOUNT_ID`     | Yes, for a complete payload | Recommended | Impact account ID included on each telemetry event as `accountId`.                                                             |

Set these runtime secrets using either the Cloudflare dashboard or Wrangler; you do not need to use both.

Optional debug settings are covered under [Environment variables](#environment-variables) in Local development.

#### Set secrets in the Cloudflare dashboard

Once the Worker has been created (for example, by the first Workers Builds deployment):

1. In the [Cloudflare dashboard](https://dash.cloudflare.com), go to **Workers & Pages** and select this Worker.
2. Open **Settings** → **Variables and Secrets** and select **Add**.
3. Select type **Secret**, enter `IMPACT_AUTH_TOKEN` as the variable name, and enter your Impact auth token as its value.
4. Select **Add variable** and add `IMPACT_ACCOUNT_ID` as another **Secret**, using your Impact account ID as its value.
5. Select **Deploy** to apply both secrets.

These are **Worker runtime secrets**, not the **Build variables and secrets** under **Settings** → **Build**.
Build secrets are available only during the build and do not populate the Worker's runtime `env` bindings.
See Cloudflare's [dashboard secret instructions](https://developers.cloudflare.com/workers/configuration/secrets/#via-the-dashboard).

#### Set secrets with Wrangler

Using Wrangler, you can set secrets before or after the first Worker deployment. Wrangler prompts for the value; do not pass it on the command line:

```bash
npx wrangler secret put IMPACT_AUTH_TOKEN
npx wrangler secret put IMPACT_ACCOUNT_ID
```

`wrangler secret put` creates a new Worker version and deploys it.

If you use [gradual deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/), use `npx wrangler versions secret put <KEY>` instead, then deploy that version separately.

List configured secrets:

```bash
npx wrangler secret list
```

### Manual Installation in Cloudflare

With Node.js 22.13.0 or later and npm installed, install the dependencies:

```bash
npm ci
```

Use `npm i` instead of `npm ci` if you are not working from the lockfile.

Authenticate Wrangler using either a Cloudflare API token or interactive login. Authentication is required for
`npm run deploy` and for remote-mode features that talk to your Cloudflare account.

To use an API token, set `CLOUDFLARE_API_TOKEN` in the shell where you will run Wrangler:

```bash
export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
```

Use a token with permission to deploy this Worker. Keep it secret: do not commit it or add it as a Worker binding.

Alternatively, use interactive authentication to sign in to Cloudflare through your browser:

```bash
npm run login
```

Deploy the Worker, setting the [required secrets](#required-deployment-configuration) before or after the first deploy:

```bash
npm run deploy
```

Validate the bundle without publishing:

```bash
npm run build
```

That runs `wrangler deploy --dry-run --outdir dist` and writes `dist/index.js`.

### Cloudflare Workers Builds

Cloudflare runs the build and deploy commands for you; no local Node.js, npm, or Wrangler installation is required.

To deploy automatically from your fork, in the [Cloudflare dashboard](https://dash.cloudflare.com), go to
**Compute** → **Workers & Pages** → **Create application** → **Continue with GitHub** and select your fork. Set the build command to `npm ci`
and the deploy command to `npx wrangler deploy`. Cloudflare then rebuilds and redeploys on every
push to your fork's `main`.

After the first deployment, [set the required runtime secrets in the dashboard](#set-secrets-in-the-cloudflare-dashboard).
Complete this step before relying on the Worker to send telemetry.

### GitHub Actions

`.github/workflows/deploy.yml` is a working example. It is manual trigger only.
Add `CLOUDFLARE_API_TOKEN` as a [repository secret](https://docs.github.com/en/actions/concepts/security/secrets) and `CLOUDFLARE_ACCOUNT_ID` as a repository
variable, then run it from the Actions tab. Adapt it freely, or move the same three steps
(`npm ci`, `npm test`, `npx wrangler deploy`) to any other runner.

See Cloudflare's [Workers roles and permissions](https://developers.cloudflare.com/workers/authorization/workers/) for details on required authorization for deploying Cloudflare Workers.

## Standalone Worker vs Service Bindings

This Worker is a `WorkerEntrypoint` (`ImpactTelemetry` in `src/index.js`). It supports two
deployment shapes on the same codebase.

### Standalone (no other Worker on the route)

Deploy this Worker with a route. Incoming requests hit `fetch()`, which proxies to origin and then
reports eligible chatbot HTML visits.

### Service binding (another Worker already owns the route)

Cloudflare allows one Worker per route. If the route already has a Worker, [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) can be used to call this Worker from the Worker that owns the route.

Caller `wrangler.toml` (or `wrangler.jsonc`):

```toml
[[services]]
binding = "IMPACT"
service = "impact-partner-edge-function"
```

Caller Worker — fetch origin (or produce a response), then pass both into RPC `handle()`. Do **not**
call `env.IMPACT.fetch(request)` from that Worker: `fetch` always retrieves origin itself, which
routes back to the caller and loops.

```js
export default {
  async fetch(request, env) {
    // Only paying attention to GET requests
    if (request.method !== 'GET') {
      return fetch(request);
    }

    const response = await fetch(request);
    return env.IMPACT.handle(request, response);
  }
};
```

`handle()` does not fetch origin. It returns the response the caller should send to the client: the
original, or the debug curl body when `IMPACT_DEBUG` is enabled and the request path matches
`IMPACT_DEBUG_ENDPOINT`. Request and Response are valid RPC types; passing `response` transfers
ownership of its body stream.

Secrets (`IMPACT_AUTH_TOKEN`, `IMPACT_ACCOUNT_ID`) are configured on **this** Worker, not on the
caller.

Locally, run both Workers so the binding can connect. Either start two `wrangler dev` processes, or
one process with multiple configs (first config is the HTTP-facing Worker):

```bash
npx wrangler dev -c ../your-site/wrangler.toml -c ./wrangler.toml
```

## Local development

### Prerequisites

- Node.js 22.13.0 or later
- npm

### Install

Follow the dependency installation steps in [Manual Installation in Cloudflare](#manual-installation-in-cloudflare).
Wrangler authentication is only needed for deployment and remote-mode features, not local development.

Create a `.dev.vars` file in the project root with the same names the Worker reads from `env` (see
[Required configuration](#required-deployment-configuration) and [Environment variables](#environment-variables)). Wrangler loads
this file for `wrangler dev`. Do not commit it; it is in `.gitignore`.

```bash
IMPACT_ACCOUNT_ID=your-impact-account-id
IMPACT_AUTH_TOKEN=your-impact-auth-token
IMPACT_DEBUG=true
IMPACT_DEBUG_ENDPOINT=/impactDebug
```

Start the local Worker:
```bash
npm run dev
```

This runs `wrangler dev`. Requests are handled locally; origin `fetch(request)` still goes to the URL on the incoming
request.

With `IMPACT_DEBUG` enabled, set `IMPACT_DEBUG_ENDPOINT` to a path (for example `/impactDebug`). A chatbot request to
that path returns the telemetry curl commands as plain text instead of posting. Other chatbot HTML requests log that
output and still schedule the telemetry post. If `IMPACT_DEBUG_ENDPOINT` is unset, debug only logs; it never replaces
the response.

Stream production logs after deploy:
```bash
npm run tail
```

### Tests

```bash
npm t
```

That runs the Node unit tests and a Workers-runtime Service Binding suite (`test/workers/`) that
calls `env.IMPACT.handle` across two Workers.

Watch mode:

```bash
npm run test:watch
```

### Coverage

```bash
npm run coverage
```

This runs the Node unit tests with V8 coverage over `src/**/*.js`. Text output is printed in the
terminal; HTML and LCOV reports are written to `coverage/`. The Workers-runtime Service Binding
suite is excluded because coverage instrumentation cannot run inside `workerd`.

### Environment variables

These optional bindings control debugging. For the credentials needed to send telemetry, see
[Required configuration](#required-deployment-configuration).

| Binding                 | Required                    | Secret?     | Purpose                                                                                                                        |
|-------------------------|-----------------------------|-------------|--------------------------------------------------------------------------------------------------------------------------------|
| `IMPACT_DEBUG`          | No                          | No          | Enables debug logging and, when `IMPACT_DEBUG_ENDPOINT` is also set, the debug response. Treated as true when the value is `true`, `"true"`, `1`, or `"1"`. |
| `IMPACT_DEBUG_ENDPOINT` | No                          | No          | Request pathname that returns debug curl output instead of posting telemetry (for example `/impactDebug`). Ignored unless `IMPACT_DEBUG` is true. Empty when unset. |

`IMPACT_DEBUG` and `IMPACT_DEBUG_ENDPOINT` are not sensitive. Prefer a Wrangler variable so you can change it without
having to store it in a secret. Example in `wrangler.toml`:

```toml
# wrangler.toml
[vars]
IMPACT_DEBUG = "false"
# Request pathname that returns curl debug output when IMPACT_DEBUG is true.
IMPACT_DEBUG_ENDPOINT = "/impactDebug"
```

Or set it only in `.dev.vars` for local use.
