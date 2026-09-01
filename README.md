# Impact Partner Edge Function

Pre-built Cloudflare Worker for Impact partner telemetry. Published automatically from Impact's private source repository.

## Deployment Options

### Option A: Cloudflare Workers Builds (recommended)

The simplest approach — Cloudflare deploys automatically when your fork is updated.

1. **Fork** this repository
2. Go to the [Cloudflare dashboard](https://dash.cloudflare.com) → Workers & Pages → Create → Connect to Git
3. Select your fork and connect it
4. Cloudflare will deploy `index.js` automatically on every push to `main`
5. Add your `IMPACT_AUTH_TOKEN` as a Worker secret in the Cloudflare dashboard

To update: click **"Sync fork"** on your fork's GitHub page. Cloudflare redeploys automatically.

### Option B: GitHub Actions workflow

If you prefer deploying via GitHub Actions, this repo includes an example workflow.

1. **Fork** this repository
2. In your fork's settings, add:
   - Secret: `CLOUDFLARE_API_TOKEN` — your Cloudflare API token with Worker Scripts: Edit permission
   - Variable: `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID
3. Add your `IMPACT_AUTH_TOKEN` as a Worker secret in Cloudflare:
   ```bash
   npx wrangler secret put IMPACT_AUTH_TOKEN --name impact-partner-edge-function
   ```
4. Enable GitHub Actions on your fork
5. The workflow deploys automatically on push to `main`, or you can trigger it manually

To update: sync your fork — the push triggers the deploy workflow.

## What's Here

| File | Purpose |
|---|---|
| `index.js` | Pre-built Worker bundle — deployed as-is, no build step needed |
| `wrangler.jsonc` | Wrangler config — customize for your setup |
| `.github/workflows/deploy.yml` | Example GitHub Actions deploy workflow (Option B) |

## Configuration

Edit `wrangler.jsonc` in your fork to customize:

- `name` — your worker name in Cloudflare
- `workers_dev` — set to `false` if using custom routes
- Add routes, domains, and bindings as needed

The `IMPACT_AUTH_TOKEN` secret must be set directly in Cloudflare, not in this repository. Contact your Impact representative to receive your token.

## Updating

When Impact publishes a new version, your fork will show "X commits behind." To update:

- **GitHub UI**: Click "Sync fork" → "Update branch"
- **CLI**: `git fetch upstream && git merge upstream/main && git push`

## Rolling Back

To revert to a previous version, reset your fork to an earlier tag:

```bash
git reset --hard v0.1.11
git push --force
```
