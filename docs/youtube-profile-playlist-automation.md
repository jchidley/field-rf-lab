# YouTube profile playlist automation

Recovered and reconstructed local tools for creating playlists and replacing their
video lists using official YouTube Data API v3. See [session recovery](session-recovery.md)
for what is exact recovery versus new work.

Requires **Node.js 22 or newer**, Bash, and the installed managed secret helper.
No npm dependencies. Use these commands from `/home/jack/git/field-rf-lab`.
Windows users should run them in WSL, not Windows PowerShell.

## Existing Google setup

Reuse the project you identified as **field-rf-lab-youtube-playlists**, its
**TVs and Limited Input devices** OAuth client, and the historically recorded vault
service **youtube-oauth-client-json**. Do not download a Desktop client for these tools.
Both TV and Desktop client JSON can use an `installed` wrapper; the file format alone
cannot prove the client type. Google must accept it at the device-code endpoint.

The May history contains your reported successful run and later playlist work,
not an independently observed API execution. The current Cloud project/client,
vault availability, OAuth grants and channel access have not been checked. If login fails, check that
YouTube Data API v3 remains enabled and your owning Google account is a consent-screen
test user. Testing-mode tokens may expire after seven days.

The managed launcher retrieves the client only into the Node process environment,
using `bash ~/git/agent-skills/skills/windows-env/ak-get youtube-oauth-client-json`.
It does not print the client, create a plaintext client file, or use another vault.
If the helper or nominated vault is unavailable, it stops.

## Sign in and identify the channel

```bash
cd /home/jack/git/field-rf-lab
bash scripts/youtube-playlists.sh login --profile radio-study
bash scripts/youtube-playlists.sh status --profile radio-study
```

Login prints a Google verification URL and code. Open the URL, enter the code, and
select the intended YouTube/Brand identity. Status prints that channel's title and
`UC...` ID. Use a stable, separate profile for each identity—for example
`radio-study` and `chidley-engineering`. A profile is a local token label, not proof
of the selected channel. Check the title and ID.

Create/replace never silently launch a new login. If the token is missing, expired
or corrupt, they stop and tell you to log in. If Google returns multiple authorized
channels, the tool fails safely instead of guessing.

## Input

An `.ids` text file contains whitespace-separated YouTube video IDs, not URLs.
IDs are validated as 11 characters; duplicates are removed, retaining first occurrence.
All desired IDs are checked with the authenticated API before a write.

The earlier curated files such as
`data/playlists/combined-qmx-nanovna-field-antenna.ids` and
`data/playlists/exam-support-uk-full-us-amateur.ids` have **not been recovered**.
Supply a real IDs file; the examples below do not invent their content.

## Preview and create a playlist

```bash
# Read-only preview (requires an existing login).
bash scripts/youtube-playlists.sh create \
  --profile radio-study \
  --title "QMX NanoVNA Field Antenna Study" \
  --ids-file /path/to/videos.ids

# Copy the verified UC... channel ID printed above.
bash scripts/youtube-playlists.sh create \
  --profile radio-study \
  --title "QMX NanoVNA Field Antenna Study" \
  --ids-file /path/to/videos.ids \
  --apply --expected-channel-id YOUR_VERIFIED_CHANNEL_ID
```

The second command previews again, then asks you to type `CREATE UC...` exactly.
An interactive terminal is required. Privacy defaults to `private`;
`--privacy unlisted` and `--privacy public` are supported and shown before confirmation.
Optional `--description TEXT` sets the description.

Creation makes a **new** playlist every time. It does not delete or replace earlier
ones. Account and video checks are repeated after confirmation.
If inserting a video fails, the tool reports the playlist URL and confirmed added
count. There is no retry or automatic deletion; inspect the partial playlist before
rerunning. A failed network request can have an unknown server-side outcome.

## Preview and replace a playlist's video list

Replacement is destructive: it removes existing playlist items, then adds your
desired list. It retains the playlist itself, its URL, title, description and visibility.

```bash
bash scripts/youtube-playlists.sh replace \
  --profile radio-study \
  --playlist-id YOUR_PLAYLIST_ID \
  --ids-file /path/to/revised-videos.ids

bash scripts/youtube-playlists.sh replace \
  --profile radio-study \
  --playlist-id YOUR_PLAYLIST_ID \
  --ids-file /path/to/revised-videos.ids \
  --apply --expected-channel-id YOUR_VERIFIED_CHANNEL_ID
```

Type `REPLACE PLAYLIST_ID` exactly when prompted. The playlist must belong to the
verified channel. All current items are read, including multiple pages. The tool
rechecks the playlist snapshot after confirmation and stops if it changed.

Before deletion, it saves a private JSON snapshot and ordered `.ids` backup in:

```text
${XDG_CACHE_HOME:-~/.cache}/field-rf-lab/playlist-backups/
```

If saving either backup fails, no items are deleted. Replacement is **not atomic**:
API errors or interruption can leave a partial or empty playlist. There is no
automatic rollback or retry. The JSON backup preserves the response metadata for
inspection; the IDs file can be used as input to a separately confirmed replacement
to restore the video list. Unavailable/deleted videos might not be restorable.
An originally empty playlist has an empty backup IDs file; this tool does not accept
an empty desired list.

Do not modify the playlist concurrently. Snapshot checks reduce that risk but do
not create a server-side lock.

## Token storage and cleanup

Per-profile access/refresh tokens are saved outside Git at:

```text
${XDG_CACHE_HOME:-~/.cache}/field-rf-lab/youtube-oauth-token-PROFILE.json
```

Default profile: `default`. Filenames preserve the final recovered naming convention.
The old script always used `~/.cache`; if `XDG_CACHE_HOME` is set elsewhere, old tokens
are not discovered there automatically. Log in again in the selected cache location.
New cache directories use 0700 permissions; token and backup files use 0600.
Existing directory permissions are not changed. Writes use a private temporary file
and atomic rename. A historical token at the selected path can be refreshed if its
Google grant is still valid; no surviving tokens were found during recovery.
Newly saved tokens also record the OAuth client ID and reject use with a different client.

The device flow requests `https://www.googleapis.com/auth/youtube`, a **broad account
scope**, because the earlier device-client setup rejected `youtube.force-ssl`.
Keep refresh tokens secret. This code only performs the playlist operations described
here, but its Google authorization permits more.

```bash
bash scripts/youtube-playlists.sh logout --profile radio-study
```

Logout removes that local token, without reading the vault. It does not revoke Google
access or delete playlists. Revoke the app separately through Google account permissions
if desired. Delete individual backup files when no longer needed; do not commit them.

Help also works without the vault:

```bash
bash scripts/youtube-playlists.sh create --help
bash scripts/youtube-playlists.sh replace --help
bash scripts/youtube-playlists.sh login --help
```

Direct Node entrypoints retain the historical filenames:
`node scripts/youtube-create-playlist.mjs` and
`node scripts/youtube-replace-playlist-items.mjs`.
Their client must already be supplied by an approved consuming launcher.
Use the Bash launcher above rather than copying credentials into commands or files.

## Validation

```bash
bash scripts/check-youtube.sh
```

Checks are offline: syntax, unit/failure-injection tests, help, and whitespace.
Working-tree source/docs/test files are checked directly, including untracked files.
They do not use the vault, start OAuth, query live accounts, or change playlists.
Google quota is shared by clients in the same Cloud project. Playlist writes and
especially large replacements consume quota; do discovery locally before applying
a final list. Mobile-app offline downloads still require manual action in YouTube.
