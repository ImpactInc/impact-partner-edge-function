import {withAuthBearerToken} from './auth';

const packageJson = require('../package.json');
const IMPACT_TELEMETRY_URL = 'https://trkapi.impact.com/telemetry/crawler-visits';

/**
 * Get our configuration from the environment variables.
 *
 * @param {{IMPACT_ACCOUNT_ID: String, IMPACT_DEBUG: String|Number|Boolean, IMPACT_AUTH_TOKEN: String}} env
 * @returns {{ACCOUNT_ID: *, DEBUG: Boolean, TELEMETRY_APIS: {url: *|(function(): *), method: function(*): *, headers: function(*, *): *&{Authorization: String}, body: function(*): String}[]|*[], VERSION: String}}
 */
export default function(env) {
  return {
    ACCOUNT_ID: env.IMPACT_ACCOUNT_ID,
    DEBUG: isTruthy(env.IMPACT_DEBUG),
    TELEMETRY_APIS: env.IMPACT_AUTH_TOKEN
      ? [withAuthBearerToken(IMPACT_TELEMETRY_URL, env.IMPACT_AUTH_TOKEN)]
      : [],
    VERSION: packageJson.version
  };
}

function isTruthy(value) {
  return value === true
    || value === 'true'
    || value === 1
    || value === '1';
}
