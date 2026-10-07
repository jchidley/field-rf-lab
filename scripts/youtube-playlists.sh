#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
action="${1:-}"
if [[ $# -gt 0 ]]; then shift; fi
case "$action" in
  create) script="$root/scripts/youtube-create-playlist.mjs" ;;
  replace) script="$root/scripts/youtube-replace-playlist-items.mjs" ;;
  login|status|logout) script="$root/scripts/youtube-auth.mjs" ;;
  *)
    printf 'Usage: bash scripts/youtube-playlists.sh {login|status|logout|create|replace} [options]\n'
    exit 2 ;;
esac
# Help and local logout must not access the vault.
for arg in "$@"; do
  if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then exec node "$script" --help; fi
done
if [[ "$action" == "logout" ]]; then exec node "$script" --logout "$@"; fi
helper="$HOME/git/agent-skills/skills/windows-env/ak-get"
if [[ ! -f "$helper" ]]; then
  printf 'Error: required managed secret helper is missing: %s\n' "$helper" >&2
  exit 1
fi
export GOOGLE_OAUTH_CLIENT_JSON
GOOGLE_OAUTH_CLIENT_JSON="$(bash "$helper" youtube-oauth-client-json)"
if [[ -z "$GOOGLE_OAUTH_CLIENT_JSON" ]]; then
  printf 'Error: vault returned no OAuth client.\n' >&2
  exit 1
fi
if [[ "$action" == "login" ]]; then exec node "$script" --login "$@"; fi
exec node "$script" "$@"
