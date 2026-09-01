# Impact Partner Edge Function

Pre-built Cloudflare Worker for Impact partner telemetry. Published automatically from Impact's private source repository.

## Quick Start

1. **Fork** this repository
2. Connect your fork to [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
3. Add your `IMPACT_AUTH_TOKEN` as a Worker secret in Cloudflare
4. Cloudflare auto-deploys when you sync your fork with new versions

## What's Here

| File | Purpose |
|---|---|
| `worker.js` | Pre-built Worker bundle — deployed as-is |
| `wrangler.jsonc` | Example Wrangler config — customize for your setup |

## Updating

When Impact publishes a new version, a tag (e.g., `v1.0.0`) appears on this repo. To update:

- **GitHub UI**: Click "Sync fork" on your fork's page
- **CLI**: `git fetch upstream && git merge upstream/main`

Review the changes and let Cloudflare Workers Builds deploy automatically, or deploy manually with:

```bash
npx wrangler deploy --no-bundle --config wrangler.jsonc
```

## Configuration

Copy `wrangler.jsonc` to your fork and customize:

- `name` — your worker name in Cloudflare
- Routes, domains, and bindings as needed

The `IMPACT_AUTH_TOKEN` secret must be set directly in Cloudflare, not in this repository.