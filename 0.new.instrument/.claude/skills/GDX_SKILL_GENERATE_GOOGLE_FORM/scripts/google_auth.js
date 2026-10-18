/**
 * Local OAuth2 bootstrap for Google Forms API access -- kept local to this
 * skill (duplicated, not imported from a sibling skill), per this project's
 * convention that every skill is fully self-contained.
 *
 * First run: no token file yet -> prints a consent URL, starts a short-lived
 * local HTTP server on a loopback port to catch the OAuth redirect, exchanges
 * the authorization code for tokens, and saves them to GOOGLE_OAUTH_TOKEN_PATH.
 * Every run after that: loads the saved token and lets google-auth-library
 * silently refresh the access token as needed -- no browser involved again.
 *
 * Requires an OAuth 2.0 Client ID of type "Desktop app" in Google Cloud
 * Console (see this skill's SKILL.md "One-time authorization" section) --
 * that client type is pre-authorized by Google for any http://127.0.0.1:<port>
 * redirect per RFC 8252, so no redirect URI needs registering by hand.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const { google } = require('googleapis');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env, ` +
      `fill it in, and export the vars before running this script. Never hardcode ` +
      `credentials in this file or anywhere in the repo.`
    );
  }
  return v;
}

/** Resolves GOOGLE_OAUTH_TOKEN_PATH relative to the current working directory,
 * falling back to ./google_token.json if unset. Point this at the same file
 * GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS uses if you'd rather authorize once and
 * share the token than do the consent flow twice -- see this skill's SKILL.md. */
function resolveTokenPath() {
  const configured = process.env.GOOGLE_OAUTH_TOKEN_PATH;
  return configured ? path.resolve(configured) : path.join(process.cwd(), 'google_token.json');
}

function runConsentFlow(oAuth2Client, scopes, tokenPath) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      (async () => {
        try {
          const url = new URL(req.url, 'http://127.0.0.1');
          if (url.pathname !== '/') { res.writeHead(404).end(); return; }
          const errorParam = url.searchParams.get('error');
          if (errorParam) {
            res.writeHead(200, { 'Content-Type': 'text/plain' })
              .end(`Authorization denied (${errorParam}). You can close this tab.`);
            server.close();
            reject(new Error(`Google OAuth consent was denied or failed: ${errorParam}`));
            return;
          }
          const code = url.searchParams.get('code');
          if (!code) { res.writeHead(400).end('Missing authorization code.'); return; }
          res.writeHead(200, { 'Content-Type': 'text/plain' })
            .end('Authorization complete. You can close this tab and return to the terminal.');
          server.close();

          const { tokens } = await oAuth2Client.getToken({ code, redirect_uri: oAuth2Client.redirectUri });
          oAuth2Client.setCredentials(tokens);
          fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
          fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
          console.log(`\nSaved Google OAuth token to ${tokenPath} -- future runs will not need the browser again.`);
          resolve(oAuth2Client);
        } catch (err) {
          reject(err);
        }
      })();
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}`;
      oAuth2Client.redirectUri = redirectUri;
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
        redirect_uri: redirectUri,
      });
      console.log('\nOne-time Google authorization needed. Open this URL in your browser and approve access:\n');
      console.log(authUrl);
      console.log('\nWaiting for you to complete the consent screen (this terminal continues automatically once you do)...');
    });

    server.on('error', reject);
  });
}

/** Returns an authorized OAuth2 client ready to pass to google.forms({auth}).
 * `scopes` is this script's own minimum required scope list -- only used if a
 * fresh consent flow is actually needed; an existing saved token is reused
 * as-is with whatever scopes it already carries, so a token shared with a
 * sibling skill keeps working even if that sibling asked for a broader scope
 * set when it was first created. */
async function getAuthorizedClient(scopes) {
  const clientId = requireEnv('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_OAUTH_CLIENT_SECRET');
  const tokenPath = resolveTokenPath();

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);

  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    oAuth2Client.setCredentials(token);
    // Persist a refreshed access token back to disk so the next run reuses it
    // instead of spending a refresh on every single invocation.
    oAuth2Client.on('tokens', (newTokens) => {
      const merged = { ...token, ...newTokens };
      fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
    });
    return oAuth2Client;
  }

  return runConsentFlow(oAuth2Client, scopes, tokenPath);
}

module.exports = { getAuthorizedClient, resolveTokenPath, requireEnv };
