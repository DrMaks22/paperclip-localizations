# Stable builder output safety — 2026-11-02

This is a tooling-only follow-up to the unpublished stable candidate `v2026.10.26.1` in PR #10. The supported official Paperclip base remains `v2026.1023.0`, exact commit `1b4c803816e82b0265c8422e1a804327a7ed8c54`, with the preserved `pinned-en-ru` runtime. No new version, tag, release or deployment is created.

The builder previously wrote its three generated outputs through ordinary file paths. A preexisting symlink or hard link could redirect a write before checksum enumeration rejected it. The shared writer now preflights the patch, manifest and SHA256SUMS before opening or truncating outputs, rejects linked or nonregular targets and symlink ancestors, uses `O_NOFOLLOW` / exclusive creation, and verifies file identity and link count. Eleven synthetic regression tests cover every fixed output and preservation of other files on rejection. Independent agent review verified the bounded fix; this is not human certification.

Only `scripts/build.mjs`, the new output-safety tests, this note and the regenerated checksum list change. Compared with stable branch head `3ca0c0150c4bd70818553050f491e8bbd99749a7`, source-lock, release/channel metadata, foundation, canonical catalogs, final UI patch and manifest remain byte-identical. The installer and stable UI/runtime are unchanged.

## Validation

Node.js 24.19.0 was used in isolated local checkouts without installing dependencies.

- Canonical catalog validation passed for en and ru.
- Full normal toolkit: **118 passed, 0 failed, one explicit conditional community-runtime integration skip**; all eleven output-safety tests passed.
- The optional fixture was also attempted explicitly, using a disposable reconstruction of the exact stable foundation. Its staged tree matched source-lock `8237581c92e690ee2b217fbba4865dbb2874f48c`. This exploratory full toolkit run recorded **118 passed, 1 failed, 0 skipped**: the separate `community-json` overlay refused its source-hash mismatch for `ui/src/components/task-chat/task-chat-display.ts`. That overlay is not used by this stable profile. No guard/hash was weakened, and the failed attempt is not counted as a passing integration test.
- Stable `build --check` passed against the exact official base: 1,007 paths, unchanged patch SHA-256 `b30ee6fafc49fc2244c089540828e27687ffd5885b4bd95c59883fe850b6652a`. Counts remain 20,580 English and 20,974 Russian messages.
- `verify` passed: reproducible patch/manifest, forward check/apply, reverse check/apply, exact clean-base restoration, expected file hashes/modes and unchanged Git metadata. The final checksum list was regenerated after this note and validated against every included release file.

The prior UI/runtime evidence and limitations in [v2026.10.26.1.md](v2026.10.26.1.md) are retained. UI tests, typecheck, application production build, browser checks, live services and deployment were not rerun for this builder-only change. This update makes no new linguistic or UI-coverage claim. It remains a nontransactional maintainer build helper intended for an isolated checkout without concurrent edits.

Published tags and downloadable assets remain untouched. Publication or merge is a separate owner decision.
