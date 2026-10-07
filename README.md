# field-rf-lab

RF study workspace with recovered local YouTube playlist tooling.

## Recovery status — do not rely on this as a complete, working restoration

**The YouTube tooling has passed offline checks only. It has NOT been demonstrated
to work end-to-end with the current Google project, vault credentials or YouTube
channels. Do not use it on important playlists until the live checks below are
completed. This repository is not the full workspace described in the May Pi sessions.**

### What we recovered and built

The GitHub baseline (`17fb6114`) contained a Rust starter and RF-reference submodule
pointers, but no YouTube scripts. After the reported home-directory loss, we used
May Pi session records to recover the original create-playlist script and its
successful patches, plus the original usage document.

Exact, non-executable historical copies are preserved under
`archive/session-recovery/`; their hashes and source-session/line references are
documented in [the recovery record](docs/session-recovery.md). Those copies are
evidence, not current usage instructions.

The runnable code now provides:
- Device-code Google login, channel status and local logout.
- Separate token profiles for different YouTube/Brand identities.
- Playlist creation from an ordered video-ID file.
- Replacement of an existing playlist's video list.

**The replacement script is newly reconstructed**, not an exact recovery of its
old source. Shared modules, the managed `ak` launcher, safeguards and tests are also
new work.

### Intentional changes from the earlier tooling

| Earlier behavior | Current behavior |
|---|---|
| Running the create command immediately wrote to YouTube | Preview by default; writes require `--apply` |
| Browser identity was the main account safeguard | An expected `UC...` channel ID and typed confirmation are required for writes |
| Authentication could start automatically during creation | Explicit login first; missing/expired credentials stop the operation |
| Replacement details were only described in the recovered history | Reconstructed replacement verifies ownership and saves backups before deleting items |
| Tokens used `~/.cache/field-rf-lab` | Same default naming, but `XDG_CACHE_HOME` can change the location |

Old command lines are therefore **not behaviorally interchangeable** with the
restored tooling. Use the current guide, not historical examples.

The existing device-client/vault setup is intended to be reused; no new Desktop
OAuth client is needed. Its current availability and validity remain unverified.
Both TV and Desktop credential files can have an `installed` wrapper, so Google—not
the file format—ultimately determines whether the client supports device login.

### How it is supposed to work

1. Run the Bash launcher in WSL; it retrieves `youtube-oauth-client-json` through
   the managed `ak` helper into the consuming process, without printing the secret.
2. Log in under a named profile, selecting the intended YouTube/Brand channel.
3. Check the channel title and ID with `status`.
4. Supply a real `.ids` file and preview the operation. The tool checks the ordered,
   deduplicated video IDs and displays the destination.
5. For a write, pass `--apply --expected-channel-id UC...` and type the requested
   confirmation. Account/video checks run again before writing.
6. For replacement, the tool also rechecks the playlist and writes a private JSON
   snapshot and ordered IDs backup before removing existing items.

Creation makes a new playlist each time. Replacement keeps the existing playlist's
URL and metadata but removes and re-adds its items. **Neither is an atomic transaction.**
A failure can leave a partial playlist; there is no automatic retry or rollback.
Backups do not guarantee that deleted/private/unavailable videos can be restored.

### Verified, missing, and still to check

| Item | Status |
|---|---|
| Exact recovery of create script and historical docs | Hashes independently reproduced |
| Local safety and failure handling | 30 offline tests pass |
| Node/Bash syntax, help without vault access, whitespace including untracked files | Passed |
| Three targeted safety mutations | Detected by tests; not exhaustive verification |
| Live vault/client access and device-code authorization | **Not checked** |
| Intended channel selection and current API permissions/quota | **Not checked** |
| Real playlist creation, ordering, privacy and replacement/restore behavior | **Not checked** |
| Declared Node 22 minimum | Not separately tested; checks ran on Node 24 |
| Original curated RF video-ID lists | **Not recovered** |
| Other lost research, transcripts and curation workflows | **Not restored by this task** |

Before relying on the tools:
- Verify the Cloud project/client, YouTube API enablement and consent-screen access.
- Verify the managed vault helper and stored client without printing credential values.
- Complete explicit device login, then verify the exact intended channel title/ID.
- Use a tiny, known-good IDs file to test read-only preview.
- With separate approval, create a disposable private playlist and inspect its owner,
  privacy, videos and order.
- With separate approval, test replacement **only on a disposable playlist**, including
  backup contents, failure reporting and restoring from the backup IDs.
- Recover or rebuild and verify the missing curated lists before reproducing earlier
  RF-study playlists. A successful tool test does not validate the curation itself.

**No live authentication or playlist writes were performed during recovery.**
The May history contains the user's reported successful use, not independent proof
that the restored code works today. The separate `~/tools/reset-youtube` tool has
not yet been adapted to this device-code authentication; committing this repository
does not complete that original latest-channel-videos workflow.

## YouTube playlist tools

The recovered/reconstructed tools use the existing Google device-code OAuth client
in `ak`. They preview by default and require explicit confirmation before changing
playlists.

- [Usage, authentication, backups and cleanup](docs/youtube-profile-playlist-automation.md)
- [Recovery sources and exact-versus-reconstructed provenance](docs/session-recovery.md)

```bash
# Offline checks; no sign-in or account changes
bash scripts/check-youtube.sh

# Explicit interactive sign-in (when ready)
bash scripts/youtube-playlists.sh login --profile radio-study
```

The original curated video ID lists are not yet recovered. See the usage guide for
supplying your own list.

## Build Configuration

Add this to `~/.cargo/config.toml`:

```toml
[build]
rustflags = ["-C", "link-arg=-fuse-ld=mold","-C", "target-cpu=native"]
```

## Usage

```bash
cargo build
cargo run
cargo test
```

## About This Code

Almost all of this code is AI/LLM-generated. It's best used as a source of
inspiration for your own AI/LLM efforts rather than as a traditional library.

**This is personal alpha software.** All my GitHub projects should be considered
experimental. If you want to use them:

- **Pin to a specific commit** — don't track `main`, it changes without warning
- **Use AI/LLM to adapt** — without AI assistance, these projects are hard to use
- **Treat as inspiration** — build your own version rather than depending on mine

**Suggestions welcome** — If you have ideas for improvements or changes, I'd be
delighted to read them and use them as inspiration for my own efforts.

**Why not a library?** These days it's often quicker to use AI/LLM to build your
own than to integrate traditional libraries. My use of AI/LLM is inspired by
these people and posts:

- [Simon Willison's Weblog](https://simonwillison.net/) — Essential reading on
  LLMs, prompt engineering, and building with AI
- [CLI over MCP](https://lucumr.pocoo.org/2025/8/18/code-mcps/) — Armin Ronacher
  on why command-line tools are better integration points than custom protocols
- [Build It Yourself](https://lucumr.pocoo.org/2025/12/22/a-year-of-vibes/) —
  Armin Ronacher: "With our newfound power from agentic coding tools, you can
  build much of this yourself..."
- [Shipping at Inference Speed](https://steipete.me/posts/2025/shipping-at-inference-speed) —
  Peter Steinberger on the new workflow of building with AI assistance
- [Year in Review 2025](https://mariozechner.at/posts/2025-12-22-year-in-review-2025/) —
  Mario Zechner on AI-assisted development

**What I use:** Currently Anthropic's Claude Opus, evaluating OpenAI's GPT Codex
as an alternative.

## License

This project is dual-licensed under the terms of both the MIT license and the
Apache License (Version 2.0).

See [LICENSE-APACHE](LICENSE-APACHE) and [LICENSE-MIT](LICENSE-MIT) for details.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this project by you, as defined in the Apache-2.0 license,
shall be dual licensed as above, without any additional terms or conditions.
