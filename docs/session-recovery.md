# YouTube tooling recovery

## Source and limits

The GitHub clone at baseline commit
`17fb6114efa8f02981a0cdbc21b45c11398d611c` contained the Rust starter and RF
submodule pointers, not the local YouTube scripts described in May sessions.

Recovery source:

```text
/home/jack/.pi/agent/sessions/--home-jack-github-field-rf-lab--/
2026-05-17T09-03-12-556Z_019e352c-daab-752e-9099-0ad51cd00997.jsonl
```

The session records file-writing tool calls, tool results and later edits.
No historical shell command was executed during recovery.
An earlier shell call at line 267 ended with a WebSocket error and contains an
incomplete documentation draft using a different vault-service name. It was
superseded by the complete, successful call at line 269 and was not replayed.
One recorded edit (line 277) failed in the original session; it was excluded rather
than forced to apply. Subsequent successful edits were replayed with exact-text
matching. The docs came from the recorded here-document at line 269, not by running
that shell command.

## Exact recovered snapshots

Stored as non-executable `.txt` files under `archive/session-recovery/`.
These are historical evidence, **not current operational instructions**.

| Original path | Write/patch JSONL lines | SHA-256 of recovered content |
|---|---|---|
| `scripts/youtube-create-playlist.mjs` | 265, 279, 297, 317 | `d9cf3f20c3cfc87ec912a6c61173af86ac1ea6c9535cfea920bb98a5d7878595` |
| `docs/youtube-profile-playlist-automation.md` | 269, 281, 299, 319 | `b208af7efc8bfbe63b0a0d89b27a9b7f40a783795ab2a1e3aaca96e2c772113d` |

`archive/session-recovery/provenance.json` records the local source path, replayed
lines, superseded aborted shell call and skipped failed edit. The original script used device-code OAuth, broad
YouTube scope and profile-specific token files.

## Runnable tooling: derived, not byte-identical

- `scripts/youtube-client.mjs`: recovered OAuth/profile workflow, refactored with
  timeouts, sanitized errors, explicit login, private atomic token writes, and
  refresh-token/client-ID handling.
- `scripts/youtube-create-playlist.mjs`: same operation and historical filename,
  now using shared modules and preview/confirmation/account safeguards.
- `scripts/youtube-replace-playlist-items.mjs`: **new reconstruction** of the
  replacement workflow reported in the history. No exact original file-write record
  was found in the searched field-rf-lab and recovered-workspace sessions.
- `scripts/youtube-auth.mjs`: new explicit login/status/logout interface.
- `scripts/youtube-playlists.sh`: new managed `ak` consuming launcher.
- Shared CLI/operation modules and offline tests are new.

Important intentional change: commands preview by default; writes require
`--apply --expected-channel-id` and typed confirmation. Old commands do not silently
create or clear playlists. Replacement preserves the playlist identity and saves a
local snapshot/ordered IDs before clearing items.

No client secrets or OAuth tokens were recovered from history. The historical vault
service is `youtube-oauth-client-json`; its present availability was not checked.
The earlier curated ID files, research/transcripts and the rest of the lost local
workspace have not been recovered by this tooling task.

This work documents recoverability, not the cause of the home-directory loss.

## Current usage

Follow [YouTube profile playlist automation](youtube-profile-playlist-automation.md),
not the historical snapshots. Live OAuth and playlist writes require separate user
interaction and have not been validated by the offline test suite.

Offline validation passed: 30 unit/failure-injection tests, Node syntax checks,
Bash syntax checks, help without vault access, direct working-tree whitespace checks
(including an untracked-file negative test), and `git diff --check`.
The independent read-only review reproduced both recovered hashes and confirmed
the safety checks. Its local findings were addressed: untracked-file whitespace
coverage, incomplete-backup reporting, and provenance/credential-type/cache-location
qualifications. Its concern about `videos.list part=id` was independently disproved:
[Google's current reference](https://developers.google.com/youtube/v3/docs/videos/list)
explicitly lists `id` among supported parts. The original request was retained.
Validation ran on Node 24; the declared Node 22 minimum has not been tested separately.
Three targeted mutations were detected: removing the pre-write owner check,
omitting the snapshot backup, and bypassing preview. These are bounded checks,
not a claim of exhaustive fault detection. The recovered snapshot hashes above
were independently recomputed from the preserved files.
