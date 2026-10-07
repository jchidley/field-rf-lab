# RF workspace

Run Pi and RF commands from /home/jack/git/field-rf-lab.

- This project owns RF hardware/software and RF-specific study content.
- Generic YouTube tooling is canonical in /home/jack/git/youtube-workbench.
  Edit and validate it there, not in the compatibility forwarding scripts here.
- Rust starter checks: cargo test when Rust changes.
- Compatibility gate: bash scripts/check-youtube.sh; requires the sibling workbench checkout.
- Do not initialize/edit vendor submodules just to validate generic tooling.
- Historical archive/session-recovery snapshots are evidence; do not edit/run them.
- RF curated lists and broader lost workspace remain unrecovered.
- Profile names are not identities. YouTube writes need explicit owner approval,
  verified channel ID and typed confirmation; replacement needs complete backups.
- No credentials, tokens, personal exports or backups in Git. Use the managed ak
  helper and nominated vault through the canonical consuming launcher.
- Offline tests do not prove live playlist creation/replacement or RF identity access.
