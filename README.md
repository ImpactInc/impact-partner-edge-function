# Impact Partner Edge Function

The Cloudflare Worker that Impact.com partners deploy to collect AI/chatbot referral telemetry.

This repository is the public distribution of the Worker. The full source (`src/`) and test suite
(`test/`) are published here — nothing is minified or bundled ahead of time. You can read every line
of code that will run on your edge, run the tests yourself, and let Wrangler bundle it at deploy
time exactly the way we do internally.

## How it works

The Worker sits in front of your site as a pass-through proxy. Every request is forwarded to your
origin unchanged. In parallel, the Worker inspects the request for signals that the visitor arrived
from an AI assistant or chatbot and, when it finds one, posts a small telemetry record to Impact.
If no `IMPACT_AUTH_TOKEN` is configured, telemetry is disabled and the Worker is a plain proxy.

## Deployment

Pick one of the two options below. Both start with **forking this repository** into your own GitHub
account or organisation, so you keep control of what you deploy and when.

### Option A: Cloudflare Workers Builds (recommended)

Cloudflare watches your fork and deploys automatically.

1. **Fork** this repository.
2. Open the [Cloudflare dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** →
   **Connect to Git**, and select your fork.
3. Set the build configuration:
   - **Build command**: `npm ci`
   - **Deploy command**: `npx wrangler deploy`
4. Deploy. Cloudflare installs dependencies, bundles `src/index.js`, and publishes the Worker.
5. Add your token as a Worker secret:
   ```bash
   npx wrangler secret put IMPACT_AUTH_TOKEN
   ```

Every push to your fork's `main` triggers a new build and deploy.

> A GitHub account can only be linked to one Cloudflare account for Workers Builds, which is why you
> connect **your fork** rather than this repository directly.

### Option B: GitHub Actions

Use this if you would rather deploy from GitHub, or want an explicit approval step.

1. **Fork** this repository and enable GitHub Actions on the fork.
2. In your fork's **Settings → Secrets and variables → Actions**, add:
   - Secret `CLOUDFLARE_API_TOKEN` — a Cloudflare API token with **Account → Worker Scripts: Edit**
   - Variable `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID
3. Add your Impact token as a Worker secret:
   ```bash
   npx wrangler secret put IMPACT_AUTH_TOKEN --name impact-partner-edge-function
   ```
4. Go to **Actions → Deploy to Cloudflare → Run workflow**.

The included [`deploy.yml`](.github/workflows/deploy.yml) is an example. It is **manual trigger
only** by design — nothing deploys without you asking for it. Adapt it freely: add an
[environment](https://docs.github.com/en/actions/deployment/targeting-different-environments) with
required reviewers, restrict who can run it, or change the trigger to run on tags.

## What's in this repository

| Path | Purpose |
|---|---|
| `src/` | Worker source code. `src/index.js` is the entry point. |
| `test/` | Vitest suite covering the whole Worker. |
| `wrangler.jsonc` | Wrangler config. **This is yours to customize.** |
| `package.json` / `package-lock.json` | Dependencies and scripts, pinned. |
| `vitest.config.mjs` | Test runner config. |
| `.github/workflows/deploy.yml` | Example manual deploy workflow (Option B). |
| `.github/workflows/test.yml` | Runs the test suite and verifies the Worker bundles. |

`src/`, `test/`, `package.json`, `package-lock.json`, and `vitest.config.mjs` are managed by Impact
and overwritten on each release. `wrangler.jsonc` and everything under `.github/` are never touched,
so your configuration and workflows survive updates.

## Configuration

Edit `wrangler.jsonc` in your fork:

- `name` — the Worker name in your Cloudflare account
- `workers_dev` — set to `false` when you are serving from your own routes or domains
- `routes` / `custom_domain` — where the Worker runs
- `compatibility_date` — leave as published unless you have a reason to change it

`IMPACT_AUTH_TOKEN` is a **Cloudflare Worker secret**, not a repository value. Never commit it.
Contact your Impact representative to obtain it.

## Running locally

Requires Node.js 22.13.0 or later.

```bash
npm ci        # install pinned dependencies
npm test      # run the test suite
npm run build # bundle to dist/index.js without deploying
```

`npm run dev` starts `wrangler dev`, but note that the Worker is a pass-through proxy: it forwards
requests to their original URL, so it only behaves realistically when deployed on a route in front
of a real origin.

## Verifying what you are deploying

Because the real source is published here, you can audit it directly:

- Read `src/` — it is a few hundred lines.
- Run `npm test` to confirm the suite passes on your machine.
- Run `npm run build` and inspect `dist/index.js` to see the exact bundle Wrangler will upload.
- Diff any two releases with `git diff v0.1.14 v0.1.15 -- src/`.

## Updating

Each Impact release lands on `main` here and is tagged `vX.Y.Z`.

- **GitHub UI**: your fork will show "N commits behind" → click **Sync fork** → **Update branch**.
- **CLI**:
  ```bash
  git remote add upstream https://github.com/ImpactInc/impact-partner-edge-function.git
  git fetch upstream
  git merge upstream/main
  git push
  ```

Review the diff before syncing if you want an approval gate. Since only `src/`, `test/`, and the
dependency files change, the diff is a normal code review.

To pin to a specific release instead of tracking `main`, check out the tag in your fork:

```bash
git fetch upstream --tags
git reset --hard v0.1.15
git push --force
```

## Rolling back

Reset your fork to the previous tag and redeploy:

```bash
git fetch upstream --tags
git reset --hard v0.1.14
git push --force
```

With Workers Builds this redeploys automatically; with GitHub Actions, rerun the deploy workflow.
You can also roll back from the Cloudflare dashboard under the Worker's **Deployments** tab.

## Support

Questions, tokens, and access requests go to your Impact representative.
