import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataDirectory, writePrivate } from './youtube-client.mjs';

export function parseIds(text) {
  const ids = [...new Set(text.split(/\s+/).filter(Boolean))];
  if (!ids.length || ids.some(id => !/^[A-Za-z0-9_-]{11}$/.test(id))) {
    throw new Error('IDs file must contain whitespace-separated 11-character YouTube video IDs.');
  }
  return ids;
}

export async function validateVideos(api, ids) {
  for (let start = 0; start < ids.length; start += 50) {
    const batch = ids.slice(start, start + 50);
    const result = await api.request('GET', 'videos', { part: 'id', id: batch.join(',') });
    const available = new Set((result.items || []).map(video => video.id));
    const missing = batch.filter(id => !available.has(id));
    if (missing.length) {
      throw new Error('Unavailable video IDs: ' + missing.join(', ') + '. No playlist changes made.');
    }
  }
}

export async function playlistState(api, playlistId, channelId) {
  const result = await api.request('GET', 'playlists', {
    part: 'snippet,status', id: playlistId
  });
  const playlist = result.items?.[0];
  if (!playlist || playlist.snippet.channelId !== channelId) {
    throw new Error('Playlist is missing or not owned by the verified channel. No changes made.');
  }
  const items = [];
  let pageToken;
  do {
    const params = { part: 'snippet,contentDetails', playlistId, maxResults: '50' };
    if (pageToken) params.pageToken = pageToken;
    const page = await api.request('GET', 'playlistItems', params);
    items.push(...(page.items || []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return { playlist, items };
}

async function addVideos(api, playlistId, ids) {
  let added = 0;
  try {
    for (const videoId of ids) {
      await api.request('POST', 'playlistItems', { part: 'snippet' }, {
        snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } }
      });
      added++;
    }
  } catch (error) {
    throw new Error('Added ' + added + '/' + ids.length + ' videos; partial playlist ' +
      'https://www.youtube.com/playlist?list=' + playlistId + '. ' + error.message);
  }
  return added;
}

export async function createPlaylist(api, channelId, ids, options, log = console.log) {
  await api.owner(channelId);
  const result = await api.request('POST', 'playlists', { part: 'snippet,status' }, {
    snippet: { title: options.title, description: options.description || '' },
    status: { privacyStatus: options.privacy || 'private' }
  });
  if (!result.id) throw new Error('Playlist creation response missing ID; inspect your account.');
  const url = 'https://www.youtube.com/playlist?list=' + result.id;
  log('Created playlist: ' + url);
  if (result.snippet?.channelId !== channelId) {
    throw new Error('Unexpected owner in creation response. Stopped: ' + url);
  }
  await addVideos(api, result.id, ids);
  return url;
}

export async function replacePlaylist(api, channelId, playlistId, ids, snapshot, {
  backupDirectory = path.join(dataDirectory, 'playlist-backups'), log = console.log
} = {}) {
  await api.owner(channelId);
  const current = await playlistState(api, playlistId, channelId);
  if (JSON.stringify(current) !== JSON.stringify(snapshot)) {
    throw new Error('Playlist changed after preview. No changes made; preview again.');
  }
  // Refuse an un-restorable backup before clearing anything.
  const oldIds = current.items.map(item => item.snippet?.resourceId?.videoId);
  if (oldIds.some(id => !id || !/^[A-Za-z0-9_-]{11}$/.test(id))) {
    throw new Error('Existing playlist contains an unavailable item without a valid video ID.');
  }
  const base = path.join(backupDirectory,
    playlistId + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID());
  try {
    await writePrivate(base + '.json', JSON.stringify(current, null, 2) + '\n');
    await writePrivate(base + '.ids', oldIds.join('\n') + (oldIds.length ? '\n' : ''));
  } catch {
    throw new Error('Backup incomplete; no playlist items deleted. Check disk space and ' +
      'permissions. Any saved snapshot is at ' + base + '.json.');
  }
  log('Backup: ' + base + '.json');
  log('Original ordered video IDs: ' + base + '.ids');
  let deleted = 0;
  try {
    for (const item of current.items) {
      await api.request('DELETE', 'playlistItems', { id: item.id });
      deleted++;
    }
    await addVideos(api, playlistId, ids);
  } catch (error) {
    throw new Error('Replacement stopped after deleting ' + deleted + '/' +
      current.items.length + ' original items. Backup: ' + base + '.json. ' +
      'Playlist: https://www.youtube.com/playlist?list=' + playlistId + '. ' + error.message);
  }
  return 'https://www.youtube.com/playlist?list=' + playlistId;
}

export async function readIds(file) {
  return parseIds(await fs.readFile(file, 'utf8'));
}
