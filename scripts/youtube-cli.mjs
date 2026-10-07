import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { OAuth, YouTube, credentials, profileName } from './youtube-client.mjs';
import { readIds, validateVideos, playlistState, createPlaylist, replacePlaylist
} from './youtube-playlist-operations.mjs';

export function optionsFor(action, argv) {
  const { values } = parseArgs({
    args: argv, strict: true, allowPositionals: false,
    options: {
      help: { type: 'boolean', short: 'h' },
      profile: { type: 'string', default: 'default' },
      'expected-channel-id': { type: 'string' },
      'ids-file': { type: 'string' },
      apply: { type: 'boolean' },
      ...(action === 'create' ? {
        title: { type: 'string' }, description: { type: 'string', default: '' },
        privacy: { type: 'string', default: 'private' }
      } : { 'playlist-id': { type: 'string' } })
    }
  });
  if (values.help) return values;
  profileName(values.profile);
  if (!values['ids-file']) throw new Error('--ids-file is required.');
  if (action === 'create' && !values.title?.trim()) throw new Error('--title is required.');
  if (action === 'create' && !['private', 'unlisted', 'public'].includes(values.privacy)) {
    throw new Error('--privacy must be private, unlisted or public.');
  }
  if (action === 'replace' && !/^[A-Za-z0-9_-]{10,100}$/.test(values['playlist-id'] || '')) {
    throw new Error('--playlist-id must be a playlist ID, not a URL.');
  }
  const channel = values['expected-channel-id'];
  if (channel && !/^UC[A-Za-z0-9_-]{22}$/.test(channel)) {
    throw new Error('--expected-channel-id must be the 24-character UC... channel ID.');
  }
  if (values.apply && !channel) throw new Error('--apply requires --expected-channel-id.');
  return values;
}

export async function authenticate(profile) {
  const oauth = new OAuth(credentials(), profile);
  return new YouTube(await oauth.accessToken());
}

async function ask(prompt) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try { return await terminal.question(prompt); }
  finally { terminal.close(); }
}

export async function runPlaylist(action, argv, {
  getApi = authenticate, confirm = ask,
  interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
  log = console.log
} = {}) {
  const values = optionsFor(action, argv);
  if (values.help) {
    log('Usage: node scripts/youtube-' +
      (action === 'create' ? 'create-playlist' : 'replace-playlist-items') +
      '.mjs --profile NAME --ids-file PATH ' +
      (action === 'create' ? '--title TITLE [--description TEXT] [--privacy private]' :
        '--playlist-id ID') +
      '\nPreview is the default. Add --apply --expected-channel-id UC... to write, ' +
      'then type the requested confirmation in an interactive terminal.');
    return;
  }
  if (values.apply && !interactive) {
    throw new Error('--apply requires an interactive terminal. No changes made.');
  }
  const ids = await readIds(values['ids-file']);
  const api = await getApi(values.profile);
  const owner = await api.owner(values['expected-channel-id']);
  log('Authorized channel: ' + owner.title + ' (' + owner.id + ')');
  await validateVideos(api, ids);
  let snapshot;
  if (action === 'replace') {
    snapshot = await playlistState(api, values['playlist-id'], owner.id);
    log('Existing playlist: ' + snapshot.playlist.snippet.title +
      ' (' + snapshot.items.length + ' items)');
  } else {
    log('New playlist: ' + values.title + ' [' + values.privacy + ']');
  }
  log('Desired videos in order (' + ids.length + '):\n' + ids.join('\n'));
  if (!values.apply) {
    log('Preview only. Rerun with --apply --expected-channel-id ' + owner.id +
      ' to request a write.');
    return;
  }
  const phrase = action === 'create' ? 'CREATE ' + owner.id :
    'REPLACE ' + values['playlist-id'];
  if ((await confirm('Type "' + phrase + '" to proceed: ')).trim() !== phrase) {
    throw new Error('Cancelled. No changes made.');
  }
  // Recheck video availability and destination after human confirmation.
  await validateVideos(api, ids);
  const url = action === 'create' ?
    await createPlaylist(api, owner.id, ids, values, log) :
    await replacePlaylist(api, owner.id, values['playlist-id'], ids, snapshot, { log });
  log('Completed: ' + url);
}

export async function main(action) {
  try { await runPlaylist(action, process.argv.slice(2)); }
  catch (error) {
    console.error('Error: ' + error.message);
    process.exitCode = 1;
  }
}
