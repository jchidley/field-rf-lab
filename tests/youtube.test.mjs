import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { credentials, profileName, OAuth, YouTube, writePrivate } from '../scripts/youtube-client.mjs';
import { parseIds, playlistState, createPlaylist, replacePlaylist,
  validateVideos } from '../scripts/youtube-playlist-operations.mjs';
import { runPlaylist, optionsFor } from '../scripts/youtube-cli.mjs';

const channelId = 'UCabcdefghijklmnopqrstuv';
const video1 = 'abcdefghijk';
const video2 = '12345678901';
const playlistId = 'PLabcdefghijklmnop';
const quiet = () => {};
const client = { client_id: 'test-id', client_secret: 'test-secret' };

async function temp(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-youtube-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

function response(value, status = 200) {
  return { ok: status < 400, status, json: async () => value };
}

function fakeAPI({ owner = channelId, failAt, existing = [video1], changeSnapshot = false } = {}) {
  const writes = [];
  const reads = [];
  let snapshots = 0;
  return {
    writes, reads,
    async owner(expected) {
      if (expected && owner !== expected) throw new Error('Wrong channel');
      return { id: owner, title: 'Test channel' };
    },
    async request(method, resource, params, body) {
      if (method !== 'GET') {
        writes.push({ method, resource, params, body });
        if (writes.length === failAt) throw new Error('HTTP 403');
        if (resource === 'playlists') return { id: playlistId, snippet: { channelId: owner } };
        return {};
      }
      reads.push({ resource, params });
      if (resource === 'videos') return {
        items: params.id.split(',').map(id => ({ id }))
      };
      if (resource === 'playlists') {
        snapshots++;
        return { items: [{ id: playlistId,
          snippet: { channelId: owner, title: changeSnapshot && snapshots > 1 ? 'changed' : 'original' },
          status: { privacyStatus: 'private' }
        }] };
      }
      return { items: existing.map((videoId, i) => ({
        id: 'item-' + i, snippet: { resourceId: { videoId }, position: i }
      })) };
    }
  };
}

test('profile names cannot collide by silent sanitizing or escape the cache', () => {
  for (const value of ['../x', 'x/y', '', 'x y', 'x'.repeat(65)]) {
    assert.throws(() => profileName(value));
  }
  assert.equal(profileName('radio-study'), 'radio-study');
});

test('credentials support historical flat and downloaded installed formats', () => {
  assert.deepEqual(credentials({ GOOGLE_OAUTH_CLIENT_JSON: JSON.stringify(client) }), client);
  assert.deepEqual(credentials({ GOOGLE_OAUTH_CLIENT_JSON: JSON.stringify({ installed: client }) }), client);
  assert.throws(() => credentials({ GOOGLE_OAUTH_CLIENT_JSON: '{invalid secret' }), /valid JSON/);
  assert.throws(() => credentials({ GOOGLE_OAUTH_CLIENT_JSON: JSON.stringify({ web: client }) }), /not Web/);
});

test('ID validation is strict and ordered deduplication is preserved', () => {
  assert.deepEqual(parseIds(video2 + '\n' + video1 + '\n' + video2), [video2, video1]);
  for (const value of ['', 'short', 'https://youtube.com/watch?v=' + video1]) {
    assert.throws(() => parseIds(value), /11-character/);
  }
});

test('private writes are atomic and owner-only', async t => {
  const directory = await temp(t);
  const file = path.join(directory, 'private', 'token.json');
  await writePrivate(file, 'one');
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(path.dirname(file))).mode & 0o777, 0o700);
  await writePrivate(file, 'two');
  assert.equal(await fs.readFile(file, 'utf8'), 'two');
  assert.deepEqual(await fs.readdir(path.dirname(file)), ['token.json']);
});

test('OAuth response errors never include secret response fields', async t => {
  const oauth = new OAuth(client, 'test', {
    file: path.join(await temp(t), 'token.json'),
    fetchImpl: async () => response({ error: 'invalid_grant', secret: 'do-not-print' }, 400)
  });
  await assert.rejects(oauth.post('token', {}), error =>
    error.code === 'invalid_grant' && !error.message.includes('do-not-print'));
});

test('OAuth network errors do not expose credential URLs', async t => {
  const oauth = new OAuth(client, 'test', {
    file: path.join(await temp(t), 'token.json'),
    fetchImpl: async () => { throw new Error('secret-in-network-error'); }
  });
  await assert.rejects(oauth.post('token', {}), error =>
    !error.message.includes('secret-in-network-error'));
});

test('missing refresh token cannot overwrite prior credentials', async t => {
  const file = path.join(await temp(t), 'token.json');
  const oauth = new OAuth(client, 'test', { file });
  await oauth.save({ refresh_token: 'test-only' });
  const before = await fs.readFile(file, 'utf8');
  await assert.rejects(oauth.save({ access_token: 'test-only' }), /not changed/);
  assert.equal(await fs.readFile(file, 'utf8'), before);
});

test('refresh retains old refresh token when Google omits it', async t => {
  const file = path.join(await temp(t), 'token.json');
  const oauth = new OAuth(client, 'test', {
    file, fetchImpl: async () => response({ access_token: 'fresh-test-only' })
  });
  await oauth.save({ refresh_token: 'old-test-only' });
  assert.equal(await oauth.accessToken(), 'fresh-test-only');
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).refresh_token, 'old-test-only');
});

test('wrong-client token is not used or overwritten', async t => {
  const file = path.join(await temp(t), 'token.json');
  await writePrivate(file, JSON.stringify({ refresh_token: 'test', client_id: 'other' }));
  const oauth = new OAuth(client, 'test', {
    file, fetchImpl: async () => assert.fail('Must not request')
  });
  await assert.rejects(oauth.accessToken(), /different OAuth client/);
});

test('no cached login does not trigger unexpected device authorization', async t => {
  const oauth = new OAuth(client, 'test', {
    file: path.join(await temp(t), 'missing.json'),
    fetchImpl: async () => assert.fail('Must not request')
  });
  await assert.rejects(oauth.accessToken(), /Run login first/);
});

test('corrupt saved token fails instead of silently choosing a new identity', async t => {
  const file = path.join(await temp(t), 'token.json');
  await fs.writeFile(file, '{bad');
  const oauth = new OAuth(client, 'test', { file });
  await assert.rejects(oauth.load(), /unreadable or invalid/);
});

test('device login handles pending and slow_down then securely saves token', async t => {
  const file = path.join(await temp(t), 'token.json');
  const responses = [
    response({ device_code: 'device-test', user_code: 'USER-TEST',
      verification_url: 'https://www.google.com/device', expires_in: 60, interval: 1 }),
    response({ error: 'authorization_pending' }, 400),
    response({ error: 'slow_down' }, 400),
    response({ access_token: 'access-test', refresh_token: 'refresh-test' })
  ];
  const waits = [];
  let clock = 0;
  const oauth = new OAuth(client, 'radio-study', {
    file, fetchImpl: async () => responses.shift(), now: () => clock,
    sleep: async ms => { waits.push(ms); clock += ms; }, log: quiet
  });
  assert.equal(await oauth.login(), 'access-test');
  assert.deepEqual(waits, [1000, 1000, 6000]);
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
});

test('authorize returns a token without overwriting an existing login', async t => {
  const file = path.join(await temp(t), 'token.json');
  await writePrivate(file, JSON.stringify({ refresh_token: 'prior-test-only' }));
  const before = await fs.readFile(file, 'utf8');
  const responses = [
    response({ device_code: 'device', user_code: 'code',
      verification_url: 'https://www.google.com/device', expires_in: 60, interval: 1 }),
    response({ access_token: 'new-access-test-only', refresh_token: 'new-refresh-test-only' })
  ];
  let clock = 0;
  const oauth = new OAuth(client, 'test', {
    file, fetchImpl: async () => responses.shift(),
    now: () => clock, sleep: async ms => { clock += ms; }, log: quiet
  });
  assert.equal((await oauth.authorize()).access_token, 'new-access-test-only');
  assert.equal(await fs.readFile(file, 'utf8'), before);
});

test('device login expiry does not save a token', async t => {
  const file = path.join(await temp(t), 'token.json');
  let clock = 0;
  const oauth = new OAuth(client, 'test', {
    file, fetchImpl: async () => response({ device_code: 'device', user_code: 'code',
      verification_url: 'https://www.google.com/device', expires_in: 1, interval: 5 }),
    now: () => clock, sleep: async ms => { clock += ms; }, log: quiet
  });
  await assert.rejects(oauth.login(), /expired/);
  await assert.rejects(fs.stat(file), { code: 'ENOENT' });
});

test('YouTube owner check rejects another channel', async () => {
  const api = new YouTube('test', async () => response({
    items: [{ id: 'other', snippet: { title: 'Personal' } }]
  }));
  await assert.rejects(api.owner(channelId), /Wrong channel/);
});

test('YouTube writes are not retried and response secrets are not printed', async () => {
  let count = 0;
  const api = new YouTube('test', async () => {
    count++;
    return response({ secret: 'never-print' }, 403);
  });
  await assert.rejects(api.request('POST', 'playlists', {}, {}), error =>
    /HTTP 403/.test(error.message) && !error.message.includes('never-print'));
  assert.equal(count, 1);
});

test('video validation batches 50 IDs and fails if any are missing', async () => {
  const calls = [];
  const ids = Array.from({ length: 51 }, (_, i) => String(i).padStart(11, '0'));
  await validateVideos({ request: async (method, resource, params) => {
    assert.equal(params.part, 'id');
    calls.push(params.id.split(',').length);
    return { items: params.id.split(',').map(id => ({ id })) };
  } }, ids);
  assert.deepEqual(calls, [50, 1]);
  await assert.rejects(validateVideos({ request: async () => ({ items: [] }) }, [video1]),
    /Unavailable/);
});

test('playlist snapshot reads every page', async () => {
  const tokens = [];
  const api = { request: async (method, resource, params) => {
    if (resource === 'playlists') return {
      items: [{ id: playlistId, snippet: { channelId } }]
    };
    tokens.push(params.pageToken);
    return params.pageToken ? { items: [{ id: 'second' }] } :
      { items: [{ id: 'first' }], nextPageToken: 'next' };
  } };
  const result = await playlistState(api, playlistId, channelId);
  assert.deepEqual(result.items.map(item => item.id), ['first', 'second']);
  assert.deepEqual(tokens, [undefined, 'next']);
});

test('create preview makes no writes', async t => {
  const file = path.join(await temp(t), 'videos.ids');
  await fs.writeFile(file, video1);
  const api = fakeAPI();
  await runPlaylist('create', ['--title', 'New', '--ids-file', file], {
    getApi: async () => api, log: quiet,
    confirm: async () => assert.fail('Preview must not request write confirmation')
  });
  assert.equal(api.writes.length, 0);
});

test('replace preview makes no writes', async t => {
  const file = path.join(await temp(t), 'videos.ids');
  await fs.writeFile(file, video2);
  const api = fakeAPI();
  await runPlaylist('replace', ['--playlist-id', playlistId, '--ids-file', file], {
    getApi: async () => api, log: quiet,
    confirm: async () => assert.fail('Preview must not request write confirmation')
  });
  assert.equal(api.writes.length, 0);
});

test('apply requires both an expected account and an interactive terminal', async () => {
  assert.throws(() => optionsFor('create', [
    '--title', 'New', '--ids-file', 'videos.ids', '--apply'
  ]), /requires --expected-channel-id/);
  await assert.rejects(runPlaylist('create', [
    '--title', 'New', '--ids-file', 'videos.ids',
    '--apply', '--expected-channel-id', channelId
  ], { interactive: false }), /interactive/);
});

test('cancellation never writes', async t => {
  const file = path.join(await temp(t), 'videos.ids');
  await fs.writeFile(file, video1);
  const api = fakeAPI();
  await assert.rejects(runPlaylist('create', [
    '--title', 'New', '--ids-file', file,
    '--apply', '--expected-channel-id', channelId
  ], { getApi: async () => api, interactive: true, confirm: async () => 'no', log: quiet }),
  /Cancelled/);
  assert.equal(api.writes.length, 0);
});

test('creation is private and preserves input order', async () => {
  const api = fakeAPI();
  await createPlaylist(api, channelId, [video2, video1], { title: 'New' }, quiet);
  assert.equal(api.writes[0].body.status.privacyStatus, 'private');
  assert.deepEqual(api.writes.slice(1).map(write => write.body.snippet.resourceId.videoId),
    [video2, video1]);
});

test('changed owner before create prevents writes', async () => {
  const api = fakeAPI({ owner: 'other' });
  await assert.rejects(createPlaylist(api, channelId, [video1], { title: 'New' }, quiet),
    /Wrong channel/);
  assert.equal(api.writes.length, 0);
});

test('failed create insertion prints partial location and does not retry', async () => {
  const api = fakeAPI({ failAt: 3 });
  await assert.rejects(createPlaylist(api, channelId, [video1, video2], { title: 'New' }, quiet),
    /Added 1\/2 videos; partial playlist/);
  assert.equal(api.writes.length, 3);
});

test('replacement saves backup before deleting and inserts in order', async t => {
  const directory = await temp(t);
  const api = fakeAPI({ existing: [video1, video2] });
  const snapshot = await playlistState(api, playlistId, channelId);
  const request = api.request;
  api.request = async (...args) => {
    if (args[0] === 'DELETE') {
      const files = await fs.readdir(directory);
      assert.equal(files.length, 2);
      const idsFile = files.find(file => file.endsWith('.ids'));
      assert.equal(await fs.readFile(path.join(directory, idsFile), 'utf8'),
        video1 + '\n' + video2 + '\n');
    }
    return request(...args);
  };
  await replacePlaylist(api, channelId, playlistId, [video2], snapshot, {
    backupDirectory: directory, log: quiet
  });
  assert.deepEqual(api.writes.map(write => write.method), ['DELETE', 'DELETE', 'POST']);
  assert.equal(api.writes[2].body.snippet.resourceId.videoId, video2);
});

test('changed playlist fails before backup and deletion', async t => {
  const directory = await temp(t);
  const api = fakeAPI({ changeSnapshot: true });
  const snapshot = await playlistState(api, playlistId, channelId);
  await assert.rejects(replacePlaylist(api, channelId, playlistId, [video2], snapshot, {
    backupDirectory: directory, log: quiet
  }), /changed after preview/);
  assert.equal(api.writes.length, 0);
  assert.deepEqual(await fs.readdir(directory), []);
});

test('backup failure prevents deletion', async t => {
  const directory = await temp(t);
  const notDirectory = path.join(directory, 'file');
  await fs.writeFile(notDirectory, 'x');
  const api = fakeAPI();
  const snapshot = await playlistState(api, playlistId, channelId);
  await assert.rejects(replacePlaylist(api, channelId, playlistId, [video2], snapshot, {
    backupDirectory: notDirectory, log: quiet
  }));
  assert.equal(api.writes.length, 0);
});

test('second backup write failure reports snapshot and never deletes', async t => {
  const directory = await temp(t);
  const api = fakeAPI();
  const snapshot = await playlistState(api, playlistId, channelId);
  const originalWriteFile = fs.writeFile;
  fs.writeFile = async (file, ...args) => {
    if (String(file).includes('.ids.')) throw new Error('simulated disk full');
    return originalWriteFile(file, ...args);
  };
  try {
    await assert.rejects(replacePlaylist(api, channelId, playlistId, [video2], snapshot, {
      backupDirectory: directory, log: quiet
    }), /Backup incomplete; no playlist items deleted.*snapshot is at .*\.json/);
  } finally {
    fs.writeFile = originalWriteFile;
  }
  assert.equal(api.writes.length, 0);
  const files = await fs.readdir(directory);
  assert.equal(files.length, 1);
  assert.ok(files[0].endsWith('.json'));
});

test('replacement API failure stops immediately and keeps backup', async t => {
  const directory = await temp(t);
  const api = fakeAPI({ existing: [video1, video2], failAt: 2 });
  const snapshot = await playlistState(api, playlistId, channelId);
  await assert.rejects(replacePlaylist(api, channelId, playlistId, [video2], snapshot, {
    backupDirectory: directory, log: quiet
  }), /deleting 1\/2 original items.*Backup:/);
  assert.equal(api.writes.length, 2);
  assert.equal((await fs.readdir(directory)).length, 2);
});

test('help does not authenticate', async () => {
  await runPlaylist('create', ['--help'], {
    getApi: async () => assert.fail('Must not authenticate'), log: quiet
  });
});
