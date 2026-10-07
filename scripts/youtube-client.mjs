// Derived from the recovered May 17 create-playlist script; see archive/session-recovery.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function profileName(value = 'default') {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(value)) {
    throw new Error('Profile must be 1–64 letters, digits, dots, underscores or hyphens.');
  }
  return value;
}

export const dataDirectory = path.join(
  process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'field-rf-lab'
);

export function tokenPath(profile) {
  return path.join(dataDirectory, 'youtube-oauth-token-' + profileName(profile) + '.json');
}

export async function writePrivate(file, contents) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    await fs.writeFile(temporary, contents, { mode: 0o600, flag: 'wx' });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

export function credentials(env = process.env) {
  let value;
  try { value = JSON.parse(env.GOOGLE_OAUTH_CLIENT_JSON || 'null'); }
  catch { throw new Error('GOOGLE_OAUTH_CLIENT_JSON is not valid JSON.'); }
  const client = value?.installed || value || {};
  if (value?.web) throw new Error('Use a TVs and Limited Input devices OAuth client, not Web.');
  if (!client.client_id || !client.client_secret) {
    throw new Error('Missing OAuth client. Use bash scripts/youtube-playlists.sh.');
  }
  return { client_id: client.client_id, client_secret: client.client_secret };
}

export class OAuthError extends Error {
  constructor(status, code) {
    // Never expose response bodies, tokens or client secrets.
    const safeCode = /^[a-z_]+$/.test(code || '') ? code : 'request_failed';
    super('Google OAuth failed (HTTP ' + status + ', ' + safeCode + ').');
    this.code = safeCode;
  }
}

export class OAuth {
  constructor(client, profile, {
    fetchImpl = globalThis.fetch, file = tokenPath(profile),
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    now = Date.now, log = console.error
  } = {}) {
    this.client = client;
    this.profile = profileName(profile);
    this.fetch = fetchImpl;
    this.file = file;
    this.sleep = sleep;
    this.now = now;
    this.log = log;
  }

  async post(endpoint, fields) {
    let response;
    try {
      response = await this.fetch('https://oauth2.googleapis.com/' + endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields), signal: AbortSignal.timeout(30000)
      });
    } catch { throw new Error('Google OAuth network request failed.'); }
    let result;
    try { result = await response.json(); }
    catch { throw new Error('Google OAuth returned an invalid response.'); }
    if (!response.ok) throw new OAuthError(response.status, result.error);
    return result;
  }

  async load() {
    try { return JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return null;
      throw new Error('Saved token is unreadable or invalid. Run logout, then login.');
    }
  }

  async save(token) {
    if (!token.refresh_token) throw new Error('No refresh token issued; saved token not changed.');
    await writePrivate(this.file, JSON.stringify({
      ...token, client_id: this.client.client_id
    }, null, 2) + '\n');
  }

  async login() {
    const device = await this.post('device/code', {
      client_id: this.client.client_id,
      scope: 'https://www.googleapis.com/auth/youtube'
    });
    const url = device.verification_url || device.verification_uri;
    if (!device.device_code || !device.user_code || !url || !device.expires_in) {
      throw new Error('Invalid Google device-code response.');
    }
    this.log('Open ' + url + '\nCode: ' + device.user_code +
      '\nProfile: ' + this.profile + '\nSelect the intended YouTube/Brand channel.');
    const deadline = this.now() + device.expires_in * 1000;
    let interval = (device.interval || 5) * 1000;
    while (this.now() < deadline) {
      await this.sleep(interval);
      if (this.now() >= deadline) break;
      let token;
      try {
        token = await this.post('token', {
          ...this.client, device_code: device.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        });
      } catch (error) {
        if (error.code === 'authorization_pending') continue;
        if (error.code === 'slow_down') { interval += 5000; continue; }
        throw error;
      }
      if (!token.access_token) throw new Error('Google returned no access token.');
      await this.save(token);
      return token.access_token;
    }
    throw new Error('OAuth device code expired. Run login again.');
  }

  async accessToken() {
    const cached = await this.load();
    if (!cached?.refresh_token) {
      throw new Error('No saved login for profile ' + this.profile + '. Run login first.');
    }
    if (cached.client_id && cached.client_id !== this.client.client_id) {
      throw new Error('Saved token belongs to a different OAuth client. Run login again.');
    }
    let fresh;
    try {
      fresh = await this.post('token', {
        ...this.client, refresh_token: cached.refresh_token, grant_type: 'refresh_token'
      });
    } catch (error) {
      if (error.code === 'invalid_grant') throw new Error('Saved login expired. Run login again.');
      throw error;
    }
    if (!fresh.access_token) throw new Error('Google returned no access token.');
    await this.save({ ...fresh, refresh_token: fresh.refresh_token || cached.refresh_token });
    return fresh.access_token;
  }
}

export class YouTube {
  constructor(token, fetchImpl = globalThis.fetch) {
    this.token = token;
    this.fetch = fetchImpl;
  }

  async request(method, resource, params, body) {
    const url = new URL('https://www.googleapis.com/youtube/v3/' + resource);
    url.search = new URLSearchParams(params).toString();
    let response;
    try {
      response = await this.fetch(url, {
        method, headers: { Authorization: 'Bearer ' + this.token,
          'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
      });
    } catch {
      throw new Error('YouTube ' + method + ' ' + resource +
        ' network failure. Writes are not retried; their outcome may be unknown.');
    }
    if (!response.ok) {
      throw new Error('YouTube ' + method + ' ' + resource +
        ' failed (HTTP ' + response.status + '). Check quota, access and API enablement.');
    }
    try { return response.status === 204 ? {} : await response.json(); }
    catch { throw new Error('YouTube returned an invalid response; inspect any started write.'); }
  }

  async owner(expectedId) {
    const result = await this.request('GET', 'channels', { part: 'snippet', mine: 'true' });
    if (result.items?.length !== 1) {
      throw new Error('Expected one authorized YouTube channel. Sign in to the intended channel.');
    }
    const channel = result.items[0];
    if (expectedId && channel.id !== expectedId) {
      throw new Error('Wrong channel: ' + channel.snippet.title + ' (' + channel.id +
        '), expected ' + expectedId + '. No playlist changes made.');
    }
    return { id: channel.id, title: channel.snippet.title };
  }
}
