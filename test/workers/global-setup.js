import {execSync} from 'node:child_process';

export default function() {
  execSync('npx wrangler deploy --dry-run --outdir dist', {stdio: 'inherit'});
}
