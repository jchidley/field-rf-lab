#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
launcher="$root/../youtube-workbench/playlist-manager/scripts/youtube-playlists.sh"
if [[ ! -f "$launcher" ]]; then
  printf 'Missing YouTube Workbench at %s. Restore the sibling checkout.\n' "$root/../youtube-workbench" >&2
  exit 1
fi
exec bash "$launcher" "$@"
