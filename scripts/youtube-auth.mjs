import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { OAuth, YouTube, credentials, profileName, tokenPath } from './youtube-client.mjs';

async function main() {
  const { values } = parseArgs({ options: {
    profile: { type: 'string', default: 'default' },
    login: { type: 'boolean' }, logout: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' }
  } });
  if (values.help) {
    console.log('Usage: node scripts/youtube-auth.mjs --profile NAME [--login | --logout]' +
      '\nDefault: print the authorized channel. Login uses device-code OAuth.');
    return;
  }
  if (values.login && values.logout) throw new Error('Choose login or logout, not both.');
  const profile = profileName(values.profile);
  if (values.logout) {
    await fs.rm(tokenPath(profile), { force: true });
    console.log('Local token removed for ' + profile +
      '. This does not revoke Google access or remove playlists.');
    return;
  }
  const oauth = new OAuth(credentials(), profile);
  const token = values.login ? await oauth.login() : await oauth.accessToken();
  const owner = await new YouTube(token).owner();
  console.log('Profile ' + profile + ': ' + owner.title + ' (' + owner.id + ')');
  console.log('Check this is the intended channel before using its ID for --apply.');
}

try { await main(); }
catch (error) {
  console.error('Error: ' + error.message);
  process.exitCode = 1;
}
