/**
 * Resolves the "origin" identifier written into CONFIRMATION_BY -- the
 * public IP address of the machine running this sync, per the brief: a
 * mapping row's NUMBER_CONFIRMATIONS only goes up when the push comes from
 * a different IP than whoever confirmed it last; the same origin pushing
 * again (e.g. a second run right after the first, or no real network
 * change) must not inflate the count.
 */

const https = require('https');

function fetchPublicIp(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const trimmed = body.trim();
          // https://api.ipify.org?format=json -> {"ip":"1.2.3.4"}
          // https://ifconfig.me/ip or https://icanhazip.com -> plain text
          const parsed = trimmed.startsWith('{') ? JSON.parse(trimmed).ip : trimmed;
          if (!parsed) return reject(new Error(`No IP in response from ${url}: ${trimmed}`));
          resolve(parsed);
        } catch (err) {
          reject(new Error(`Could not parse IP from ${url}: ${err.message}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`Timed out calling ${url}`)));
    req.on('error', reject);
  });
}

/** GDX_SYNC_ORIGIN_IP in .env always wins (no network call, no ambiguity).
 * Otherwise tries two independent IP-echo services in turn so one outage
 * doesn't block every sync. Throws if neither can be reached -- the
 * confirmation increment logic has no safe default to fall back to, so a
 * sync that cannot determine its own origin must stop rather than guess. */
async function resolveOriginIp(env = process.env) {
  if (env.GDX_SYNC_ORIGIN_IP && env.GDX_SYNC_ORIGIN_IP.trim()) {
    return env.GDX_SYNC_ORIGIN_IP.trim();
  }
  const services = ['https://api.ipify.org?format=json', 'https://icanhazip.com'];
  const errors = [];
  for (const url of services) {
    try {
      return await fetchPublicIp(url);
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  throw new Error(
    'Could not determine this machine\'s public IP (needed for CONFIRMATION_BY) and '
    + `GDX_SYNC_ORIGIN_IP is not set in .env. Tried:\n  ${errors.join('\n  ')}`,
  );
}

module.exports = { resolveOriginIp };
