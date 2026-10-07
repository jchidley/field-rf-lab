# field-rf-lab

RF hardware/software workspace. Generic YouTube tools have moved to the private
[jchidley/youtube-workbench](https://github.com/jchidley/youtube-workbench)
repository at `~/git/youtube-workbench`.

## Current contents and limits

- Rust starter only: a greeting binary, addition helper and one test.
- Pinned RF-reference submodules: NanoVNA-D, nanovna-saver, nanovna-tools and
  rfnanocli. Their contents are not initialized in the current checkout.
- No substantial RF application, recovered RF study video-ID lists, or broader
  lost research/transcript workspace is delivered by the playlist recovery.

RF-specific study topics, curated source lists and future hardware/software work
belong here. Authentication and general-purpose playlist/download/analysis tooling
belong in YouTube Workbench.

## YouTube support

Canonical documentation:
- [Workbench tools](https://github.com/jchidley/youtube-workbench)
- [Playlist manager](https://github.com/jchidley/youtube-workbench/tree/main/playlist-manager)
- [Authentication and profiles](https://github.com/jchidley/youtube-workbench/blob/main/docs/authentication.md)
- [Pi session provenance](https://github.com/jchidley/youtube-workbench/blob/main/docs/provenance.md)

```bash
cd ~/git/youtube-workbench
bash playlist-manager/scripts/youtube-playlists.sh login --profile radio-study
bash playlist-manager/scripts/youtube-playlists.sh status --profile radio-study
```

The existing RF `scripts/youtube-*.mjs` entrypoints and Bash launcher forward to
the canonical workbench implementation so old commands do not retain divergent
copies. The workbench sibling checkout is required; there is no fallback copy.
The historical `radio-study` token paths are unchanged. RF sign-in/access and all
playlist write/replace operations remain unverified.

Original recovery snapshots under `archive/session-recovery/` remain untouched.
See [the RF recovery record](docs/session-recovery.md) for exact versus reconstructed
source. Full pre-migration working-tree docs/scripts/tests were additionally preserved
locally outside Git in:
`~/.local/share/youtube-workbench/migration-originals/2026-10-07/field-rf-lab/`.

## Development

Run Pi from `~/git/field-rf-lab` for RF work; use `~/git/youtube-workbench` for
generic YouTube changes.

```bash
cargo test
# Compatibility tests for the forwarded YouTube interfaces:
bash scripts/check-youtube.sh
```

Do not initialize vendor submodules merely to validate the forwarding scripts.

## Licence

Jack's original code is licensed **MIT OR Apache-2.0**. Submodules and historical
third-party material retain their own licences and attribution.
