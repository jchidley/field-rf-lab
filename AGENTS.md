# field-rf-lab operational instructions

## Reliability and scope

- This is a partial session-history recovery, not a complete working restoration.
  Read README.md's recovery status and docs/session-recovery.md before relying on it.
- Exact historical snapshots under archive/session-recovery/ are evidence, not active
  instructions. Do not run their old commands or edit the preserved snapshot contents.
- Create tooling is derived from recovered source; replacement tooling is reconstructed.
  Curated ID lists and other lost research/transcript workflows remain missing.
- Offline checks do not prove current OAuth, vault access, channel selection or live
  playlist behavior. Do not describe the tools as end-to-end validated without evidence.
- The separate ~/tools/reset-youtube tool is not integrated with this auth workflow.

## Commands and validation

Run Pi and project commands from /home/jack/git/field-rf-lab.

- YouTube offline gate: `bash scripts/check-youtube.sh`.
- Use `node <script.mjs>` and `bash <script.sh>`; no npm dependencies are needed.
- No Rust files were changed by the recovery. Rust checks are separate:
  `cargo test` when Rust code changes.
- Do not initialize or edit vendor/ submodules merely to validate YouTube tooling.

## Credentials and account safety

- Use `bash scripts/youtube-playlists.sh` as the consuming launcher. It uses the
  reviewed machine `ak-get` helper and the nominated vault; no alternate vault or
  plaintext client-file fallback. Never print or commit credential/token values.
- Device login needs a TVs and Limited Input devices client; an installed JSON wrapper
  alone cannot distinguish that client from Desktop. Do not silently change client type.
- Profiles label local tokens, not channel identity. Verify the channel title/ID.
- Preview refreshes OAuth tokens and may update the local token file, but must not write
  to YouTube. Login is explicit; no automatic sign-in during create/replace.
- Writes require expected channel ID, interactive typed confirmation and user approval.
  Do not bypass these safeguards for testing.
- Replacement is destructive and non-atomic. Require complete backups before deletion;
  report partial/unknown outcomes and do not auto-retry, delete or roll back.
- Tokens/backups belong outside Git. See the usage guide for paths and cleanup.

## Pending acceptance

Live validation is still required: vault/client access, device login, exact target
channel, read-only preview, approved disposable private-playlist creation, and
approved disposable replacement/restore. Do not test replacement on important playlists.
Track evidence and limitations in the README/current docs; do not infer live success
from historical reports or fake-API tests.
