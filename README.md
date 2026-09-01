# Impact.com CloudFlare Edge Function

Welcome to the Impact.com CloudFlare Edge Function! Here you'll have access to the source code, as well as tools for
local development, testing, and deployment. This Worker sends AI Telemetry data on your behalf to Impact.com when a
chatbot is detected. As the end user, you can run this out of the box by setting the minimal configuration values, or
if you want to customize the behavior, you can modify the source code and deploy your own version of the Worker.

## Prerequisites

- Node.js 22.13.0 or later
- npm
- A Cloudflare account with permission to deploy this Worker
- An Impact.com account ID and telemetry auth token

## Install

```bash
npm ci
```

Use `npm i` instead of `npm ci` if you are not working from the lockfile.

Authenticate Wrangler once per machine with via `login` or by setting `CF_API_TOKEN` in your environment. This is
required for `npm run deploy` and for remote-mode features that talk to your Cloudflare account.

```bash
npm run login
```

## Local development

Create a `.dev.vars` file in the project root with the same names the Worker reads from `env` (see
[Environment variables](#environment-variables)). Wrangler loads this file for `wrangler dev`. Do not commit it; it is
in `.gitignored`.

```bash
IMPACT_ACCOUNT_ID=your-impact-account-id
IMPACT_AUTH_TOKEN=your-impact-auth-token
IMPACT_DEBUG=true
```

Start the local Worker:
```bash
npm run dev
```

This runs `wrangler dev`. Requests are handled locally; origin `fetch(request)` still goes to the URL on the incoming
request.

With `IMPACT_DEBUG` enabled, a chatbot request to `/impactDebug` returns the telemetry curl commands as plain text
instead of posting. Other chatbot HTML requests log that output and still schedule the telemetry post.

Stream production logs after deploy:
```bash
npm run tail
```

## Tests

```bash
npm t
```

Watch mode:

```bash
npm run test:watch
```

## Coverage

```bash
npm run coverage
```

This runs the Vitest suite with V8 coverage over `src/**/*.js`. Text output is printed in the terminal; HTML and LCOV
reports are written to `coverage/`.

## Deploy

Set secrets on the deployed Worker before or after the first deploy (see
[Environment variables](#environment-variables)). Then:

```bash
npm run deploy
```

Validate the bundle without publishing:

```bash
npm run build
```

That runs `wrangler deploy --dry-run --outdir dist` and writes `dist/index.js`.

`wrangler secret put` creates a new Worker version and deploys it. If you use gradual deployments, use
`npx wrangler versions secret put <KEY>` instead, then deploy that version separately.

## Environment variables

`src/config.js` reads these bindings from the Worker `env` object. Sensitive values must be Cloudflare Worker secrets,
not `vars` in `wrangler.jsonc`.

| Binding             | Required                    | Secret?     | Purpose                                                                                                                        |
|---------------------|-----------------------------|-------------|--------------------------------------------------------------------------------------------------------------------------------|
| `IMPACT_AUTH_TOKEN` | Yes, for telemetry          | Yes         | Bearer token sent to `https://trkapi.impact.com/telemetry/crawler-visits`. If unset, the Worker logs an error and never posts. |
| `IMPACT_ACCOUNT_ID` | Yes, for a complete payload | Recommended | Impact account ID included on each telemetry event as `accountId`.                                                             |
| `IMPACT_DEBUG`      | No                          | No          | Enables debug logging and the `/impactDebug` response. Treated as true when the value is `true`, `"true"`, `1`, or `"1"`.      |

Set secrets interactively (Wrangler prompts for the value; do not pass it on the command line):

```bash
npx wrangler secret put IMPACT_AUTH_TOKEN
npx wrangler secret put IMPACT_ACCOUNT_ID
```

`IMPACT_DEBUG` is not sensitive. Prefer a Wrangler variable so you can toggle it without storing it as a secret:

```jsonc
// wrangler.jsonc
"vars": {
  "IMPACT_DEBUG": "false"
}
```

Or set it only in `.dev.vars` for local use.

List configured secrets:

```bash
npx wrangler secret list
```

## Getting and updating this Worker

**Fork this repository** and work from your fork. You control which version is live and when it
changes.

### Deploying from a fork

The `npm run deploy` flow above works from any machine with Wrangler authenticated. Two other
options avoid running deploys by hand:

**Cloudflare Workers Builds** — in the [Cloudflare dashboard](https://dash.cloudflare.com), go to
Workers & Pages → Create → Connect to Git and select your fork. Set the build command to `npm ci`
and the deploy command to `npx wrangler deploy`. Cloudflare then rebuilds and redeploys on every
push to your fork's `main`.

**GitHub Actions** — `.github/workflows/deploy.yml` is a working example. It is manual trigger only.
Add `CLOUDFLARE_API_TOKEN` as a repository secret and `CLOUDFLARE_ACCOUNT_ID` as a repository
variable, then run it from the Actions tab. Adapt it freely, or move the same three steps
(`npm ci`, `npm test`, `npx wrangler deploy`) to any other runner.

The Cloudflare API token needs Account → Worker Scripts: Edit, plus Zone → Workers Routes: Edit and
Zone → Zone: Read if you are using a custom domain.
