#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
for file in scripts/*.mjs; do node --check "$file"; done
bash -n scripts/youtube-playlists.sh
node --test tests/youtube.test.mjs
bash scripts/youtube-playlists.sh create --help
bash scripts/youtube-playlists.sh replace --help
bash scripts/youtube-playlists.sh login --help
# Check working-tree files directly, including new/untracked tooling.
node --input-type=module - README.md AGENTS.md .gitignore scripts/*.mjs scripts/*.sh docs/*.md tests/*.mjs <<'NODE'
import fs from 'node:fs/promises';
let failed = false;
for (const file of process.argv.slice(2)) {
  const content = await fs.readFile(file, 'utf8');
  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index++) {
    if (/[ \t]+$/.test(lines[index])) {
      console.error(file + ':' + (index + 1) + ': trailing whitespace');
      failed = true;
    }
    if (/^(?:<{7}|={7}|>{7})(?: |$)/.test(lines[index])) {
      console.error(file + ':' + (index + 1) + ': possible merge conflict');
      failed = true;
    }
  }
}
if (failed) process.exitCode = 1;
NODE
git diff --check
